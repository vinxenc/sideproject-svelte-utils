import { error, json } from '@sveltejs/kit';
import { checkAlbumName } from '#lib/albums/types.js';
import { deleteAlbum, renameAlbum } from '#lib/server/albums.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Sign in required');
	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid request');

	const checked = checkAlbumName(body.name);
	if (!checked.ok) error(400, checked.error);
	const album = await renameAlbum(locals.user.id, params.id, checked.name);
	if (!album) error(404, 'Not found');
	return json(album, { headers: NO_STORE });
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	// Deletes the album only: its AlbumMedia rows cascade, and the photos are kept.
	if (!(await deleteAlbum(locals.user.id, params.id))) error(404, 'Not found');
	return new Response(null, { status: 204, headers: NO_STORE });
};
