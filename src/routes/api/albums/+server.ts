import { error, json } from '@sveltejs/kit';
import { checkAlbumName } from '#lib/albums/types.js';
import { createAlbum, listAlbums, parseLimit } from '#lib/server/albums.js';
import { decodeCursor, NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Sign in required');
	const limit = parseLimit(url.searchParams.get('limit'));
	const cursorParam = url.searchParams.get('cursor');
	const cursor = cursorParam ? decodeCursor(cursorParam) : null;
	return json(await listAlbums(locals.user.id, limit, cursor), { headers: NO_STORE });
};

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in required');
	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid request');

	const checked = checkAlbumName(body.name);
	if (!checked.ok) error(400, checked.error);
	const album = await createAlbum(locals.user.id, checked.name);
	return json(album, { status: 201, headers: NO_STORE });
};
