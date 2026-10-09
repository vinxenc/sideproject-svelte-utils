import { error, redirect } from '@sveltejs/kit';
import { getAlbumSummary } from '#lib/server/albums.js';
import { NO_STORE } from '#lib/server/media.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	// (app)/+layout.server.ts already redirected signed-out users; guard again for type narrowing.
	if (!locals.user) redirect(303, '/sign-in');
	const album = await getAlbumSummary(locals.user.id, params.id);
	if (!album) error(404, 'Album not found');
	// The HTML carries the album's name: keep it out of the service worker's page cache.
	setHeaders(NO_STORE);
	return { album };
};
