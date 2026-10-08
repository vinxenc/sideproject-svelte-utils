import { describe, expect, it, vi } from 'vitest';

const better = vi.hoisted(() => ({ createAuthClient: vi.fn(() => ({ tag: 'client' })) }));
vi.mock('better-auth/svelte', () => better);

describe('authClient', () => {
	it('is the client built by better-auth/svelte, with no options', async () => {
		const { authClient } = await import('#lib/auth-client.js');

		expect(authClient).toEqual({ tag: 'client' });
		expect(better.createAuthClient).toHaveBeenCalledWith();
	});
});
