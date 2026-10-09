import { error } from '@sveltejs/kit';
import { deleteAlbum } from '#lib/server/albums.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	// Deletes the album only: its AlbumMedia rows cascade, and the photos are kept.
	if (!(await deleteAlbum(locals.user.id, params.id))) error(404, 'Not found');
	return new Response(null, { status: 204, headers: NO_STORE });
};
