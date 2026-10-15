import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../src/routes/(guest)/verify-email/+page.svelte';

vi.mock('#lib/auth-client.js', () => ({
	authClient: { emailOtp: { verifyEmail: vi.fn(), sendVerificationOtp: vi.fn() } }
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

afterEach(cleanup);

describe('verify-email page', () => {
	it('titles itself and shows the verify form', () => {
		render(Page);

		expect(document.title).toBe('Verify email · Utilities');
		expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeTruthy();
	});
});
