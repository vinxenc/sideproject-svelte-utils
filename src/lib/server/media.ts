import { error } from '@sveltejs/kit';
import type { MediaItem, MediaPage } from '#lib/media/types.js';
import { prisma } from './db.js';
import type { Media, Prisma } from './prisma/client.js';

// Everything a user uploads lives under their own id, so one prefix scopes their objects.
export const originalKey = (m: Pick<Media, 'userId' | 'id'>) => `${m.userId}/${m.id}/original`;
export const thumbKey = (m: Pick<Media, 'userId' | 'id'>) => `${m.userId}/${m.id}/thumb`;

// A thumbnail is 1024 px at most; anything much bigger is the thumbnail slot being used as free storage.
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;

/** Cache-Control for API responses holding one user's data; the service worker honours no-store. */
export const NO_STORE = { 'cache-control': 'private, no-store' };

export const MEDIA_PAGE_SIZE = 60;

/** A position in a (takenAt, id) list. */
export type Cursor = { at: Date; id: string };

// The cursor is the last item's sort key rather than its id, so it keeps working if that item is
// deleted before the next page is requested.
export function encodeCursor(at: Date, id: string) {
	return `${at.getTime()}_${id}`;
}

export function decodeCursor(value: string): Cursor {
	const match = /^(-?\d+)_(.+)$/.exec(value);
	const at = match && new Date(Number(match[1]));
	if (!match || !at || Number.isNaN(at.getTime())) error(400, 'Invalid cursor');
	return { at, id: match[2] };
}

/** One page of READY media matching `where`, newest first by (takenAt, id). */
export async function listMedia(
	where: Prisma.MediaWhereInput,
	cursor: Cursor | null
): Promise<MediaPage> {
	const rows = await prisma.media.findMany({
		where: {
			...where,
			...(cursor
				? {
						OR: [{ takenAt: { lt: cursor.at } }, { takenAt: cursor.at, id: { lt: cursor.id } }]
					}
				: {})
		},
		orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
		take: MEDIA_PAGE_SIZE + 1
	});
	const items = rows.slice(0, MEDIA_PAGE_SIZE);
	const last = items.at(-1);
	return {
		items: items.map(toItem),
		nextCursor: rows.length > MEDIA_PAGE_SIZE && last ? encodeCursor(last.takenAt, last.id) : null
	};
}

export function toItem(m: Media): MediaItem {
	return {
		id: m.id,
		kind: m.kind,
		name: m.name,
		width: m.width,
		height: m.height,
		duration: m.duration,
		takenAt: m.takenAt.toISOString(),
		hasThumb: m.hasThumb
	};
}
