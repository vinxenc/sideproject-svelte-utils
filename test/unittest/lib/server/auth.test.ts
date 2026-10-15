import { describe, expect, it, vi } from 'vitest';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { CLIENT_IP_HEADER } from '#lib/server/client-ip.js';
import { EMAIL_VERIFICATION, RATE_LIMIT } from '#lib/server/email-verification.js';

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

	it('registers the email-otp engine before the SvelteKit cookie plugin', async () => {
		const { auth } = await import('#lib/server/auth.js');
		const ids = (auth.options.plugins ?? []).map((plugin) => plugin.id);

		expect(ids).toContain('email-otp');
		expect(ids.indexOf('email-otp')).toBeLessThan(ids.length - 1);
	});

	it('configures the email-otp engine with the 6-digit, 10-minute, 5-attempt, hashed policy', async () => {
		const { auth } = await import('#lib/server/auth.js');
		const plugin = (auth.options.plugins ?? []).find((p) => p.id === 'email-otp');

		expect(plugin?.options).toMatchObject({
			otpLength: 6,
			expiresIn: 600,
			allowedAttempts: 5,
			storeOTP: 'hashed',
			disableSignUp: true
		});
	});

	it('overrides the default sign-up verification with the plugin and its real mail callback', async () => {
		const { auth } = await import('#lib/server/auth.js');
		const plugin = (auth.options.plugins ?? []).find((p) => p.id === 'email-otp');

		expect(plugin?.options.overrideDefaultEmailVerification).toBe(true);
		expect(plugin?.options.sendVerificationOTP).toBeTypeOf('function');
	});

	it('requires email verification at sign-up, with the verification, rate-limit and client-IP options', async () => {
		const { auth } = await import('#lib/server/auth.js');

		expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
		expect(auth.options.emailVerification).toEqual(EMAIL_VERIFICATION);
		expect(auth.options.rateLimit).toEqual(RATE_LIMIT);
		expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
	});

	it('trusts the origin of the request itself, so the plugin mail send passes the origin check', async () => {
		const { auth } = await import('#lib/server/auth.js');
		const trustedOrigins = auth.options.trustedOrigins as (request?: Request) => string[];

		expect(trustedOrigins(new Request('http://localhost:4173/api/auth/sign-up/email'))).toEqual([
			'http://localhost:4173'
		]);
		expect(trustedOrigins()).toEqual([]);
	});
});
