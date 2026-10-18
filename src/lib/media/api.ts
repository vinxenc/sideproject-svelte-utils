import { chunks, sendJson } from '#lib/albums/api.js';
import type { ItemsRequest } from '#lib/albums/types.js';

/** Soft-deletes items (one at a time too: pass one id), chunked like the album calls, one request after another; returns the summed `deleted`. */
export async function deleteMediaItems(ids: string[]): Promise<number> {
	let deleted = 0;
	for (const chunk of chunks(ids)) {
		const res = await sendJson('/api/media', 'DELETE', { mediaIds: chunk } satisfies ItemsRequest);
		deleted += ((await res.json()) as { deleted: number }).deleted;
	}
	return deleted;
}
