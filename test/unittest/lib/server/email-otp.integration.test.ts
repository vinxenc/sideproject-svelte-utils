import { createHash } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { memoryAdapter, type MemoryDB } from 'better-auth/adapters/memory';
import { emailOTP } from 'better-auth/plugins';
import { describe, expect, it, vi } from 'vitest';
import {
	EMAIL_OTP_ENGINE,
	EmailOtp,
	otpIdentifier,
	type EmailOtpStore,
	type OtpErrorCode
} from '#lib/server/email-otp.js';
import { otpMessage } from '#lib/server/mail/messages.js';
import { FakeMailer } from '../../helpers/email-otp.js';

const EMAIL = 'Ann@Example.com';

/**
 * The real emailOTP plugin, with the engine options from auth.ts, on Better Auth's in-memory adapter. No
 * database. The only stand-in is the mailer, which records messages. EmailOtp runs against the real engine,
 * so these tests catch engine changes that the hand-written fake cannot.
 */
async function setup() {
	const memDb: MemoryDB = { user: [], session: [], account: [], verification: [] };
	const auth = betterAuth({
		secret: 'integration-test-secret-0123456789abcdef',
		database: memoryAdapter(memDb),
		emailAndPassword: { enabled: true },
		// The same stub as auth.ts: the plugin must never mail.
		plugins: [
			emailOTP({
				...EMAIL_OTP_ENGINE,
				sendVerificationOTP: () => Promise.reject(new Error('plugin must not mail'))
			})
		]
	});

	const { user } = await auth.api.signUpEmail({
		body: { email: EMAIL, password: 'correct horse battery', name: 'Ann' }
	});

	// Read through memDb on every call: the adapter replaces the array after a transaction.
	const db: EmailOtpStore = {
		async findFirst({ where }) {
			const newest = memDb.verification
				.filter((row) => row.identifier === where.identifier)
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
			return newest ? { id: newest.id, createdAt: newest.createdAt } : null;
		},
		async deleteMany({ where }) {
			const before = memDb.verification.length;
			memDb.verification = memDb.verification.filter((row) =>
				'id' in where ? row.id !== where.id : row.identifier !== where.identifier
			);
			return { count: before - memDb.verification.length };
		}
	};

	const mailer = new FakeMailer();
	const onVerified = vi.fn();
	const otp = new EmailOtp({
		api: auth.api,
		db,
		sendCode: (to, code) => mailer.send(otpMessage(to, code)),
		onVerified
	});

	return { memDb, mailer, otp, onVerified, user: { id: user.id, email: EMAIL } };
}

/** The 6-digit code in the most recent mail. */
function codeIn(mailer: FakeMailer): string {
	const match = /Your verification code is (\d{6})\./.exec(mailer.messages.at(-1)?.text ?? '');
	if (!match) throw new Error('no code in the last mail');
	return match[1];
}

/** The OtpError code of a settled call, or 'ok'. */
const outcome = (result: PromiseSettledResult<unknown>) =>
	result.status === 'fulfilled' ? 'ok' : (result.reason as { code?: OtpErrorCode }).code;

describe('EmailOtp on the real emailOTP engine', () => {
	it('leaves no row when the mail fails, and a retry after recovery is not blocked', async () => {
		const { otp, memDb, mailer } = await setup();
		mailer.fail = true;

		await expect(otp.send({ id: 'x', email: EMAIL })).rejects.toThrow('SMTP down');
		expect(memDb.verification).toHaveLength(0);

		mailer.fail = false;
		await expect(otp.send({ id: 'x', email: EMAIL })).resolves.toBeUndefined();
		expect(mailer.messages).toHaveLength(1);
	});

	it('refuses a resend inside the gap with TOO_SOON, and mails nothing more', async () => {
		const { otp, mailer, user } = await setup();
		await otp.send(user);

		const error = await otp.send(user).catch((e: unknown) => e);

		expect(error).toMatchObject({ code: 'TOO_SOON' });
		expect((error as { retryAfter: number }).retryAfter).toBeGreaterThanOrEqual(1);
		expect((error as { retryAfter: number }).retryAfter).toBeLessThanOrEqual(60);
		expect(mailer.messages).toHaveLength(1);
	});

	it('stores one hashed row under the plugin identifier, never the plain code', async () => {
		const { otp, memDb, mailer } = await setup();

		await otp.send({ id: 'x', email: EMAIL });

		const code = codeIn(mailer);
		expect(memDb.verification).toHaveLength(1);
		const [row] = memDb.verification;
		// Guards the hand-copied identifier format: a Better Auth change to the prefix or the lowercasing fails here.
		expect(row.identifier).toBe('email-verification-otp-ann@example.com');
		expect(row.identifier).toBe(otpIdentifier(EMAIL));
		// storeOTP: 'hashed' stores the base64url SHA-256 of the code, then the attempt counter.
		expect(row.value).toBe(`${createHash('sha256').update(code).digest('base64url')}:0`);
		expect(row.value).not.toContain(code);
	});

	it('gives INVALID for five wrong codes, LOCKED for the right code after them, and a new send starts over', async () => {
		const { otp, memDb, mailer, onVerified, user } = await setup();
		await otp.send(user);
		const code = codeIn(mailer);

		for (let attempt = 0; attempt < 5; attempt++) {
			await expect(otp.verify(user, '000000')).rejects.toMatchObject({ code: 'INVALID' });
		}
		await expect(otp.verify(user, code)).rejects.toMatchObject({ code: 'LOCKED' });
		expect(memDb.verification).toHaveLength(0);
		expect(onVerified).not.toHaveBeenCalled();

		await otp.send(user);
		await expect(otp.verify(user, codeIn(mailer))).resolves.toBeUndefined();
		expect(onVerified).toHaveBeenCalledTimes(1);
	});

	it('accepts a correct code once and calls onVerified once', async () => {
		const { otp, memDb, mailer, onVerified, user } = await setup();
		await otp.send(user);

		await expect(otp.verify(user, codeIn(mailer))).resolves.toBeUndefined();
		await expect(otp.verify(user, codeIn(mailer))).rejects.toMatchObject({ code: 'INVALID' });

		expect(memDb.verification).toHaveLength(0);
		expect(onVerified).toHaveBeenCalledTimes(1);
		expect(onVerified).toHaveBeenCalledWith(user.id);
	});

	it('holds the 5-try cap when verifies run in parallel', async () => {
		const { otp, memDb, mailer, onVerified, user } = await setup();
		await otp.send(user);
		const code = codeIn(mailer);
		// The right code is the 6th guess in call order: five misses are spent before it.
		const guesses = [...Array(5).fill('000000'), code, ...Array(14).fill('000000')];

		const results = await Promise.allSettled(guesses.map((guess) => otp.verify(user, guess)));

		expect(results.map(outcome)).toEqual([
			'INVALID',
			'INVALID',
			'INVALID',
			'INVALID',
			'INVALID',
			'LOCKED',
			...Array(14).fill('INVALID')
		]);
		expect(memDb.verification).toHaveLength(0);
		expect(onVerified).not.toHaveBeenCalled();
	});
});
