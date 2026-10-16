/** What sign-up / sign-in leave for /verify-email in sessionStorage. Never in the URL. */
export type PendingVerification = { email: string; sentAt: number }; // sentAt = Date.now() when the code was sent

/** The error shape the Better Auth client returns in `result.error`. */
export type AuthClientError = { status?: number; code?: string; message?: string };

export type VerifyErrorView = { message: string; needsNewCode: boolean };

export const OTP_LENGTH = 6; // matches EMAIL_OTP_ENGINE.otpLength (server-only module, so not imported)
export const RESEND_SECONDS = 60; // the plugin's send-verification-otp rate-limit window
export const PENDING_KEY = 'utilities:verify-email';
export const NETWORK_ERROR = 'Could not reach the server. Try again.';

// Fallback for blocked storage (private mode): the same page session keeps the value in memory. Like
// heldPassword it is set only from browser event handlers, never during SSR.
let inMemoryPending: PendingVerification | null = null;

/** Keeps the email for the verify page. Storage can be blocked (private mode), so failures are ignored. */
export function rememberPending(email: string, sentAt: number): void {
	inMemoryPending = { email, sentAt };
	try {
		sessionStorage.setItem(
			PENDING_KEY,
			JSON.stringify({ email, sentAt } satisfies PendingVerification)
		);
	} catch {
		// No storage: readPending falls back to the in-memory copy.
	}
}

/** The pending verification, or null when there is none or it is malformed. */
export function readPending(): PendingVerification | null {
	try {
		const raw = sessionStorage.getItem(PENDING_KEY);
		if (raw === null) return inMemoryPending;
		const value: unknown = JSON.parse(raw);
		if (typeof value !== 'object' || value === null) return null;
		const { email, sentAt } = value as Partial<Record<keyof PendingVerification, unknown>>;
		if (typeof email !== 'string' || !email.includes('@')) return null;
		if (typeof sentAt !== 'number' || !Number.isFinite(sentAt)) return null;
		return { email, sentAt };
	} catch {
		return inMemoryPending;
	}
}

// The password the person just typed at sign-up or sign-in, kept in memory only (never in storage or the URL)
// so the verify page can prove it without asking again. A reload drops it and the page asks. Call holdPassword
// only from browser event handlers: a module variable set during SSR would be shared between requests.
let heldPassword = '';

export function holdPassword(password: string): void {
	heldPassword = password;
}

export function readHeldPassword(): string {
	return heldPassword;
}

export function forgetPending(): void {
	inMemoryPending = null;
	heldPassword = '';
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch {
		// Nothing was stored, or storage is blocked: nothing to forget.
	}
}

/** 'tranlevietduc@gmail.com' → 'tr******@gmail.com'. A fixed six stars hide the length of the local part. Anything without a local part and '@' is returned unchanged. */
export function maskEmail(email: string): string {
	const at = email.indexOf('@');
	if (at < 1) return email;
	return `${email.slice(0, at > 2 ? 2 : 1)}******${email.slice(at)}`;
}

/** Whole seconds until a resend is allowed, counted from sentAt. */
export function secondsLeft(sentAt: number, now: number): number {
	return Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - now) / 1000));
}

export function describeVerifyError(error: AuthClientError): VerifyErrorView {
	if (error.status === 429) {
		return { message: 'Too many tries. Wait a minute, then try again.', needsNewCode: false };
	}
	switch (error.code) {
		case 'INVALID_OTP':
			// Also the answer for a wrong password: the server does not say which one it was.
			return {
				message:
					'That code is not right, or this email was started with a different password. Check the code, sign up again to start over, or sign in if you already have an account.',
				needsNewCode: false
			};
		case 'OTP_EXPIRED':
			return { message: 'That code has expired. Send a new one.', needsNewCode: true };
		case 'TOO_MANY_ATTEMPTS':
			return { message: 'Too many wrong codes. Send a new one.', needsNewCode: true };
		case 'EMAIL_ALREADY_VERIFIED':
			return { message: 'This email is already verified. Sign in instead.', needsNewCode: false };
		default:
			return { message: error.message ?? 'Verification failed. Try again.', needsNewCode: false };
	}
}

export function describeResendError(error: AuthClientError): string {
	if (error.status === 429) {
		return 'You asked for too many codes. Wait a minute, then try again.';
	}
	return error.message ?? 'Could not send a new code. Try again.';
}
