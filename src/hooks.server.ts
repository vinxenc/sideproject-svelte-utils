import { getUser } from '#lib/server/session.js';
import { env } from '#settings/env.js';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';

// Runs when the server starts (not during `vite build`): fail fast if env vars are missing.
export const init: ServerInit = () => void env.DATABASE_URL;

export const handle: Handle = async ({ event, resolve }) => {
	// The auth API is the auth service's own business; getUser() also calls into it.
	if (!event.url.pathname.startsWith('/api/auth/')) event.locals.user = await getUser(event);
	return resolve(event);
};
