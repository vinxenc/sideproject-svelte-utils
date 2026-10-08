import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginForm from '#lib/components/login-form.svelte';
import { deferred } from '../../helpers/media.js';

const auth = vi.hoisted(() => ({ signIn: { email: vi.fn() } }));
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('#lib/auth-client.js', () => ({ authClient: auth }));
vi.mock('$app/navigation', () => nav);

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(cleanup);

async function fill(email = 'ann@example.com', password = 'hunter2') {
	await fireEvent.input(screen.getByLabelText('Email'), { target: { value: email } });
	await fireEvent.input(screen.getByLabelText('Password'), { target: { value: password } });
	return document.querySelector('form') as HTMLFormElement;
}

describe('LoginForm', () => {
	it('signs in with the typed details and goes to the dashboard', async () => {
		auth.signIn.email.mockResolvedValue({ error: null });
		render(LoginForm);

		await fireEvent.submit(await fill());

		expect(auth.signIn.email).toHaveBeenCalledWith({
			email: 'ann@example.com',
			password: 'hunter2'
		});
		await waitFor(() =>
			expect(nav.goto).toHaveBeenCalledWith('/dashboard', { invalidateAll: true })
		);
	});

	it('shows the server message and stays put when the password is wrong', async () => {
		auth.signIn.email.mockResolvedValue({ error: { message: 'Invalid email or password' } });
		render(LoginForm);

		await fireEvent.submit(await fill());

		expect(await screen.findByText('Invalid email or password')).toBeTruthy();
		expect(nav.goto).not.toHaveBeenCalled();
	});

	it('uses a generic message when the server gives none', async () => {
		auth.signIn.email.mockResolvedValue({ error: {} });
		render(LoginForm);

		await fireEvent.submit(await fill());

		expect(await screen.findByText('Sign in failed')).toBeTruthy();
	});

	it('reports a network failure', async () => {
		auth.signIn.email.mockRejectedValue(new TypeError('offline'));
		render(LoginForm);

		await fireEvent.submit(await fill());

		expect(await screen.findByText('Could not reach the server. Try again.')).toBeTruthy();
	});

	it('disables the button while the request is in flight', async () => {
		const reply = deferred<{ error: null }>();
		auth.signIn.email.mockReturnValue(reply.promise);
		render(LoginForm);

		await fireEvent.submit(await fill());

		const pending = screen.getByRole('button', { name: 'Logging in…' }) as HTMLButtonElement;
		expect(pending.disabled).toBe(true);

		reply.resolve({ error: null });
		await waitFor(() => expect(screen.getByRole('button', { name: 'Login' })).toBeTruthy());
	});

	it('merges its class onto the form and passes other attributes through', () => {
		const { container } = render(LoginForm, { class: 'extra', 'data-testid': 'login' } as never);

		const form = container.querySelector('form') as HTMLFormElement;
		expect(form.classList).toContain('extra');
		expect(form.getAttribute('data-testid')).toBe('login');
	});
});
