// Shared by the browser and the server: the album shapes the API returns and the name rules both sides enforce.

import type { MediaKind } from '#lib/media/types.js';

export const ALBUM_NAME_MAX = 100;
/** Most media ids one add/remove request may carry; the client splits bigger selections. */
export const MAX_ITEMS_PER_REQUEST = 500;
/** Photos a card shows. */
export const PREVIEW_COUNT = 3;

/** One photo of an album card's stack. Load `/api/media/:id/thumb` only when hasThumb. */
export type AlbumPreview = { id: string; kind: MediaKind; hasThumb: boolean };

/** An album as the API returns it. */
export type AlbumSummary = {
	id: string;
	name: string;
	/** READY items in the album. */
	count: number;
	/** ISO 8601 */
	createdAt: string;
	/** ISO 8601; bumped by create, add items (when something was added) and remove items (when something was removed). */
	updatedAt: string;
	/** 0..3: cover first (when set), then the album's first items in display order. */
	previews: AlbumPreview[];
};

/** Same `{ items, nextCursor }` shape as MediaPage on purpose. */
export type AlbumPage = { items: AlbumSummary[]; nextCursor: string | null };

export type ItemsRequest = { mediaIds: string[] };
export type AddItemsResult = { added: number };
export type RemoveItemsResult = { removed: number };

type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/** Trims; rejects non-strings and empty names ('Enter an album name'), names over ALBUM_NAME_MAX
 *  UTF-16 units ('Album names can be up to 100 characters') and control characters
 *  /[\u0000-\u001f\u007f]/ ("Album names can't contain line breaks"). Duplicate names are allowed. */
export function checkAlbumName(value: unknown): NameCheck {
	if (typeof value !== 'string') return { ok: false, error: 'Enter an album name' };
	const name = value.trim();
	if (!name) return { ok: false, error: 'Enter an album name' };
	if (name.length > ALBUM_NAME_MAX)
		return { ok: false, error: `Album names can be up to ${ALBUM_NAME_MAX} characters` };
	// A loop rather than a regex: the control range is easier to read this way and needs no lint exception.
	for (let i = 0; i < name.length; i++) {
		const code = name.charCodeAt(i);
		if (code < 0x20 || code === 0x7f)
			return { ok: false, error: "Album names can't contain line breaks" };
	}
	return { ok: true, name };
}
