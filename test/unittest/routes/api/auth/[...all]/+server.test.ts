import { describe, expect, it, vi } from 'vitest';

const better = vi.hoisted(() => {
	const handler = vi.fn();
	return { handler, toSvelteKitHandler: vi.fn(() => handler) };
});
vi.mock('#lib/server/auth.js', () => ({ auth: { tag: 'auth' } }));
vi.mock('better-auth/svelte-kit', () => ({ toSvelteKitHandler: better.toSvelteKitHandler }));

describe('/api/auth/[...all]', () => {
	it('serves GET and POST with the same Better Auth handler', async () => {
		const { GET, POST } = await import('../../../../../../src/routes/api/auth/[...all]/+server.js');

		expect(better.toSvelteKitHandler).toHaveBeenCalledWith({ tag: 'auth' });
		expect(GET).toBe(better.handler);
		expect(POST).toBe(GET);
	});
});
