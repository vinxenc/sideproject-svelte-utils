import { chunks, sendJson } from '#lib/albums/api.js';
import type { ItemsRequest } from '#lib/albums/types.js';

/** A delete that stopped at a failed chunk: `deletedIds` are the ids of the chunks before it, which are gone. */
export class PartialDeleteError extends Error {
	readonly deletedIds: string[];

	constructor(deletedIds: string[], cause: unknown) {
		super(cause instanceof Error ? cause.message : 'Something went wrong', { cause });
		this.deletedIds = deletedIds;
	}
}

/** Soft-deletes items (one at a time too: pass one id), chunked like the album calls, one request after another; returns the summed `deleted`. A failed chunk throws a PartialDeleteError. */
export async function deleteMediaItems(ids: string[]): Promise<number> {
	let deleted = 0;
	const deletedIds: string[] = [];
	for (const chunk of chunks(ids)) {
		try {
			const res = await sendJson('/api/media', 'DELETE', {
				mediaIds: chunk
			} satisfies ItemsRequest);
			deleted += ((await res.json()) as { deleted: number }).deleted;
		} catch (e) {
			throw new PartialDeleteError(deletedIds, e);
		}
		deletedIds.push(...chunk);
	}
	return deleted;
}
