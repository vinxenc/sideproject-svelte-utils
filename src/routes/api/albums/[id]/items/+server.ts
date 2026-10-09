import { error, json } from '@sveltejs/kit';
import type { AddItemsResult, RemoveItemsResult } from '#lib/albums/types.js';
import { addItems, parseMediaIds, removeItems } from '#lib/server/albums.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

// Adds the media to the album. All or nothing: any id that isn't one of the caller's READY media is a 404.
export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Sign in required');
	const mediaIds = parseMediaIds(await request.json().catch(() => null));
	const added = await addItems(locals.user.id, params.id, mediaIds);
	if (added === null) error(404, 'Not found');
	return json({ added } satisfies AddItemsResult, { headers: NO_STORE });
};

// Removes the media from the album. Ids that aren't in the album are ignored.
export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Sign in required');
	const mediaIds = parseMediaIds(await request.json().catch(() => null));
	const removed = await removeItems(locals.user.id, params.id, mediaIds);
	if (removed === null) error(404, 'Not found');
	return json({ removed } satisfies RemoveItemsResult, { headers: NO_STORE });
};
