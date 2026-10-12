import { APIError } from 'better-auth/api';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { auth } from '#lib/server/auth.js';
import {
	EmailOtp,
	OtpError,
	otpIdentifier,
	type EmailOtpApi,
	type EmailOtpOptions,
	type EmailOtpStore,
	type OtpErrorCode,
	type OtpUser
} from '#lib/server/email-otp.js';
import type { prisma } from '#lib/server/db.js';
import { otpMessage } from '#lib/server/mail/messages.js';
import { FakeMailer, fakeEngine } from '../../helpers/email-otp.js';

const U: OtpUser = { id: 'u1', email: 'Ann@Example.com' };

function setup(opts: Partial<Pick<EmailOtpOptions, 'resendSeconds' | 'onVerified'>> = {}) {
	const mailer = new FakeMailer();
	const engine = fakeEngine();
	const onVerified = opts.onVerified ?? vi.fn();
	const otp = new EmailOtp({
		api: engine.api,
		db: engine.db,
		sendCode: (to, code) => mailer.send(otpMessage(to, code)),
		onVerified,
		resendSeconds: opts.resendSeconds
	});
	return { mailer, ...engine, onVerified, otp };
}

/** The rejection of a promise that must reject. */
async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
	try {
		await promise;
	} catch (e) {
		return e;
	}
	throw new Error('expected a rejection');
}

async function expectCode(promise: Promise<unknown>, code: OtpErrorCode) {
	await expect(promise).rejects.toMatchObject({ name: 'OtpError', code });
}

/** The OtpError code of a settled call, or 'ok'. */
const outcome = (result: PromiseSettledResult<unknown>) =>
	result.status === 'fulfilled' ? 'ok' : (result.reason as OtpError).code;

describe('EmailOtp.send', () => {
	it('mails one code to the lowercased email and stores one row', async () => {
		const { otp, mailer, rows } = setup();

		await otp.send(U);

		expect(mailer.messages).toHaveLength(1);
		expect(mailer.messages[0].to).toBe('ann@example.com');
		expect(rows.map((row) => row.identifier)).toEqual(['email-verification-otp-ann@example.com']);
	});

	it('refuses a second send within the resend gap, and mails nothing more', async () => {
		const { otp, mailer } = setup();
		await otp.send(U);

		const error = await rejectionOf(otp.send(U));

		expect(error).toBeInstanceOf(OtpError);
		expect(error).toMatchObject({ code: 'TOO_SOON' });
		const retryAfter = (error as OtpError).retryAfter ?? 0;
		expect(retryAfter).toBeGreaterThanOrEqual(1);
		expect(retryAfter).toBeLessThanOrEqual(60);
		expect(mailer.messages).toHaveLength(1);
	});

	it('mails a new code once the gap has passed', async () => {
		const { otp, mailer, rows } = setup();
		await otp.send(U);
		rows[0].createdAt = new Date(Date.now() - 61_000);

		await otp.send(U);

		expect(mailer.messages).toHaveLength(2);
		expect(mailer.messages[1].text).toContain('234567');
		expect(rows).toHaveLength(2);
	});

	it('honours a custom resend gap', async () => {
		const { otp, mailer, rows } = setup({ resendSeconds: 5 });
		await otp.send(U);

		const error = await rejectionOf(otp.send(U));
		expect((error as OtpError).retryAfter).toBeLessThanOrEqual(5);

		rows[0].createdAt = new Date(Date.now() - 6_000);
		await otp.send(U);
		expect(mailer.messages).toHaveLength(2);
	});

	it('mails only the session user email, whatever else the user object carries', async () => {
		const { otp, mailer } = setup();
		const sneaky = { ...U, to: 'evil@x.com' };

		await otp.send(sneaky);

		expect(mailer.messages.map((message) => message.to)).toEqual(['ann@example.com']);
	});

	it('removes the row it created when the mail fails, so a retry is not blocked', async () => {
		const { otp, mailer, rows } = setup();
		mailer.fail = true;

		await expect(otp.send(U)).rejects.toThrow('SMTP down');
		expect(rows).toHaveLength(0);

		mailer.fail = false;
		await expect(otp.send(U)).resolves.toBeUndefined();
		expect(mailer.messages).toHaveLength(1);
	});

	it('keeps an earlier code that is still valid when a later mail fails', async () => {
		const { otp, mailer, rows } = setup();
		await otp.send(U);
		rows[0].createdAt = new Date(Date.now() - 61_000);
		mailer.fail = true;

		await expect(otp.send(U)).rejects.toThrow('SMTP down');
		expect(rows.map((row) => row.value)).toEqual(['123456:0']);

		await expect(otp.verify(U, '123456')).resolves.toBeUndefined();
	});

	it('rethrows the mail error when deleting the new row also fails', async () => {
		const engine = fakeEngine();
		const otp = new EmailOtp({
			api: engine.api,
			db: { ...engine.db, deleteMany: vi.fn().mockRejectedValue(new Error('db down')) },
			sendCode: () => Promise.reject(new Error('SMTP down')),
			onVerified: vi.fn()
		});

		await expect(otp.send(U)).rejects.toThrow('SMTP down');
	});

	it('rethrows the mail error without a delete when the new row cannot be read back', async () => {
		const engine = fakeEngine();
		const deleteMany = vi.fn();
		const otp = new EmailOtp({
			api: engine.api,
			db: { ...engine.db, findFirst: vi.fn().mockResolvedValue(null), deleteMany },
			sendCode: () => Promise.reject(new Error('SMTP down')),
			onVerified: vi.fn()
		});

		await expect(otp.send(U)).rejects.toThrow('SMTP down');
		expect(deleteMany).not.toHaveBeenCalled();
	});
});

describe('EmailOtp.verify', () => {
	it('rejects a wrong code as INVALID and does not verify', async () => {
		const { otp, onVerified } = setup();
		await otp.send(U);

		await expectCode(otp.verify(U, '000000'), 'INVALID');
		expect(onVerified).not.toHaveBeenCalled();
	});

	it('gives INVALID for five misses, then LOCKED for the right code on the sixth', async () => {
		const { otp, rows, onVerified } = setup();
		await otp.send(U);

		for (let attempt = 0; attempt < 5; attempt++) {
			await expectCode(otp.verify(U, '000000'), 'INVALID');
		}
		await expectCode(otp.verify(U, '123456'), 'LOCKED');

		expect(rows).toHaveLength(0);
		expect(onVerified).not.toHaveBeenCalled();
	});

	it('holds the 5-try cap when verifies run in parallel', async () => {
		const { otp, rows, onVerified } = setup();
		await otp.send(U);
		// The right code is the 6th guess in call order: five misses are spent before it.
		const guesses = [...Array(5).fill('000000'), '123456', ...Array(14).fill('000000')];

		const results = await Promise.allSettled(guesses.map((guess) => otp.verify(U, guess)));

		expect(results.map(outcome)).toEqual([
			'INVALID',
			'INVALID',
			'INVALID',
			'INVALID',
			'INVALID',
			'LOCKED',
			...Array(14).fill('INVALID')
		]);
		expect(rows).toHaveLength(0);
		expect(onVerified).not.toHaveBeenCalled();
	});

	it.each(['12a456', '12345', ''])(
		'rejects the malformed code %j as INVALID without an attempt',
		async (bad) => {
			const { otp, rows } = setup();
			await otp.send(U);

			await expectCode(otp.verify(U, bad), 'INVALID');
			expect(rows[0].value).toBe('123456:0');
		}
	);

	it('rejects a verify with no prior send as INVALID', async () => {
		const { otp, onVerified } = setup();

		await expectCode(otp.verify(U, '123456'), 'INVALID');
		expect(onVerified).not.toHaveBeenCalled();
	});

	it('rejects an expired code as INVALID', async () => {
		const { otp, rows, onVerified } = setup();
		await otp.send(U);
		rows[0].expiresAt = new Date(Date.now() - 1_000);

		await expectCode(otp.verify(U, '123456'), 'INVALID');
		expect(onVerified).not.toHaveBeenCalled();
	});

	it('accepts the right code with surrounding spaces, deletes every row and calls onVerified once', async () => {
		const { otp, rows, onVerified } = setup();
		await otp.send(U);

		await expect(otp.verify(U, ' 123456 ')).resolves.toBeUndefined();

		expect(rows).toHaveLength(0);
		expect(onVerified).toHaveBeenCalledTimes(1);
		expect(onVerified).toHaveBeenCalledWith('u1');
	});

	it('rejects a second verify of the same code as INVALID, and does not call onVerified again', async () => {
		const { otp, onVerified } = setup();
		await otp.send(U);
		await otp.verify(U, '123456');

		await expectCode(otp.verify(U, '123456'), 'INVALID');
		expect(onVerified).toHaveBeenCalledTimes(1);
	});

	it('deletes both rows when a resend left two', async () => {
		const { otp, rows, onVerified } = setup();
		await otp.send(U);
		rows[0].createdAt = new Date(Date.now() - 61_000);
		await otp.send(U);
		expect(rows).toHaveLength(2);

		await otp.verify(U, '234567');

		expect(rows).toHaveLength(0);
		expect(onVerified).toHaveBeenCalledTimes(1);
	});

	it('lets only one of two concurrent verifies succeed', async () => {
		const { otp, onVerified } = setup();
		await otp.send(U);

		const results = await Promise.allSettled([otp.verify(U, '123456'), otp.verify(U, '123456')]);

		expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
		const rejected = results.find((result) => result.status === 'rejected');
		expect(rejected?.reason).toMatchObject({ code: 'INVALID' });
		expect(onVerified).toHaveBeenCalledTimes(1);
	});

	it('treats a consume that removes nothing as INVALID, and does not call onVerified', async () => {
		const engine = fakeEngine();
		const onVerified = vi.fn();
		const otp = new EmailOtp({
			api: engine.api,
			db: { ...engine.db, deleteMany: async () => ({ count: 0 }) },
			sendCode: () => Promise.resolve(),
			onVerified
		});
		await otp.send(U);

		await expectCode(otp.verify(U, '123456'), 'INVALID');
		expect(onVerified).not.toHaveBeenCalled();
	});

	it('rethrows unmapped API errors unchanged', async () => {
		const notFound = new APIError('BAD_REQUEST', {
			code: 'USER_NOT_FOUND',
			message: 'User not found'
		});
		const api: EmailOtpApi = {
			createVerificationOTP: vi.fn(),
			checkVerificationOTP: vi.fn().mockRejectedValue(notFound)
		};
		const { db } = fakeEngine();
		const otp = new EmailOtp({ api, db, sendCode: vi.fn(), onVerified: vi.fn() });

		await expect(otp.verify(U, '123456')).rejects.toBe(notFound);
	});

	it('rethrows non-API errors unchanged', async () => {
		const dbDown = new Error('db down');
		const api: EmailOtpApi = {
			createVerificationOTP: vi.fn(),
			checkVerificationOTP: vi.fn().mockRejectedValue(dbDown)
		};
		const { db } = fakeEngine();
		const otp = new EmailOtp({ api, db, sendCode: vi.fn(), onVerified: vi.fn() });

		await expect(otp.verify(U, '123456')).rejects.toBe(dbDown);
	});

	it('propagates an onVerified failure, and the code stays consumed', async () => {
		const hookDown = new Error('hook down');
		const { otp, rows } = setup({ onVerified: vi.fn().mockRejectedValue(hookDown) });
		await otp.send(U);

		await expect(otp.verify(U, '123456')).rejects.toBe(hookDown);

		expect(rows).toHaveLength(0);
		await expectCode(otp.verify(U, '123456'), 'INVALID');
	});
});

describe('OtpError and otpIdentifier', () => {
	it('is an Error named OtpError whose message is the code', () => {
		const error = new OtpError('LOCKED');

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('OtpError');
		expect(error.message).toBe('LOCKED');
		expect(error.retryAfter).toBeUndefined();
	});

	it('lowercases the email in the row identifier', () => {
		expect(otpIdentifier('A@B.c')).toBe('email-verification-otp-a@b.c');
	});
});

describe('engine types', () => {
	it('match the Better Auth and Prisma surfaces EmailOtp calls', () => {
		expectTypeOf<typeof auth.api>().toExtend<EmailOtpApi>();
		expectTypeOf<typeof prisma.verification>().toExtend<EmailOtpStore>();
	});
});
