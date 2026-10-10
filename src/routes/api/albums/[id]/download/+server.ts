import { error } from '@sveltejs/kit';
import { getAlbumDownload } from '#lib/server/albums.js';
import { NO_STORE, originalKey } from '#lib/server/media.js';
import { get } from '#lib/server/storage.js';
import { attachment, safeFileName, uniqueNames, zipStream } from '#lib/server/zip.js';
import type { RequestHandler } from './$types';

/** `/api/albums/:id/download`: the album's photos and videos, originals, as one streamed ZIP. */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	const album = await getAlbumDownload(locals.user.id, params.id);
	if (!album) error(404, 'Not found');
	if (album.items.length === 0) error(404, 'This album has no photos or videos');

	const names = uniqueNames(album.items.map((item) => safeFileName(item.name)));
	const body = zipStream(
		album.items.map((item, i) => ({
			name: names[i],
			modified: item.takenAt,
			open: () => get(originalKey(item))
		}))
	);
	return new Response(body, {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': attachment(`${safeFileName(album.name, 'album')}.zip`),
			...NO_STORE
		}
	});
};
