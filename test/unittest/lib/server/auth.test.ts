import { describe, expect, it, vi } from 'vitest';
import { sveltekitCookies } from 'better-auth/svelte-kit';

vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));
vi.mock('#lib/server/db.js', () => ({ prisma: {} }));

describe('auth', () => {
	it('uses the configured secret and enables email and password sign-in', async () => {
		const { auth } = await import('#lib/server/auth.js');

		expect(auth.options.secret).toBe('test-secret');
		expect(auth.options.emailAndPassword?.enabled).toBe(true);
	});

	it('keeps the session in a JWT cookie cache', async () => {
		const { auth } = await import('#lib/server/auth.js');

		expect(auth.options.session?.cookieCache).toMatchObject({ enabled: true, strategy: 'jwt' });
	});

	it('loads the openAPI and jwt plugins, with the SvelteKit cookie plugin last', async () => {
		const { auth } = await import('#lib/server/auth.js');
		const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);

		expect(ids).toContain('open-api');
		expect(ids).toContain('jwt');
		expect(ids.at(-1)).toBe(sveltekitCookies(vi.fn()).id);
	});
});
