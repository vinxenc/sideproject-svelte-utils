/** What sign-up / sign-in leave for /verify-email in sessionStorage. Never in the URL. */
export type PendingVerification = { email: string; sentAt: number }; // sentAt = Date.now() when the code was sent

/** The error shape the Better Auth client returns in `result.error`. */
export type AuthClientError = { status?: number; code?: string; message?: string };

export type VerifyErrorView = { message: string; needsNewCode: boolean };

export const OTP_LENGTH = 6; // matches EMAIL_OTP_ENGINE.otpLength (server-only module, so not imported)
export const RESEND_SECONDS = 60; // the plugin's send-verification-otp rate-limit window
export const PENDING_KEY = 'utilities:verify-email';
export const NETWORK_ERROR = 'Could not reach the server. Try again.';

/** Keeps the email for the verify page. Storage can be blocked (private mode), so failures are ignored. */
export function rememberPending(email: string, sentAt: number): void {
	try {
		sessionStorage.setItem(
			PENDING_KEY,
			JSON.stringify({ email, sentAt } satisfies PendingVerification)
		);
	} catch {
		// No storage: the verify page shows the email field instead.
	}
}

/** The pending verification, or null when there is none or it is malformed. */
export function readPending(): PendingVerification | null {
	try {
		const value: unknown = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
		if (typeof value !== 'object' || value === null) return null;
		const { email, sentAt } = value as Partial<Record<keyof PendingVerification, unknown>>;
		if (typeof email !== 'string' || !email.includes('@')) return null;
		if (typeof sentAt !== 'number' || !Number.isFinite(sentAt)) return null;
		return { email, sentAt };
	} catch {
		return null;
	}
}

export function forgetPending(): void {
	try {
		sessionStorage.removeItem(PENDING_KEY);
	} catch {
		// Nothing was stored, or storage is blocked: nothing to forget.
	}
}

/** 'ann@example.com' → 'a•••@example.com'. Anything without a local part and '@' is returned unchanged. */
export function maskEmail(email: string): string {
	const at = email.indexOf('@');
	if (at < 1) return email;
	return `${email[0]}•••${email.slice(at)}`;
}

/** Whole seconds until a resend is allowed, counted from sentAt. */
export function secondsLeft(sentAt: number, now: number, gap = RESEND_SECONDS): number {
	return Math.max(0, Math.ceil((sentAt + gap * 1000 - now) / 1000));
}

export function describeVerifyError(error: AuthClientError): VerifyErrorView {
	if (error.status === 429) {
		return { message: 'Too many tries. Wait a minute, then try again.', needsNewCode: false };
	}
	switch (error.code) {
		case 'INVALID_OTP':
			return {
				message: 'That code is not right. Check the email and try again.',
				needsNewCode: false
			};
		case 'OTP_EXPIRED':
			return { message: 'That code has expired. Send a new one.', needsNewCode: true };
		case 'TOO_MANY_ATTEMPTS':
			return { message: 'Too many wrong codes. Send a new one.', needsNewCode: true };
		case 'EMAIL_ALREADY_VERIFIED':
			return { message: 'This email is already verified. Sign in instead.', needsNewCode: false };
		case 'INVALID_EMAIL':
			return { message: 'Enter a valid email address.', needsNewCode: false };
		default:
			return { message: error.message ?? 'Verification failed. Try again.', needsNewCode: false };
	}
}

export function describeResendError(error: AuthClientError): string {
	if (error.status === 429) {
		return 'You asked for too many codes. Wait a minute, then try again.';
	}
	if (error.code === 'INVALID_EMAIL') return 'Enter a valid email address.';
	return error.message ?? 'Could not send a new code. Try again.';
}
