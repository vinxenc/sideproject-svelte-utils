import { isAPIError } from 'better-auth/api';

export const OTP_LENGTH = 6;
export const OTP_EXPIRES_SECONDS = 600; // 10 min
export const OTP_ALLOWED_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 60;
// Not 'email-verification': the open sign-up routes serve that type, so a step-up code under it could be
// overwritten or burned over HTTP. 'sign-in' is refused by the open send route (email-verification.ts) and
// its consumer route, sign-in/email-otp, answers 404. EmailOtp only uses the server-side create / check calls.
export const OTP_TYPE = 'sign-in' as const;

/** The emailOTP plugin options (the engine). auth.ts and the integration test both spread this. */
export const EMAIL_OTP_ENGINE = {
	otpLength: OTP_LENGTH,
	expiresIn: OTP_EXPIRES_SECONDS,
	allowedAttempts: OTP_ALLOWED_ATTEMPTS,
	storeOTP: 'hashed',
	disableSignUp: true
} as const;

const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);

/** Mirrors Better Auth's internal toOTPIdentifier: the row identifier for a code. Lowercases the email like the plugin. */
export function otpIdentifier(email: string): string {
	return `${OTP_TYPE}-otp-${email.toLowerCase()}`;
}

export type OtpErrorCode = 'TOO_SOON' | 'INVALID' | 'LOCKED';

export class OtpError extends Error {
	readonly code: OtpErrorCode;
	/** TOO_SOON only: whole seconds until a resend is allowed (≥ 1). */
	readonly retryAfter?: number;

	constructor(code: OtpErrorCode, retryAfter?: number) {
		super(code);
		this.name = 'OtpError';
		this.code = code;
		this.retryAfter = retryAfter;
	}
}

/**
 * The two auth.api methods EmailOtp calls (structural, so tests pass fakes). createVerificationOTP stores
 * the hashed row and returns the plain code. It does not mail.
 */
export type EmailOtpApi = {
	createVerificationOTP(args: { body: { email: string; type: typeof OTP_TYPE } }): Promise<string>;
	checkVerificationOTP(args: {
		body: { email: string; type: typeof OTP_TYPE; otp: string };
	}): Promise<unknown>;
};

/** The slice of prisma.verification EmailOtp uses. */
export type EmailOtpStore = {
	findFirst(args: {
		where: { identifier: string };
		orderBy: { createdAt: 'desc' };
		select: { id: true; createdAt: true };
	}): PromiseLike<{ id: string; createdAt: Date } | null>;
	deleteMany(args: {
		where: { identifier: string } | { id: string };
	}): PromiseLike<{ count: number }>;
};

export type EmailOtpOptions = {
	api: EmailOtpApi;
	db: EmailOtpStore;
	/** Mails the plain code. If it rejects, the row just created is deleted and the error is rethrown. */
	sendCode: (to: string, code: string) => Promise<void>;
	/** Runs once per correct, consumed code. */
	onVerified: (userId: string) => void | Promise<void>;
	resendSeconds?: number; // default OTP_RESEND_SECONDS
};

export type OtpUser = { id: string; email: string };

/** The tail of each email's queue. An entry is removed once its queue drains. */
const queues = new Map<string, Promise<void>>();

/**
 * Runs `task` after every earlier task for the same email in this process. The attempt counter is read,
 * compared and written in separate steps, so parallel verifies would all see the same count. This holds
 * the 5-try cap for one server instance only. Several instances need a shared limit (see the README).
 */
function serialise<T>(email: string, task: () => Promise<T>): Promise<T> {
	const run = (queues.get(email) ?? Promise.resolve()).then(task);
	const tail = run.then(
		() => undefined,
		() => undefined
	);
	queues.set(email, tail);
	void tail.then(() => {
		if (queues.get(email) === tail) queues.delete(email);
	});
	return run;
}

/**
 * A one-time code sent to, and checked against, the session user's email. Better Auth's emailOTP plugin
 * is the engine. One code per email: a second consumer needs its own OTP type, or a code requested for
 * one flow would satisfy the other.
 */
// ponytail: one in-flight code per email (Better Auth keys rows by type + email); a second consumer needs a type of its own that no open route serves, or a code requested for one flow satisfies the other.
export class EmailOtp {
	#api: EmailOtpApi;
	#db: EmailOtpStore;
	#sendCode: EmailOtpOptions['sendCode'];
	#onVerified: EmailOtpOptions['onVerified'];
	#resendSeconds: number;

	constructor(options: EmailOtpOptions) {
		this.#api = options.api;
		this.#db = options.db;
		this.#sendCode = options.sendCode;
		this.#onVerified = options.onVerified;
		this.#resendSeconds = options.resendSeconds ?? OTP_RESEND_SECONDS;
	}

	/**
	 * Mails a new code to the user's email. Throws TOO_SOON within the resend gap. The gap is measured from the
	 * newest code, so it holds only while a code exists: a lockout, a success or an expiry lets the next send through.
	 */
	async send(user: OtpUser): Promise<void> {
		const email = user.email.toLowerCase();
		const identifier = otpIdentifier(email);

		// The gap check, the insert and the lookup of the new row run in one queue, so the newest row is ours.
		const { code, rowId } = await serialise(email, async () => {
			// createdAt, not updatedAt: a failed attempt bumps updatedAt. Sends on other instances can still
			// both pass this check and mail two codes; the newer row wins. Accepted for a step-up.
			const last = await this.#db.findFirst({
				where: { identifier },
				orderBy: { createdAt: 'desc' },
				select: { id: true, createdAt: true }
			});
			if (last) {
				const elapsed = Date.now() - last.createdAt.getTime();
				if (elapsed < this.#resendSeconds * 1000) {
					const wait = Math.ceil((this.#resendSeconds * 1000 - elapsed) / 1000);
					throw new OtpError('TOO_SOON', Math.max(1, wait));
				}
			}

			const code = await this.#api.createVerificationOTP({ body: { email, type: OTP_TYPE } });
			const created = await this.#db.findFirst({
				where: { identifier },
				orderBy: { createdAt: 'desc' },
				select: { id: true, createdAt: true }
			});
			return { code, rowId: created?.id };
		});

		try {
			await this.#sendCode(email, code);
		} catch (error) {
			// Only the row this call created is removed: an earlier code may still be valid. A failing delete
			// must not hide the mail error, so it is swallowed here.
			if (rowId !== undefined) {
				try {
					await this.#db.deleteMany({ where: { id: rowId } });
				} catch {
					// The mail error is the one to report.
				}
			}
			throw error;
		}
	}

	/** Checks a code and consumes it. Calls onVerified exactly once per consumed code. */
	async verify(user: OtpUser, code: string): Promise<void> {
		const email = user.email.toLowerCase();
		const otp = code.trim();
		// A malformed code costs no attempt, so it never reaches the engine.
		if (!OTP_PATTERN.test(otp)) throw new OtpError('INVALID');

		await serialise(email, async () => {
			try {
				await this.#api.checkVerificationOTP({ body: { email, type: OTP_TYPE, otp } });
			} catch (e) {
				throw toOtpError(e);
			}

			// Consume the code. Row locks across instances let only one of two deleteMany calls see the rows.
			const { count } = await this.#db.deleteMany({ where: { identifier: otpIdentifier(email) } });
			if (count === 0) throw new OtpError('INVALID');
		});

		await this.#onVerified(user.id);
	}
}

/** Maps Better Auth's error codes to OtpError. Anything unmapped is rethrown unchanged. */
function toOtpError(e: unknown): unknown {
	if (!isAPIError(e)) return e;
	switch ((e as { body?: { code?: unknown } }).body?.code) {
		case 'TOO_MANY_ATTEMPTS':
			return new OtpError('LOCKED');
		case 'INVALID_OTP':
		case 'OTP_EXPIRED':
			return new OtpError('INVALID');
		default:
			return e;
	}
}
