// @vitest-environment node
import { betterAuth } from 'better-auth';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { emailOTP } from 'better-auth/plugins';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_OTP_ENGINE } from '#lib/server/email-otp.js';
import {
	EMAIL_VERIFICATION,
	emailVerificationHooks,
	sendVerificationCode,
	type OwnsData
} from '#lib/server/email-verification.js';
import { FakeMailer } from '../../helpers/email-otp.js';

const EMAIL = 'Ann@Example.com';
const PASSWORD = 'correct horse battery';

/**
 * The real emailOTP plugin, with the options from auth.ts, on Better Auth's in-memory adapter. No rate limit
 * (auth.api server calls skip the router). The only stand-in is the mailer, which records messages.
 */
function setup(owns: OwnsData = async () => false) {
	const memDb: MemoryDB = { user: [], session: [], account: [], verification: [] };
	const mailer = new FakeMailer();
	const auth = betterAuth({
		secret: 'integration-test-secret-0123456789abcdef',
		database: memoryAdapter(memDb),
		emailAndPassword: { enabled: true, requireEmailVerification: true },
		emailVerification: EMAIL_VERIFICATION,
		hooks: emailVerificationHooks(owns),
		plugins: [
			emailOTP({
				...EMAIL_OTP_ENGINE,
				overrideDefaultEmailVerification: true,
				sendVerificationOTP: sendVerificationCode(mailer)
			})
		]
	});
	return { auth, memDb, mailer };
}

/** The 6-digit code in the most recent sign-up verification mail. */
function codeIn(mailer: FakeMailer): string {
	const match = /verify your email is (\d{6})\./.exec(mailer.messages.at(-1)?.text ?? '');
	if (!match) throw new Error('no code in the last mail');
	return match[1];
}

/** Better Auth's APIError code, as thrown by auth.api calls. */
function codeOf(error: unknown): unknown {
	return (error as { body?: { code?: unknown } }).body?.code;
}

type TestAuth = ReturnType<typeof setup>['auth'];

async function signUp(auth: TestAuth, password = PASSWORD) {
	return auth.api.signUpEmail({ body: { email: EMAIL, password, name: 'Ann' } });
}

/**
 * The verify call as the form sends it: the hook reads the password from the raw body, which the typed API
 * does not know (the endpoint schema drops it).
 */
function verify(auth: TestAuth, otp: string, password: unknown = PASSWORD, email: unknown = EMAIL) {
	return auth.api.verifyEmailOTP({
		body: { email, otp, password } as { email: string; otp: string }
	});
}

afterEach(() => {
	vi.useRealTimers();
});

describe('sign-up verification on the real emailOTP plugin', () => {
	it('creates an unverified user with no session and mails one "Verify your email" to the lower-cased address', async () => {
		const { auth, memDb, mailer } = setup();

		const result = await signUp(auth);

		expect(result.token).toBeNull();
		expect(memDb.user).toHaveLength(1);
		expect(memDb.user[0].emailVerified).toBe(false);
		expect(memDb.session).toHaveLength(0);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		expect(mailer.messages[0]).toMatchObject({
			to: 'ann@example.com',
			subject: 'Verify your email'
		});
		expect(mailer.messages[0].subject).not.toMatch(/\d/);
	});

	it('rejects a wrong code, then a right code verifies the user, signs them in and sets the session cookie', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));

		await expect(verify(auth, '000000')).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});

		const { headers, response } = await auth.api.verifyEmailOTP({
			body: { email: EMAIL, otp: codeIn(mailer), password: PASSWORD } as {
				email: string;
				otp: string;
			},
			returnHeaders: true
		});
		expect(response.status).toBe(true);
		expect(typeof response.token).toBe('string');
		expect(response.user.emailVerified).toBe(true);
		expect(memDb.session).toHaveLength(1);
		expect(headers.get('set-cookie')).toContain('session_token');
	});

	it('locks after five wrong codes, leaves the user unverified, and a fresh send verifies', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const code = codeIn(mailer);

		for (let attempt = 0; attempt < 5; attempt++) {
			await expect(verify(auth, '000000')).rejects.toMatchObject({
				body: { code: 'INVALID_OTP' }
			});
		}
		const locked = await verify(auth, code).catch((e: unknown) => e);
		expect(locked).toMatchObject({ status: 'FORBIDDEN' });
		expect(codeOf(locked)).toBe('TOO_MANY_ATTEMPTS');
		expect(memDb.user[0].emailVerified).toBe(false);
		expect(memDb.session).toHaveLength(0);

		await auth.api.sendVerificationOTP({ body: { email: EMAIL, type: 'email-verification' } });
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(2));
		await expect(verify(auth, codeIn(mailer))).resolves.toMatchObject({ status: true });
	});

	it('invalidates the previous code when a new one is sent', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const { auth, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const first = codeIn(mailer);

		// Two rows must not share a createdAt millisecond: the plugin consumes the newest row.
		vi.setSystemTime(Date.now() + 1000);
		await auth.api.sendVerificationOTP({ body: { email: EMAIL, type: 'email-verification' } });
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(2));
		const second = codeIn(mailer);
		expect(second).not.toBe(first);

		await expect(verify(auth, first)).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});
		await expect(verify(auth, second)).resolves.toMatchObject({ status: true });
	});

	it('mails nothing to a verified user, and the send still answers success', async () => {
		const { auth, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		await verify(auth, codeIn(mailer));

		await expect(
			auth.api.sendVerificationOTP({ body: { email: EMAIL, type: 'email-verification' } })
		).resolves.toEqual({ success: true });
		expect(mailer.messages).toHaveLength(1);
	});

	it('refuses a valid code for an already-verified user, and creates no session', async () => {
		const { auth, memDb } = setup();
		await signUp(auth);
		// Verified through a path other than the code, with no other rows: the only row is the one minted below.
		memDb.user[0].emailVerified = true;
		memDb.verification = [];
		const code = await auth.api.createVerificationOTP({
			body: { email: EMAIL, type: 'email-verification' }
		});
		expect(memDb.verification).toHaveLength(1);

		const error = await verify(auth, code).catch((e: unknown) => e);

		expect(codeOf(error)).toBe('EMAIL_ALREADY_VERIFIED');
		expect(memDb.session).toHaveLength(0);
	});

	it('rejects an expired code as OTP_EXPIRED on the first try, then INVALID_OTP', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		const { auth, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const code = codeIn(mailer);

		vi.setSystemTime(Date.now() + 601_000);

		const first = await verify(auth, code).catch((e: unknown) => e);
		expect(codeOf(first)).toBe('OTP_EXPIRED');
		const second = await verify(auth, code).catch((e: unknown) => e);
		expect(codeOf(second)).toBe('INVALID_OTP');
	});

	it('refuses an unverified sign-in with EMAIL_NOT_VERIFIED, mails one more code and creates no session', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));

		const error = await auth.api
			.signInEmail({ body: { email: EMAIL, password: PASSWORD } })
			.catch((e: unknown) => e);

		expect(error).toMatchObject({ status: 'FORBIDDEN' });
		expect(codeOf(error)).toBe('EMAIL_NOT_VERIFIED');
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(2));
		expect(memDb.session).toHaveLength(0);
	});

	it('refuses a sign-up with type sign-in on the open send route, with no mail and no row', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const rows = memDb.verification.length;

		for (const type of ['sign-in', 'forget-password', 'change-email']) {
			await expect(
				auth.api.sendVerificationOTP({ body: { email: EMAIL, type: type as 'sign-in' } })
			).rejects.toMatchObject({ status: 'BAD_REQUEST' });
		}

		expect(mailer.messages).toHaveLength(1);
		expect(memDb.verification).toHaveLength(rows);
	});
});

describe('pre-registration hijack', () => {
	const ATTACKER_PASSWORD = 'attacker knows this';

	/** The attacker signs up first with the victim's email; the victim's mailbox gets the code. */
	async function preRegistered() {
		const ctx = setup();
		await signUp(ctx.auth, ATTACKER_PASSWORD);
		await vi.waitFor(() => expect(ctx.mailer.messages).toHaveLength(1));
		return ctx;
	}

	it('does not let the victim verify into the attacker password, and costs no attempt', async () => {
		const { auth, memDb, mailer } = await preRegistered();
		const code = codeIn(mailer);

		const error = await verify(auth, code, PASSWORD).catch((e: unknown) => e);

		expect(error).toMatchObject({ status: 'BAD_REQUEST' });
		expect(codeOf(error)).toBe('INVALID_OTP');
		expect(memDb.user[0].emailVerified).toBe(false);
		expect(memDb.session).toHaveLength(0);
		// Not consumed, not counted: whoever knows the account password and holds the mailbox still gets in.
		await expect(verify(auth, code, ATTACKER_PASSWORD)).resolves.toMatchObject({ status: true });
	});

	it.each([
		['no password', undefined],
		['an empty password', ''],
		['a non-string password', 12345678]
	])('answers %s like a wrong code', async (_label, password) => {
		const { auth, memDb, mailer } = await preRegistered();

		const error = await verify(auth, codeIn(mailer), password).catch((e: unknown) => e);

		expect(error).toMatchObject({ status: 'BAD_REQUEST' });
		expect(codeOf(error)).toBe('INVALID_OTP');
		expect(memDb.user[0].emailVerified).toBe(false);
	});

	it('answers an unknown email exactly like a wrong password', async () => {
		const { auth, mailer } = await preRegistered();
		const known = await verify(auth, codeIn(mailer), 'wrong').catch((e: unknown) => e);

		const unknown = await verify(auth, '123456', 'wrong', 'nobody@example.com').catch(
			(e: unknown) => e
		);

		expect(unknown).toMatchObject({ status: 'BAD_REQUEST' });
		expect(codeOf(unknown)).toBe(codeOf(known));
		expect((unknown as Error).message).toBe((known as Error).message);
	});

	it('leaves a non-string email to the plugin schema', async () => {
		const { auth } = await preRegistered();

		await expect(verify(auth, '123456', PASSWORD, 42)).rejects.toThrow(/email/);
	});

	it('re-claims the account when the victim signs up: new password, new code, old code and password dead', async () => {
		const { auth, memDb, mailer } = await preRegistered();
		const attackerCode = codeIn(mailer);
		const attackerId = memDb.user[0].id;

		await signUp(auth, PASSWORD);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(2));

		expect(memDb.user).toHaveLength(1);
		expect(memDb.user[0].id).not.toBe(attackerId);
		expect(memDb.account).toHaveLength(1);
		expect(codeIn(mailer)).not.toBe(attackerCode);
		// The attacker's password no longer matches the account, and the attacker's code is gone.
		await expect(verify(auth, codeIn(mailer), ATTACKER_PASSWORD)).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});
		await expect(verify(auth, attackerCode, PASSWORD)).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});
		await expect(verify(auth, codeIn(mailer), PASSWORD)).resolves.toMatchObject({ status: true });
		expect(memDb.session).toHaveLength(1);
	});

	it('lets a later re-claim win over the victim, who then cannot verify with the attacker code', async () => {
		const { auth, memDb, mailer } = await preRegistered();
		await signUp(auth, PASSWORD); // the victim
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(2));
		await signUp(auth, ATTACKER_PASSWORD); // the attacker again, after the victim
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(3));

		// The victim types their own password with the newest code (mailed by the attacker's sign-up).
		await expect(verify(auth, codeIn(mailer), PASSWORD)).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});
		expect(memDb.user[0].emailVerified).toBe(false);
		expect(memDb.session).toHaveLength(0);
	});

	it('refuses a sign-up for a verified account as already registered: same user, same password, no mail', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		await verify(auth, codeIn(mailer));
		const id = memDb.user[0].id;

		await expect(signUp(auth, ATTACKER_PASSWORD)).rejects.toMatchObject({
			statusCode: 422,
			body: {
				code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
				message: 'This email is already registered. Sign in instead.'
			}
		});

		expect(memDb.user).toHaveLength(1);
		expect(memDb.user[0].id).toBe(id);
		expect(mailer.messages).toHaveLength(1);
		await expect(
			auth.api.signInEmail({ body: { email: EMAIL, password: PASSWORD } })
		).resolves.toMatchObject({ token: expect.any(String) });
	});

	it('refuses a sign-up for an unverified account that has a session', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const id = memDb.user[0].id;
		memDb.session.push({
			id: 's1',
			token: 't1',
			userId: id,
			expiresAt: new Date(Date.now() + 60_000),
			createdAt: new Date(),
			updatedAt: new Date()
		});

		await expect(signUp(auth, ATTACKER_PASSWORD)).rejects.toMatchObject({ statusCode: 422 });

		expect(memDb.user).toHaveLength(1);
		expect(memDb.user[0].id).toBe(id);
		expect(mailer.messages).toHaveLength(1);
	});

	it('deletes nothing when the new sign-up is one the core would refuse (short password)', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const id = memDb.user[0].id;

		await expect(signUp(auth, 'short')).rejects.toMatchObject({ status: 'BAD_REQUEST' });

		expect(memDb.user[0].id).toBe(id);
	});

	it('refuses a sign-up for an unverified account that owns data, even with no session', async () => {
		const owns = vi.fn<OwnsData>().mockResolvedValue(true);
		const { auth, memDb, mailer } = setup(owns);
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const id = memDb.user[0].id;

		await expect(signUp(auth, ATTACKER_PASSWORD)).rejects.toMatchObject({ statusCode: 422 });

		expect(owns).toHaveBeenCalledWith(id);
		expect(memDb.user).toHaveLength(1);
		expect(memDb.user[0].id).toBe(id);
		expect(mailer.messages).toHaveLength(1);
	});

	it('deletes nothing when the core would refuse the sign-up (password too long, no name)', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const id = memDb.user[0].id;

		await expect(signUp(auth, 'x'.repeat(129))).rejects.toBeDefined();
		await expect(
			auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD } as never })
		).rejects.toBeDefined();

		expect(memDb.user).toHaveLength(1);
		expect(memDb.user[0].id).toBe(id);
	});

	it('ignores a sign-up body without a string email or password', async () => {
		const { auth, memDb, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		const id = memDb.user[0].id;

		await expect(
			auth.api.signUpEmail({ body: { email: 42, password: PASSWORD, name: 'Ann' } as never })
		).rejects.toBeDefined();
		await expect(
			auth.api.signUpEmail({ body: { email: EMAIL, password: 42, name: 'Ann' } as never })
		).rejects.toBeDefined();

		expect(memDb.user[0].id).toBe(id);
	});
});

describe('OTP type separation', () => {
	it('leaves a step-up (sign-in type) code alone when the open send route is called for it', async () => {
		const { auth, memDb } = setup();
		await signUp(auth);
		await auth.api.createVerificationOTP({ body: { email: EMAIL, type: 'sign-in' } });
		const before = memDb.verification.filter((v) => v.identifier.startsWith('sign-in-otp-'));

		await expect(
			auth.api.sendVerificationOTP({ body: { email: EMAIL, type: 'sign-in' } })
		).rejects.toMatchObject({ status: 'BAD_REQUEST' });

		const after = memDb.verification.filter((v) => v.identifier.startsWith('sign-in-otp-'));
		expect(after).toEqual(before);
		expect(before).toHaveLength(1);
	});
});
