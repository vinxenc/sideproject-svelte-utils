import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.js';

// Better Auth's REST API (sign-in, sign-up, session, …) as its own route,
// so hooks.server.ts doesn't have to intercept requests for it.
export const GET = toSvelteKitHandler(auth),
	POST = GET;
