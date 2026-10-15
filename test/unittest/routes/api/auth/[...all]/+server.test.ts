import { describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../../../../../src/routes/api/auth/[...all]/+server.js';

// Records the argument because restoreMocks clears mock call history before each test.
const better = vi.hoisted(() => {
	const handler = vi.fn();
	const authArgs: unknown[] = [];
	return {
		handler,
		authArgs,
		toSvelteKitHandler: (auth: unknown) => {
			authArgs.push(auth);
			return handler;
		}
	};
});
vi.mock('#lib/server/auth.js', () => ({ auth: { tag: 'auth' } }));
vi.mock('better-auth/svelte-kit', () => ({ toSvelteKitHandler: better.toSvelteKitHandler }));

/** A request event for the catch-all route, with `all` as SvelteKit's decoded param. */
function eventFor(all: string) {
	const request = new Request(`http://localhost/api/auth/${all}`);
	return { params: { all }, request, url: new URL(request.url) } as unknown as Parameters<
		typeof GET
	>[0];
}

describe('/api/auth/[...all]', () => {
	it('builds the Better Auth handler for auth and serves POST with GET', () => {
		expect(better.authArgs).toEqual([{ tag: 'auth' }]);
		expect(POST).toBe(GET);
	});

	it.each([
		'email-otp/send-verification-otp',
		'email-otp/check-verification-otp',
		'email-otp/verify-email',
		'email-otp/reset-password',
		'email-otp/request-password-reset',
		'email-otp/request-email-change',
		'email-otp/change-email',
		'sign-in/email-otp',
		'forget-password/email-otp',
		'Sign-In/Email-OTP/'
	])('answers 404 for %s without reaching Better Auth', async (all) => {
		await expect(GET(eventFor(all))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
		await expect(POST(eventFor(all))).rejects.toMatchObject({ status: 404 });
		expect(better.handler).not.toHaveBeenCalled();
	});

	it.each(['get-session', 'sign-in/email', 'sign-up/email', 'jwks'])(
		'passes %s through to Better Auth and returns its response',
		async (all) => {
			const handled = new Response('ok');
			better.handler.mockResolvedValueOnce(handled);
			const event = eventFor(all);

			const response = await GET(event);

			expect(response).toBe(handled);
			expect(better.handler).toHaveBeenCalledWith(event);
		}
	);
});
