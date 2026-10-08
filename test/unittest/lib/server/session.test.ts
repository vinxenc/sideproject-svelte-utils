import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookies = vi.hoisted(() => ({ getCookieCache: vi.fn(), getSessionCookie: vi.fn() }));
vi.mock('better-auth/cookies', () => cookies);

type GetUser = typeof import('#lib/server/session.js').getUser;
type Ev = Parameters<GetUser>[0];

const U = { id: 'u1', name: 'Ann', email: 'ann@example.com' };
const JWKS = { keys: [{ kid: 'k' }] };

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let getUser: GetUser;
let event: { request: Request; fetch: ReturnType<typeof vi.fn> };

beforeEach(async () => {
	vi.resetModules();
	({ getUser } = await import('#lib/server/session.js'));
	cookies.getCookieCache.mockReset().mockResolvedValue(null);
	cookies.getSessionCookie.mockReset().mockReturnValue(undefined);
	event = { request: new Request('http://localhost/'), fetch: vi.fn() };
});

const run = () => getUser(event as unknown as Ev);

describe('getUser', () => {
	it('returns the user from a valid access token, verified with the published keys', async () => {
		event.fetch.mockResolvedValue(json(JWKS));
		cookies.getCookieCache.mockResolvedValue({ user: U });

		await expect(run()).resolves.toEqual(U);
		expect(event.fetch).toHaveBeenCalledWith('/api/auth/jwks');
		expect(cookies.getCookieCache).toHaveBeenCalledWith(event.request, {
			strategy: 'jwt',
			jwt: { jwks: JWKS }
		});
	});

	it('does not fetch the keys again once they are cached', async () => {
		event.fetch.mockResolvedValue(json(JWKS));
		cookies.getCookieCache.mockResolvedValue({ user: U });

		await run();
		await run();

		expect(event.fetch).toHaveBeenCalledTimes(1);
		expect(cookies.getCookieCache).toHaveBeenCalledTimes(2);
	});

	it('does not verify a token when the keys endpoint answers with an error', async () => {
		event.fetch.mockResolvedValue(json({}, 500));

		await expect(run()).resolves.toBeNull();
		expect(cookies.getCookieCache).not.toHaveBeenCalled();
	});

	it('returns null for a signed-out visitor, and retries the keys on the next request', async () => {
		event.fetch.mockResolvedValue(json({}, 500));

		await expect(run()).resolves.toBeNull();
		await expect(run()).resolves.toBeNull();

		expect(event.fetch).toHaveBeenCalledTimes(2);
	});

	it('does not cache a keys response without a keys array', async () => {
		event.fetch.mockResolvedValue(json({ notKeys: true }));

		await run();
		await run();

		expect(event.fetch).toHaveBeenCalledTimes(2);
	});

	it('falls through to the refresh path when the keys request throws', async () => {
		event.fetch
			.mockRejectedValueOnce(new Error('auth down'))
			.mockResolvedValueOnce(json({ user: U }));
		cookies.getSessionCookie.mockReturnValue('session-token');

		await expect(run()).resolves.toEqual(U);
		expect(event.fetch).toHaveBeenLastCalledWith('/api/auth/get-session');
	});

	it('refreshes through get-session when the access token is missing but a session cookie exists', async () => {
		event.fetch.mockResolvedValueOnce(json(JWKS)).mockResolvedValueOnce(json({ user: U }));
		cookies.getSessionCookie.mockReturnValue('session-token');

		await expect(run()).resolves.toEqual(U);
		expect(event.fetch).toHaveBeenLastCalledWith('/api/auth/get-session');
	});

	it('returns null when get-session has no session', async () => {
		event.fetch.mockResolvedValueOnce(json(JWKS)).mockResolvedValueOnce(json(null));
		cookies.getSessionCookie.mockReturnValue('session-token');

		await expect(run()).resolves.toBeNull();
	});

	it('returns null when get-session answers without a user', async () => {
		event.fetch.mockResolvedValueOnce(json(JWKS)).mockResolvedValueOnce(json({}));
		cookies.getSessionCookie.mockReturnValue('session-token');

		await expect(run()).resolves.toBeNull();
	});

	it('returns null for a visitor with neither an access token nor a session cookie', async () => {
		event.fetch.mockResolvedValue(json(JWKS));

		await expect(run()).resolves.toBeNull();
		expect(event.fetch).not.toHaveBeenCalledWith('/api/auth/get-session');
	});
});
