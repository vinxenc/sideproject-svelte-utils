import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignupForm from '#lib/components/signup-form.svelte';
import { deferred } from '../../helpers/media.js';

const auth = vi.hoisted(() => ({ signUp: { email: vi.fn() } }));
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('#lib/auth-client.js', () => ({ authClient: auth }));
vi.mock('$app/navigation', () => nav);

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(cleanup);

async function fill({
	name = 'Ann',
	email = 'ann@example.com',
	password = 'hunter22',
	confirm = 'hunter22'
} = {}) {
	await fireEvent.input(screen.getByLabelText('Full Name'), { target: { value: name } });
	await fireEvent.input(screen.getByLabelText('Email'), { target: { value: email } });
	await fireEvent.input(screen.getByLabelText('Password'), { target: { value: password } });
	await fireEvent.input(screen.getByLabelText('Confirm Password'), { target: { value: confirm } });
	return document.querySelector('form') as HTMLFormElement;
}

describe('SignupForm', () => {
	it('refuses to sign up when the two passwords differ', async () => {
		render(SignupForm);

		await fireEvent.submit(await fill({ confirm: 'different' }));

		expect(await screen.findByText('Passwords do not match')).toBeTruthy();
		expect(auth.signUp.email).not.toHaveBeenCalled();
	});

	it('creates the account and goes to the dashboard', async () => {
		auth.signUp.email.mockResolvedValue({ error: null });
		render(SignupForm);

		await fireEvent.submit(await fill());

		expect(auth.signUp.email).toHaveBeenCalledWith({
			name: 'Ann',
			email: 'ann@example.com',
			password: 'hunter22'
		});
		await waitFor(() =>
			expect(nav.goto).toHaveBeenCalledWith('/dashboard', { invalidateAll: true })
		);
	});

	it('shows the server message when sign-up is refused', async () => {
		auth.signUp.email.mockResolvedValue({ error: { message: 'Email already registered' } });
		render(SignupForm);

		await fireEvent.submit(await fill());

		expect(await screen.findByText('Email already registered')).toBeTruthy();
		expect(nav.goto).not.toHaveBeenCalled();
	});

	it('uses a generic message when the refusal has none', async () => {
		auth.signUp.email.mockResolvedValue({ error: {} });
		render(SignupForm);

		await fireEvent.submit(await fill());

		expect(await screen.findByText('Sign up failed')).toBeTruthy();
	});

	it('reports a network failure', async () => {
		auth.signUp.email.mockRejectedValue(new TypeError('offline'));
		render(SignupForm);

		await fireEvent.submit(await fill());

		expect(await screen.findByText('Could not reach the server. Try again.')).toBeTruthy();
	});

	it('disables the button while the account is being created', async () => {
		const reply = deferred<{ error: null }>();
		auth.signUp.email.mockReturnValue(reply.promise);
		render(SignupForm);

		await fireEvent.submit(await fill());

		expect(
			(screen.getByRole('button', { name: 'Creating account…' }) as HTMLButtonElement).disabled
		).toBe(true);
		reply.resolve({ error: null });
		await waitFor(() => expect(nav.goto).toHaveBeenCalled());
	});

	it('merges its class onto the form', () => {
		const { container } = render(SignupForm, { class: 'extra' } as never);

		expect((container.querySelector('form') as HTMLFormElement).classList).toContain('extra');
	});
});
