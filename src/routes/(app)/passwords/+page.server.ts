import { redirect } from '@sveltejs/kit';
import { listPasswords } from '#lib/server/passwords.js';
import { NO_STORE } from '#lib/server/media.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	// (app)/+layout.server.ts already redirected signed-out users; guard again for type narrowing.
	if (!locals.user) redirect(303, '/sign-in');
	// Names and usernames stay out of the service worker cache (HTML and __data.json).
	setHeaders(NO_STORE);
	return { passwords: await listPasswords(locals.user.id) };
};
