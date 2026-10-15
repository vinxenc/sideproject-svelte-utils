import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	NETWORK_ERROR,
	PENDING_KEY,
	describeResendError,
	describeVerifyError,
	forgetPending,
	holdPassword,
	maskEmail,
	readHeldPassword,
	readPending,
	rememberPending,
	secondsLeft
} from '#lib/verify-email.js';

describe('pending verification storage', () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => sessionStorage.clear());

	it('round-trips the email and the send time', () => {
		rememberPending('ann@example.com', 1000);

		expect(readPending()).toEqual({ email: 'ann@example.com', sentAt: 1000 });
	});

	it('forgets the stored verification', () => {
		rememberPending('ann@example.com', 1000);

		forgetPending();

		expect(readPending()).toBeNull();
	});

	it('returns null when nothing is stored', () => {
		expect(readPending()).toBeNull();
	});

	it.each([
		['malformed JSON', '{'],
		['an email that is not a string', JSON.stringify({ email: 1, sentAt: 1 })],
		['an email without @', JSON.stringify({ email: 'noat', sentAt: 1 })],
		['a sentAt that is not a number', JSON.stringify({ email: 'a@b.c', sentAt: 'x' })],
		['a JSON value that is not an object', JSON.stringify('a@b.c')],
		['null', 'null']
	])('returns null for %s', (_label, raw) => {
		sessionStorage.setItem(PENDING_KEY, raw);

		expect(readPending()).toBeNull();
	});

	it('returns null for a NaN send time (JSON stores it as null)', () => {
		rememberPending('a@b.c', Number.NaN);

		expect(readPending()).toBeNull();
	});

	it('neither throws nor finds anything when storage is blocked', () => {
		const denied = () => {
			throw new DOMException('denied', 'SecurityError');
		};
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied);
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied);
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied);

		expect(() => rememberPending('a@b.c', 1)).not.toThrow();
		expect(readPending()).toBeNull();
		expect(() => forgetPending()).not.toThrow();
	});
});

describe('held password', () => {
	afterEach(() => holdPassword(''));

	it('is empty until sign-up or sign-in holds one, and forgetPending clears it', () => {
		expect(readHeldPassword()).toBe('');

		holdPassword('hunter22pw');
		expect(readHeldPassword()).toBe('hunter22pw');

		forgetPending();
		expect(readHeldPassword()).toBe('');
	});

	it('is never written to storage', () => {
		holdPassword('hunter22pw');
		rememberPending('ann@example.com', 1000);

		expect(JSON.stringify({ ...sessionStorage })).not.toContain('hunter22pw');
	});
});

describe('maskEmail', () => {
	it.each([
		['tranlevietduc@gmail.com', 'tr******@gmail.com'],
		['ann@example.com', 'an******@example.com'],
		['an@x.io', 'a******@x.io'],
		['a@x.io', 'a******@x.io'],
		['noat', 'noat'],
		['@x.io', '@x.io']
	])('masks %s as %s', (email, masked) => {
		expect(maskEmail(email)).toBe(masked);
	});
});

describe('secondsLeft', () => {
	it('counts the full 60 seconds at the send time', () => {
		expect(secondsLeft(1000, 1000)).toBe(60);
	});

	it('rounds a partial second up', () => {
		expect(secondsLeft(0, 59_001)).toBe(1);
	});

	it('reaches 0 at 60 seconds and stays there', () => {
		expect(secondsLeft(0, 60_000)).toBe(0);
		expect(secondsLeft(0, 90_000)).toBe(0);
	});

	it('takes a custom gap', () => {
		expect(secondsLeft(0, 5_000, 10)).toBe(5);
	});
});

describe('describeVerifyError', () => {
	it.each([
		[{ status: 429 }, 'Too many tries. Wait a minute, then try again.', false],
		[
			{ code: 'INVALID_OTP' },
			'That code is not right, or this email was started with a different password. Check the code, or sign up again to start over.',
			false
		],
		[{ code: 'OTP_EXPIRED' }, 'That code has expired. Send a new one.', true],
		[{ code: 'TOO_MANY_ATTEMPTS' }, 'Too many wrong codes. Send a new one.', true],
		[{ code: 'EMAIL_ALREADY_VERIFIED' }, 'This email is already verified. Sign in instead.', false],
		[{ code: 'INVALID_EMAIL' }, 'Enter a valid email address.', false]
	])('maps %j to its message', (error, message, needsNewCode) => {
		expect(describeVerifyError(error)).toEqual({ message, needsNewCode });
	});

	it('shows the server message for an unknown code', () => {
		expect(describeVerifyError({ code: 'SOMETHING', message: 'Boom' })).toEqual({
			message: 'Boom',
			needsNewCode: false
		});
	});

	it('uses a generic message when the error has none', () => {
		expect(describeVerifyError({})).toEqual({
			message: 'Verification failed. Try again.',
			needsNewCode: false
		});
	});
});

describe('describeResendError', () => {
	it('explains a 429', () => {
		expect(describeResendError({ status: 429 })).toBe(
			'You asked for too many codes. Wait a minute, then try again.'
		);
	});

	it('explains an invalid email', () => {
		expect(describeResendError({ code: 'INVALID_EMAIL' })).toBe('Enter a valid email address.');
	});

	it('shows the server message, or a generic one', () => {
		expect(describeResendError({ message: 'Nope' })).toBe('Nope');
		expect(describeResendError({})).toBe('Could not send a new code. Try again.');
	});
});

describe('NETWORK_ERROR', () => {
	it('is the text shown when the server cannot be reached', () => {
		expect(NETWORK_ERROR).toBe('Could not reach the server. Try again.');
	});
});
