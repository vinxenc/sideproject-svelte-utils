import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../src/routes/(guest)/sign-up/+page.svelte';

vi.mock('#lib/auth-client.js', () => ({ authClient: { signUp: { email: vi.fn() } } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

afterEach(cleanup);

describe('sign-up page', () => {
	it('titles itself and shows the sign-up form', () => {
		render(Page);

		expect(document.title).toBe('Sign up · Utilities');
		expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
	});
});
