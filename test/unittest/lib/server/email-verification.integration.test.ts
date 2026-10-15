import { TextEncoder as NodeTextEncoder } from 'node:util';
import { betterAuth } from 'better-auth';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { emailOTP } from 'better-auth/plugins';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_OTP_ENGINE } from '#lib/server/email-otp.js';
import { EMAIL_VERIFICATION, sendVerificationCode } from '#lib/server/email-verification.js';
import { FakeMailer } from '../../helpers/email-otp.js';

const EMAIL = 'Ann@Example.com';
const PASSWORD = 'correct horse battery';

/**
 * The real emailOTP plugin, with the options from auth.ts, on Better Auth's in-memory adapter. No rate limit
 * (auth.api server calls skip the router). The only stand-in is the mailer, which records messages.
 */
function setup() {
	const memDb: MemoryDB = { user: [], session: [], account: [], verification: [] };
	const mailer = new FakeMailer();
	const auth = betterAuth({
		secret: 'integration-test-secret-0123456789abcdef',
		database: memoryAdapter(memDb),
		emailAndPassword: { enabled: true, requireEmailVerification: true },
		emailVerification: EMAIL_VERIFICATION,
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

async function signUp(auth: ReturnType<typeof setup>['auth']) {
	return auth.api.signUpEmail({ body: { email: EMAIL, password: PASSWORD, name: 'Ann' } });
}

/**
 * Better Auth signs its sign-up token with new TextEncoder().encode(secret). Under the jsdom environment the
 * global Uint8Array is not the realm that encoder uses, and jose rejects the key with instanceof. Copying the
 * bytes into the global constructor fixes that. Other tests never reach the signer.
 */
class RealmTextEncoder {
	readonly #encoder = new NodeTextEncoder();
	encode(input: string): Uint8Array {
		return Uint8Array.from(this.#encoder.encode(input));
	}
}

beforeEach(() => {
	vi.stubGlobal('TextEncoder', RealmTextEncoder);
});

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

		await expect(
			auth.api.verifyEmailOTP({ body: { email: EMAIL, otp: '000000' } })
		).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});

		const { headers, response } = await auth.api.verifyEmailOTP({
			body: { email: EMAIL, otp: codeIn(mailer) },
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
			await expect(
				auth.api.verifyEmailOTP({ body: { email: EMAIL, otp: '000000' } })
			).rejects.toMatchObject({
				body: { code: 'INVALID_OTP' }
			});
		}
		const locked = await auth.api
			.verifyEmailOTP({ body: { email: EMAIL, otp: code } })
			.catch((e: unknown) => e);
		expect(locked).toMatchObject({ status: 'FORBIDDEN' });
		expect(codeOf(locked)).toBe('TOO_MANY_ATTEMPTS');
		expect(memDb.user[0].emailVerified).toBe(false);
		expect(memDb.session).toHaveLength(0);

		await auth.api.sendVerificationOTP({ body: { email: EMAIL, type: 'email-verification' } });
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(2));
		await expect(
			auth.api.verifyEmailOTP({ body: { email: EMAIL, otp: codeIn(mailer) } })
		).resolves.toMatchObject({ status: true });
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

		await expect(
			auth.api.verifyEmailOTP({ body: { email: EMAIL, otp: first } })
		).rejects.toMatchObject({
			body: { code: 'INVALID_OTP' }
		});
		await expect(
			auth.api.verifyEmailOTP({ body: { email: EMAIL, otp: second } })
		).resolves.toMatchObject({ status: true });
	});

	it('mails nothing to a verified user, and the send still answers success', async () => {
		const { auth, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));
		await auth.api.verifyEmailOTP({ body: { email: EMAIL, otp: codeIn(mailer) } });

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

		const error = await auth.api
			.verifyEmailOTP({ body: { email: EMAIL, otp: code } })
			.catch((e: unknown) => e);

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

		const first = await auth.api
			.verifyEmailOTP({ body: { email: EMAIL, otp: code } })
			.catch((e: unknown) => e);
		expect(codeOf(first)).toBe('OTP_EXPIRED');
		const second = await auth.api
			.verifyEmailOTP({ body: { email: EMAIL, otp: code } })
			.catch((e: unknown) => e);
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

	it('answers a second sign-up with the same email with no token and mails nothing', async () => {
		const { auth, mailer } = setup();
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));

		const again = await signUp(auth);

		expect(again.token).toBeNull();
		expect(mailer.messages).toHaveLength(1);
	});

	it('mails nothing for a sign-in code sent to an unverified user', async () => {
		const { auth, mailer } = setup();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await signUp(auth);
		await vi.waitFor(() => expect(mailer.messages).toHaveLength(1));

		await auth.api.sendVerificationOTP({ body: { email: EMAIL, type: 'sign-in' } });

		expect(mailer.messages).toHaveLength(1);
		expect(warn).toHaveBeenCalled();
	});
});
