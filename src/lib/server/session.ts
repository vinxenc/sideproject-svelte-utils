import { getCookieCache, getSessionCookie } from 'better-auth/cookies';
import type { RequestEvent } from '@sveltejs/kit';
import type { Auth } from './auth.js';

// App side of auth: verifies the access token itself and only calls the auth API
// (over HTTP) for public keys and refreshes, so it keeps working once auth moves to
// its own service (point these paths at that service's URL).
type Session = Auth['$Infer']['Session'];
let jwks: { keys: Record<string, string>[] } | undefined;

export async function getUser(event: RequestEvent): Promise<Session['user'] | null> {
	// ponytail: keys cached until restart; refetch on unknown kid if key rotation is enabled.
	// Only a valid response is cached, so a failed fetch is retried on the next request.
	if (!jwks) {
		try {
			const res = await event.fetch('/api/auth/jwks');
			const body = res.ok ? await res.json() : null;
			if (Array.isArray(body?.keys)) jwks = body;
		} catch {
			// auth unreachable or malformed response: fall back to get-session below
		}
	}

	// Access token: the signed session_data JWT, verified locally with the public keys.
	const cached = jwks && (await getCookieCache(event.request, { strategy: 'jwt', jwt: { jwks } }));
	if (cached) return cached.user as Session['user'];

	// Access token missing or expired: refresh with the session token, which also
	// issues a new access token cookie.
	if (!getSessionCookie(event.request)) return null;
	const res = await event.fetch('/api/auth/get-session');
	return ((await res.json()) as Session | null)?.user ?? null;
}
