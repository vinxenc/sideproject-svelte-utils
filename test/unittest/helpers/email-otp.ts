import { APIError } from 'better-auth/api';
import { otpIdentifier, OTP_ALLOWED_ATTEMPTS, OTP_EXPIRES_SECONDS } from '#lib/server/email-otp.js';
import type { EmailOtpApi, EmailOtpStore } from '#lib/server/email-otp.js';
import type { MailMessage } from '#lib/server/mail/mailer.js';

/** Records mail in memory. With `fail` set, send rejects like an SMTP outage. */
export class FakeMailer {
	messages: MailMessage[] = [];
	fail = false;

	async send(message: MailMessage): Promise<void> {
		if (this.fail) throw new Error('SMTP down');
		this.messages.push(message);
	}
}

export type FakeRow = {
	id: string;
	identifier: string;
	value: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * An in-memory copy of Better Auth's emailOTP plugin: a new row per create, the newest row wins, the same
 * error codes and the same check order. The row value is "<code>:<attempts>" (not hashed here). Like the
 * plugin, createVerificationOTP only stores the row and returns the code; the caller mails it.
 * The check yields between reading the counter and writing it, as a real engine awaits a database.
 */
export function fakeEngine(opts: { code?: () => string } = {}): {
	api: EmailOtpApi;
	db: EmailOtpStore;
	rows: FakeRow[];
} {
	const rows: FakeRow[] = [];
	const nextCode = opts.code ?? sequentialCodes();

	const forIdentifier = (identifier: string) => rows.filter((r) => r.identifier === identifier);
	// Newest by createdAt; on a tie (same millisecond) the row pushed last wins, like the plugin's order.
	const newest = (identifier: string) =>
		forIdentifier(identifier).reduce<FakeRow | undefined>(
			(latest, row) => (!latest || row.createdAt >= latest.createdAt ? row : latest),
			undefined
		);
	const removeRows = (identifier: string) => {
		const count = forIdentifier(identifier).length;
		for (let i = rows.length - 1; i >= 0; i--) {
			if (rows[i].identifier === identifier) rows.splice(i, 1);
		}
		return count;
	};

	const api: EmailOtpApi = {
		async createVerificationOTP({ body }) {
			const email = body.email.toLowerCase();
			const code = nextCode();
			const now = new Date();
			rows.push({
				id: crypto.randomUUID(),
				identifier: otpIdentifier(email),
				value: `${code}:0`,
				expiresAt: new Date(now.getTime() + OTP_EXPIRES_SECONDS * 1000),
				createdAt: now,
				updatedAt: now
			});
			return code;
		},

		async checkVerificationOTP({ body }) {
			const identifier = otpIdentifier(body.email);
			const row = newest(identifier);
			if (!row) {
				throw new APIError('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' });
			}
			if (row.expiresAt.getTime() <= Date.now()) {
				removeRows(identifier);
				throw new APIError('BAD_REQUEST', { code: 'OTP_EXPIRED', message: 'OTP expired' });
			}
			const [stored, attemptsText] = row.value.split(':');
			const attempts = Number(attemptsText);
			if (attempts >= OTP_ALLOWED_ATTEMPTS) {
				removeRows(identifier);
				throw new APIError('FORBIDDEN', {
					code: 'TOO_MANY_ATTEMPTS',
					message: 'Too many attempts'
				});
			}
			const matches = body.otp === stored;
			await Promise.resolve();
			if (!matches) {
				row.value = `${stored}:${attempts + 1}`;
				row.updatedAt = new Date();
				throw new APIError('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' });
			}
			return { success: true };
		}
	};

	const db: EmailOtpStore = {
		async findFirst({ where }) {
			const row = newest(where.identifier);
			return row ? { id: row.id, createdAt: row.createdAt } : null;
		},
		async deleteMany({ where }) {
			if ('id' in where) {
				const index = rows.findIndex((r) => r.id === where.id);
				if (index === -1) return { count: 0 };
				rows.splice(index, 1);
				return { count: 1 };
			}
			return { count: removeRows(where.identifier) };
		}
	};

	return { api, db, rows };
}

/** 123456, 234567, 345678, … */
function sequentialCodes(): () => string {
	let next = 123456;
	return () => {
		const code = String(next);
		next += 111111;
		return code;
	};
}
