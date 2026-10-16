import type { BetterAuthOptions } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import type { EmailOTPOptions } from 'better-auth/plugins';
import { otpIdentifier } from './email-otp.js';
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

/** The OTP type the open send / verify routes serve. Every other type is server-only (see email-otp.ts). */
const SIGN_UP_OTP_TYPE = 'email-verification';

/** The plugin's wrong-code error, byte for byte, so a refused password looks like a wrong code. */
function invalidOtp(): APIError {
	return new APIError('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' });
}

type Body = Record<string, unknown>;
type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** Whether the user owns app data (passwords, media, albums), which a re-claim must never delete. */
export type OwnsData = (userId: string) => Promise<boolean>;

type Delegate = {
	findFirst(args: { where: { userId: string }; select: { id: true } }): PromiseLike<unknown>;
};

/** An OwnsData that asks the Prisma models that hang off the user. */
export function ownsData(db: Record<'password' | 'media' | 'album', Delegate>): OwnsData {
	return async (userId) => {
		const args = { where: { userId }, select: { id: true } } as const;
		const rows = await Promise.all([
			db.password.findFirst(args),
			db.media.findFirst(args),
			db.album.findFirst(args)
		]);
		return rows.some((row) => row !== null);
	};
}

/**
 * Re-claim: a sign-up for an email whose account is still unverified replaces that account, so whoever
 * pre-registered a victim's email cannot squat it. The core sign-up then creates the user, hashes the
 * password and mails the new code. A verified account, or an unverified one with a session or owned data
 * (only a pre-verification-era account that has been used), is never touched: the sign-up is refused with
 * "already registered". That answer reveals which emails have accounts, which was chosen over the core's
 * generic success (a fake success left a person on /verify-email waiting for a mail that never came).
 */
async function reclaimUnverified(
	ctx: HookContext,
	{ email, password, name }: Body,
	owns: OwnsData
): Promise<void> {
	const { internalAdapter, password: hasher } = ctx.context;
	// A sign-up the core would refuse (password length, missing name) must not delete anything.
	if (typeof email !== 'string' || typeof password !== 'string' || typeof name !== 'string') return;
	const { minPasswordLength, maxPasswordLength } = hasher.config;
	if (password.length < minPasswordLength || password.length > maxPasswordLength) return;
	const found = await internalAdapter.findUserByEmail(email.toLowerCase());
	if (!found) return;
	if (
		found.user.emailVerified ||
		(await internalAdapter.listSessions(found.user.id)).length > 0 ||
		(await owns(found.user.id))
	) {
		throw new APIError('UNPROCESSABLE_ENTITY', {
			code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
			message: 'This email is already registered. Sign in instead.'
		});
	}
	await internalAdapter.deleteUser(found.user.id);
	await internalAdapter.deleteVerificationByIdentifier(
		otpIdentifier(found.user.email, SIGN_UP_OTP_TYPE)
	);
}

/**
 * Password proof: an unverified account is verified only by someone who also knows its password (the one
 * set at sign-up). A pre-registering attacker's password is unknown to the victim, so the victim's mailbox
 * alone cannot verify, and sign in to, an account the attacker holds. Runs before the code is checked, so a
 * wrong password costs no attempt. Unknown email, no password account, missing password and wrong password
 * all answer like a wrong code (the unknown email through the plugin's own) after one hash each, so neither
 * the answer nor its timing shows whether the email has an account.
 */
async function requirePasswordProof(ctx: HookContext, { email, password }: Body): Promise<void> {
	if (typeof email !== 'string') return; // the plugin's schema refuses it
	const { internalAdapter, password: hasher } = ctx.context;
	const found = await internalAdapter.findUserByEmail(email.toLowerCase(), {
		includeAccounts: true
	});
	const given = typeof password === 'string' ? password : '';
	// A verified user is the plugin guard's to refuse (after its code check), an unknown email its code check's.
	if (found?.user.emailVerified) return;
	const hash = found?.accounts.find((a) => a.providerId === 'credential')?.password;
	if (!hash || given === '') {
		await hasher.hash(given || 'x'); // one scrypt on every path
		if (found) throw invalidOtp();
		return;
	}
	if (await hasher.verify({ hash, password: given })) return;
	throw invalidOtp();
}

/**
 * emailVerificationHooks: hooks.before, branching on the route (the body here is raw: the endpoint schemas have not run):
 * - /sign-up/email: re-claim an unverified account.
 * - /email-otp/verify-email: password proof.
 * - /email-otp/send-verification-otp: only the sign-up type. The route stores a code row for any type it is
 *   given, which would overwrite a verified user's step-up code (EmailOtp) even though nothing is mailed.
 */
export const emailVerificationHooks = (owns: OwnsData) => ({
	before: createAuthMiddleware(async (ctx) => {
		const body = (ctx.body ?? {}) as Body;
		switch (ctx.path) {
			case '/sign-up/email':
				return reclaimUnverified(ctx, body, owns);
			case '/email-otp/verify-email':
				return requirePasswordProof(ctx, body);
			case '/email-otp/send-verification-otp':
				if (body.type !== SIGN_UP_OTP_TYPE) {
					throw new APIError('BAD_REQUEST', { message: 'Invalid OTP type' });
				}
		}
	})
});

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
