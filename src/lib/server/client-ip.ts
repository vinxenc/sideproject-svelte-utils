import type { RequestEvent } from '@sveltejs/kit';

/**
 * Better Auth reads the client IP for rate limiting only from this header (advanced.ipAddress in auth.ts).
 * The /api/auth route always overwrites it with SvelteKit's getClientAddress(), so a client cannot pick its
 * own bucket. Behind a proxy, configure adapter-node's ADDRESS_HEADER / XFF_DEPTH so getClientAddress() is the real client.
 */
export const CLIENT_IP_HEADER = 'x-utilities-client-ip';

/** A copy of the request whose CLIENT_IP_HEADER is the client address (removed if SvelteKit can't tell). */
export function withClientIp(event: Pick<RequestEvent, 'request' | 'getClientAddress'>): Request {
	const headers = new Headers(event.request.headers);
	headers.delete(CLIENT_IP_HEADER);
	try {
		headers.set(CLIENT_IP_HEADER, event.getClientAddress());
	} catch {
		// No address: Better Auth falls back to one shared bucket per path (production) or 127.0.0.1 (dev).
	}
	return new Request(event.request, { headers });
}
