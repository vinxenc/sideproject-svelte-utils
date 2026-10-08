import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../src/routes/(guest)/sign-in/+page.svelte';

vi.mock('#lib/auth-client.js', () => ({ authClient: { signIn: { email: vi.fn() } } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

afterEach(cleanup);

describe('sign-in page', () => {
	it('titles itself and shows the login form', () => {
		render(Page);

		expect(document.title).toBe('Sign in · Utilities');
		expect(screen.getByRole('heading', { name: 'Login to your account' })).toBeTruthy();
	});
});
