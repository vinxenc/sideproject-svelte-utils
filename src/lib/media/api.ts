import { chunks, send, sendJson } from '#lib/albums/api.js';
import type { ItemsRequest } from '#lib/albums/types.js';
import type { DeleteItemsResult } from './types.js';

/** Soft-deletes one item: it leaves the library and every album, and its stored files are kept. */
export async function deleteMedia(id: string): Promise<void> {
	await send(`/api/media/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Soft-deletes many items, chunked like the album calls, one request after another; returns the summed `deleted`. */
export async function deleteMediaItems(ids: string[]): Promise<number> {
	let deleted = 0;
	for (const chunk of chunks(ids)) {
		const res = await sendJson('/api/media', 'DELETE', { mediaIds: chunk } satisfies ItemsRequest);
		deleted += ((await res.json()) as DeleteItemsResult).deleted;
	}
	return deleted;
}
