import type { BetterAuthOptions } from 'better-auth';
import { APIError } from 'better-auth/api';
import type { EmailOTPOptions } from 'better-auth/plugins';
import type { Mailer } from './mail/mailer.js';
import { verifyEmailMessage } from './mail/messages.js';

/**
 * beforeEmailVerification: refuses to verify (and so to auto-sign-in) a user who is already verified.
 * The plugin consumes the code first, so a refused attempt also burns it. Without this, anyone holding the
 * mailbox could sign in to a verified account through the open email-otp/verify-email route.
 */
export async function rejectVerifiedUser(user: { emailVerified: boolean }): Promise<void> {
	if (user.emailVerified) {
		throw new APIError('BAD_REQUEST', {
			code: 'EMAIL_ALREADY_VERIFIED',
			message: 'Email is already verified'
		});
	}
}

/**
 * The plugin's mail callback. It mails only sign-up verification codes, and only to a user who exists and is
 * not verified yet. Other types (the open send route accepts `sign-in` / `forget-password` in its body) and
 * verified users get nothing.
 * The mail is not awaited: sign-up should answer as fast for a new email as for a taken one (the plugin docs
 * warn about this timing leak). A failed send is logged; the user can press Resend.
 */
export function sendVerificationCode(mailer: Mailer): EmailOTPOptions['sendVerificationOTP'] {
	return async ({ email, otp, type }, ctx) => {
		if (type !== 'email-verification') {
			console.warn(`email-verification: not mailing a ${type} code`);
			return;
		}
		const found = await ctx?.context.internalAdapter.findUserByEmail(email);
		if (!found || found.user.emailVerified) return;
		void mailer
			.send(verifyEmailMessage(email, otp))
			.catch((e: unknown) => console.error('email-verification: sending the code failed', e));
	};
}

export const EMAIL_VERIFICATION = {
	// Unverified sign-in with the right password re-mails a code (sign-in.mjs only sends when this is set).
	sendOnSignIn: true,
	autoSignInAfterVerification: true,
	beforeEmailVerification: rejectVerifiedUser
} satisfies BetterAuthOptions['emailVerification'];

export const RATE_LIMIT = {
	enabled: true, // the default is production only
	storage: 'database', // shared across instances: the rateLimit table
	// session.ts calls these server-side on most requests; a 429 there would read as "signed out".
	customRules: { '/get-session': false, '/jwks': false }
} satisfies BetterAuthOptions['rateLimit'];
