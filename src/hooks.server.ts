import { getUser } from '#lib/server/session.js';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	// The auth API is the auth service's own business; getUser() also calls into it.
	if (!event.url.pathname.startsWith('/api/auth/')) event.locals.user = await getUser(event);
	return resolve(event);
};
