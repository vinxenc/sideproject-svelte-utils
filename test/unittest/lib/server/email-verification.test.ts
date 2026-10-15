import { isAPIError } from 'better-auth/api';
import { describe, expect, it, vi } from 'vitest';
import {
	EMAIL_VERIFICATION,
	RATE_LIMIT,
	ownsData,
	rejectVerifiedUser,
	sendVerificationCode
} from '#lib/server/email-verification.js';
import { verifyEmailMessage } from '#lib/server/mail/messages.js';
import { FakeMailer } from '../../helpers/email-otp.js';

const EMAIL = 'ann@example.com';

/** A Better Auth context whose internal adapter finds `user` (or no user). */
function ctxFor(user: { emailVerified: boolean } | null) {
	const findUserByEmail = vi.fn().mockResolvedValue(user ? { user } : null);
	return { findUserByEmail, ctx: { context: { internalAdapter: { findUserByEmail } } } as never };
}

describe('rejectVerifiedUser', () => {
	it('refuses a verified user with EMAIL_ALREADY_VERIFIED', async () => {
		const error = await rejectVerifiedUser({ emailVerified: true }).catch((e: unknown) => e);

		expect(isAPIError(error)).toBe(true);
		expect(error).toMatchObject({ statusCode: 400, body: { code: 'EMAIL_ALREADY_VERIFIED' } });
	});

	it('lets an unverified user through', async () => {
		await expect(rejectVerifiedUser({ emailVerified: false })).resolves.toBeUndefined();
	});
});

describe('ownsData', () => {
	const delegate = (row: unknown) => ({ findFirst: vi.fn().mockResolvedValue(row) });

	it('is true when any of the user-owned models has a row', async () => {
		const album = delegate({ id: 'a1' });
		const owns = ownsData({ password: delegate(null), media: delegate(null), album });

		await expect(owns('u1')).resolves.toBe(true);
		expect(album.findFirst).toHaveBeenCalledWith({ where: { userId: 'u1' }, select: { id: true } });
	});

	it('is false when the user owns nothing', async () => {
		const owns = ownsData({
			password: delegate(null),
			media: delegate(null),
			album: delegate(null)
		});

		await expect(owns('u1')).resolves.toBe(false);
	});
});

describe('sendVerificationCode', () => {
	it('mails the verification code to an unverified user', async () => {
		const mailer = new FakeMailer();
		const { findUserByEmail, ctx } = ctxFor({ emailVerified: false });
		const send = sendVerificationCode(mailer);

		await send({ email: EMAIL, otp: '123456', type: 'email-verification' }, ctx);

		await vi.waitFor(() => expect(mailer.messages).toEqual([verifyEmailMessage(EMAIL, '123456')]));
		expect(findUserByEmail).toHaveBeenCalledWith(EMAIL);
	});

	it('mails nothing to a verified user', async () => {
		const mailer = new FakeMailer();
		const { ctx } = ctxFor({ emailVerified: true });

		await sendVerificationCode(mailer)(
			{ email: EMAIL, otp: '123456', type: 'email-verification' },
			ctx
		);

		expect(mailer.messages).toHaveLength(0);
	});

	it('mails nothing for an unknown email', async () => {
		const mailer = new FakeMailer();
		const { ctx } = ctxFor(null);

		await sendVerificationCode(mailer)(
			{ email: EMAIL, otp: '123456', type: 'email-verification' },
			ctx
		);

		expect(mailer.messages).toHaveLength(0);
	});

	it('mails nothing when Better Auth gives no context', async () => {
		const mailer = new FakeMailer();

		await sendVerificationCode(mailer)({ email: EMAIL, otp: '123456', type: 'email-verification' });

		expect(mailer.messages).toHaveLength(0);
	});

	it.each(['sign-in', 'forget-password'] as const)(
		'mails nothing and does not look the user up for a %s code',
		async (type) => {
			const mailer = new FakeMailer();
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const { findUserByEmail, ctx } = ctxFor({ emailVerified: false });

			await sendVerificationCode(mailer)({ email: EMAIL, otp: '123456', type }, ctx);

			expect(mailer.messages).toHaveLength(0);
			expect(findUserByEmail).not.toHaveBeenCalled();
			expect(warn).toHaveBeenCalledOnce();
		}
	);

	it('resolves and logs once when the mailer rejects, so sign-up still answers', async () => {
		const mailer = new FakeMailer();
		mailer.fail = true;
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { ctx } = ctxFor({ emailVerified: false });

		await expect(
			sendVerificationCode(mailer)({ email: EMAIL, otp: '123456', type: 'email-verification' }, ctx)
		).resolves.toBeUndefined();

		await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
	});
});

describe('EMAIL_VERIFICATION and RATE_LIMIT', () => {
	it('re-mail on sign-in, auto sign in after verifying, and guard against verified users', () => {
		expect(EMAIL_VERIFICATION).toEqual({
			sendOnSignIn: true,
			autoSignInAfterVerification: true,
			beforeEmailVerification: rejectVerifiedUser
		});
	});

	it('limit with the database and exempt the session and JWKS reads', () => {
		expect(RATE_LIMIT).toEqual({
			enabled: true,
			storage: 'database',
			customRules: { '/get-session': false, '/jwks': false }
		});
	});
});
