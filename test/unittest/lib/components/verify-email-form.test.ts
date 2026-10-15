import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmailForm from '#lib/components/verify-email-form.svelte';
import { PENDING_KEY, holdPassword, readHeldPassword } from '#lib/verify-email.js';
import { deferred } from '../../helpers/media.js';

const auth = vi.hoisted(() => ({
	$fetch: vi.fn(),
	emailOtp: { sendVerificationOtp: vi.fn() }
}));
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('#lib/auth-client.js', () => ({ authClient: auth }));
vi.mock('$app/navigation', () => nav);

const STORED = 'utilities:verify-email';

/** Stores a pending verification `ago` milliseconds before now (0 = a code was just sent). */
function storePending(ago = 0, email = 'ann@example.com') {
	sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email, sentAt: Date.now() - ago }));
}

/** Types the code into the hidden PinInput. Six digits auto-submit. */
async function typeCode(digits: string) {
	await fireEvent.input(screen.getByLabelText('Verification code'), { target: { value: digits } });
}

const verifyButton = () => screen.getByRole('button', { name: /^Verif/ }) as HTMLButtonElement;

beforeEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
	holdPassword('hunter22pw'); // what sign-up or sign-in just typed
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('VerifyEmailForm with a stored pending verification', () => {
	it('shows the masked email, hides the email field, and counts down the resend', async () => {
		vi.useFakeTimers();
		storePending();

		render(VerifyEmailForm);

		expect(screen.getByText('an******@example.com')).toBeTruthy();
		expect(screen.queryByLabelText('Email')).toBeNull();
		const resend = screen.getByRole('button', { name: 'Resend code in 60s' }) as HTMLButtonElement;
		expect(resend.disabled).toBe(true);

		await vi.advanceTimersByTimeAsync(60_000);
		await tick();

		const enabled = screen.getByRole('button', { name: 'Resend code' }) as HTMLButtonElement;
		expect(enabled.disabled).toBe(false);
	});

	it('verifies the six digits, forgets the pending email and goes to /dashboard', async () => {
		storePending(120_000);
		auth.$fetch.mockResolvedValue({ data: { status: true }, error: null });
		render(VerifyEmailForm);

		await typeCode('123456');

		await waitFor(() =>
			expect(auth.$fetch).toHaveBeenCalledWith('/email-otp/verify-email', {
				method: 'POST',
				body: { email: 'ann@example.com', otp: '123456', password: 'hunter22pw' }
			})
		);
		await waitFor(() =>
			expect(nav.goto).toHaveBeenCalledWith('/dashboard', { invalidateAll: true })
		);
		expect(sessionStorage.getItem(STORED)).toBeNull();
	});

	it('shows the wrong-code message, clears the boxes and keeps the input usable', async () => {
		storePending(120_000);
		auth.$fetch.mockResolvedValue({
			error: { status: 400, code: 'INVALID_OTP', message: 'Invalid OTP' }
		});
		render(VerifyEmailForm);

		await typeCode('000000');

		expect(
			await screen.findByText(/That code is not right, or this email was started/)
		).toBeTruthy();
		expect((screen.getByLabelText('Verification code') as HTMLInputElement).disabled).toBe(false);
		expect(nav.goto).not.toHaveBeenCalled();
	});

	it('disables the input and Verify after too many wrong codes, and a successful resend re-enables them', async () => {
		storePending(120_000);
		auth.$fetch.mockResolvedValue({
			error: { status: 403, code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts' }
		});
		auth.emailOtp.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
		render(VerifyEmailForm);

		await typeCode('000000');

		expect(await screen.findByText('Too many wrong codes. Send a new one.')).toBeTruthy();
		expect((screen.getByLabelText('Verification code') as HTMLInputElement).disabled).toBe(true);
		expect(verifyButton().disabled).toBe(true);

		await fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));

		expect(await screen.findByText('A new code is on its way.')).toBeTruthy();
		expect((screen.getByLabelText('Verification code') as HTMLInputElement).disabled).toBe(false);
	});

	it('shows the wait message when verify is rate limited (429)', async () => {
		storePending(120_000);
		auth.$fetch.mockResolvedValue({ error: { status: 429, message: 'Too many' } });
		render(VerifyEmailForm);

		await typeCode('000000');

		expect(await screen.findByText('Too many tries. Wait a minute, then try again.')).toBeTruthy();
	});

	it('shows the network message when the verify request fails', async () => {
		storePending(120_000);
		auth.$fetch.mockRejectedValue(new TypeError('offline'));
		render(VerifyEmailForm);

		await typeCode('000000');

		expect(await screen.findByText('Could not reach the server. Try again.')).toBeTruthy();
		// The boxes clear, so re-enabling the input does not submit the same code again.
		await tick();
		expect(auth.$fetch).toHaveBeenCalledTimes(1);
	});

	it('shows Verifying… and disables the button while the verify is pending, sending only one request', async () => {
		storePending(120_000);
		const reply = deferred<{ error: null }>();
		auth.$fetch.mockReturnValue(reply.promise);
		render(VerifyEmailForm);

		await typeCode('123456');

		const pending = await screen.findByRole('button', { name: 'Verifying…' });
		expect((pending as HTMLButtonElement).disabled).toBe(true);
		expect(auth.$fetch).toHaveBeenCalledTimes(1);

		reply.resolve({ error: null });
		await waitFor(() => expect(nav.goto).toHaveBeenCalled());
	});

	it('restarts the countdown and stores the new send time after a successful resend', async () => {
		vi.useFakeTimers();
		storePending(120_000);
		auth.emailOtp.sendVerificationOtp.mockResolvedValue({ data: { success: true }, error: null });
		render(VerifyEmailForm);

		await fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(auth.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
			email: 'ann@example.com',
			type: 'email-verification'
		});
		expect(screen.getByRole('button', { name: 'Resend code in 60s' })).toBeTruthy();
		expect(JSON.parse(sessionStorage.getItem(STORED) ?? 'null').sentAt).toBe(Date.now());
	});

	it('restarts the countdown at 60 s after a resend is rate limited (429)', async () => {
		vi.useFakeTimers();
		storePending(120_000);
		auth.emailOtp.sendVerificationOtp.mockResolvedValue({
			error: { status: 429, message: 'Too many' }
		});
		render(VerifyEmailForm);

		await fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
		await vi.advanceTimersByTimeAsync(0);
		await tick();

		expect(
			screen.getByText('You asked for too many codes. Wait a minute, then try again.')
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Resend code in 60s' })).toBeTruthy();
	});

	it('shows the network message when the resend request fails', async () => {
		storePending(120_000);
		auth.emailOtp.sendVerificationOtp.mockRejectedValue(new TypeError('offline'));
		render(VerifyEmailForm);

		await fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));

		expect(await screen.findByText('Could not reach the server. Try again.')).toBeTruthy();
	});
});

describe('VerifyEmailForm leaving the page', () => {
	it('forgets the pending email and the held password when it unmounts', async () => {
		storePending();
		const { unmount } = render(VerifyEmailForm);
		await screen.findByText('an******@example.com');

		unmount();

		expect(sessionStorage.getItem(STORED)).toBeNull();
		expect(readHeldPassword()).toBe('');
	});
});

describe('VerifyEmailForm password proof', () => {
	it('hides the password field when sign-up or sign-in just typed the password', async () => {
		storePending(120_000);
		render(VerifyEmailForm);

		await screen.findByText('an******@example.com');

		expect(screen.queryByLabelText('Password')).toBeNull();
	});

	it('asks for the password after a reload, and sends the typed one', async () => {
		holdPassword('');
		storePending(120_000);
		auth.$fetch.mockResolvedValue({ data: { status: true }, error: null });
		render(VerifyEmailForm);
		const field = await screen.findByLabelText('Password');
		await fireEvent.input(field, { target: { value: 'typed-again' } });

		await typeCode('123456');

		await waitFor(() =>
			expect(auth.$fetch).toHaveBeenCalledWith('/email-otp/verify-email', {
				method: 'POST',
				body: { email: 'ann@example.com', otp: '123456', password: 'typed-again' }
			})
		);
	});

	it('asks for the password when the code is entered without one, and makes no request', async () => {
		holdPassword('');
		storePending(120_000);
		render(VerifyEmailForm);
		await screen.findByLabelText('Password');

		await typeCode('123456');

		expect(await screen.findByText('Enter your password first.')).toBeTruthy();
		expect(auth.$fetch).not.toHaveBeenCalled();
	});

	it('links to sign-up so the person can start over', () => {
		render(VerifyEmailForm);

		expect(screen.getByRole('link', { name: 'Start over' }).getAttribute('href')).toBe('/sign-up');
	});
});

describe('VerifyEmailForm without a stored pending verification', () => {
	it('sends the user to /sign-in and never asks for an email', async () => {
		render(VerifyEmailForm);

		await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/sign-in'));
		expect(screen.queryByLabelText('Email')).toBeNull();
	});
});

describe('VerifyEmailForm markup', () => {
	it('merges its class onto the form', () => {
		const { container } = render(VerifyEmailForm, { class: 'extra' } as never);

		expect((container.querySelector('form') as HTMLFormElement).classList).toContain('extra');
	});

	it('links back to sign-in', () => {
		render(VerifyEmailForm);

		expect(screen.getByRole('link', { name: 'Back to sign in' }).getAttribute('href')).toBe(
			'/sign-in'
		);
	});
});
