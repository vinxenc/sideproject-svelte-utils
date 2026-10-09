import { error, json } from '@sveltejs/kit';
import { listAlbumMedia } from '#lib/server/albums.js';
import { decodeCursor, NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.user) error(401, 'Sign in required');
	const cursorParam = url.searchParams.get('cursor');
	const cursor = cursorParam ? decodeCursor(cursorParam) : null;
	const page = await listAlbumMedia(locals.user.id, params.id, cursor);
	if (!page) error(404, 'Not found');
	return json(page, { headers: NO_STORE });
};
