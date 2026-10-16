import { describe, expect, it, vi } from 'vitest';

const better = vi.hoisted(() => ({ createAuthClient: vi.fn(() => ({ tag: 'client' })) }));
vi.mock('better-auth/svelte', () => better);

describe('authClient', () => {
	it('is the client built by better-auth/svelte, with the email-OTP client plugin', async () => {
		const { authClient } = await import('#lib/auth-client.js');

		expect(authClient).toEqual({ tag: 'client' });
		expect(better.createAuthClient).toHaveBeenCalledTimes(1);
		expect(better.createAuthClient).toHaveBeenCalledWith({
			plugins: [expect.objectContaining({ id: 'email-otp' })]
		});
	});
});
