import { error } from '@sveltejs/kit';
import { MAX_ITEMS_PER_REQUEST, PREVIEW_COUNT } from '#lib/albums/types.js';
import type { AlbumPage, AlbumSummary } from '#lib/albums/types.js';
import { prisma } from './db.js';
import { encodeCursor, listMedia } from './media.js';
import type { Cursor } from './media.js';
import type { Prisma } from './prisma/client.js';

export const ALBUM_PAGE_SIZE = 30;
export const MAX_ALBUM_PAGE_SIZE = 60;

/** The select every summary is built from. */
export const summarySelect = {
	id: true,
	name: true,
	createdAt: true,
	updatedAt: true,
	cover: { select: { id: true, kind: true, hasThumb: true, status: true } },
	media: {
		where: { media: { status: 'READY' } },
		// First added first: the cover falls back to the first added item (amendment Q4).
		orderBy: [{ addedAt: 'asc' }, { mediaId: 'asc' }],
		take: PREVIEW_COUNT,
		select: { media: { select: { id: true, kind: true, hasThumb: true } } }
	},
	_count: { select: { media: { where: { media: { status: 'READY' } } } } }
} satisfies Prisma.AlbumSelect;
type SummaryRow = Prisma.AlbumGetPayload<{ select: typeof summarySelect }>;

/**
 * Previews = [cover (when present and READY), ...first-added items without the cover].slice(0, 3); dates as ISO strings.
 * With no cover set, the first-added item leads the stack.
 */
export function toSummary(row: SummaryRow): AlbumSummary {
	const cover = row.cover?.status === 'READY' ? row.cover : null;
	const others = row.media.map((link) => link.media).filter((m) => m.id !== cover?.id);
	const picks = cover ? [cover, ...others] : others;
	return {
		id: row.id,
		name: row.name,
		count: row._count.media,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		previews: picks
			.slice(0, PREVIEW_COUNT)
			.map((m) => ({ id: m.id, kind: m.kind, hasThumb: m.hasThumb }))
	};
}

/** Validates `{ mediaIds }`; returns deduped ids or throws the 400s listed in section 3.4. */
export function parseMediaIds(body: unknown): string[] {
	if (!body || typeof body !== 'object') error(400, 'Invalid request');
	const ids = (body as { mediaIds?: unknown }).mediaIds;
	const valid =
		Array.isArray(ids) &&
		ids.every((id) => typeof id === 'string' && id.length >= 1 && id.length <= 64);
	if (!valid) error(400, 'Invalid media ids');
	const unique = [...new Set(ids as string[])];
	if (unique.length === 0) error(400, 'No media ids');
	if (unique.length > MAX_ITEMS_PER_REQUEST) error(400, 'Too many items (500 at most)');
	return unique;
}

/** Parses ?limit; null -> ALBUM_PAGE_SIZE; throws error(400, 'Invalid limit'). */
export function parseLimit(value: string | null): number {
	if (value === null) return ALBUM_PAGE_SIZE;
	const limit = /^\d+$/.test(value) ? Number(value) : NaN;
	if (!(limit >= 1 && limit <= MAX_ALBUM_PAGE_SIZE)) error(400, 'Invalid limit');
	return limit;
}

export async function listAlbums(
	userId: string,
	limit: number,
	cursor: Cursor | null
): Promise<AlbumPage> {
	const rows = await prisma.album.findMany({
		where: {
			userId,
			...(cursor
				? {
						OR: [{ updatedAt: { lt: cursor.at } }, { updatedAt: cursor.at, id: { lt: cursor.id } }]
					}
				: {})
		},
		orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
		take: limit + 1,
		select: summarySelect
	});
	const items = rows.slice(0, limit);
	const last = items.at(-1);
	return {
		items: items.map(toSummary),
		nextCursor: rows.length > limit && last ? encodeCursor(last.updatedAt, last.id) : null
	};
}

export async function getAlbumSummary(userId: string, id: string): Promise<AlbumSummary | null> {
	const row = await prisma.album.findFirst({
		where: { id, userId },
		select: summarySelect
	});
	return row ? toSummary(row) : null;
}

export async function createAlbum(userId: string, name: string): Promise<AlbumSummary> {
	const row = await prisma.album.create({
		data: { userId, name },
		select: summarySelect
	});
	return toSummary(row);
}

/** false when not found / not owned. */
export async function deleteAlbum(userId: string, id: string): Promise<boolean> {
	const { count } = await prisma.album.deleteMany({ where: { id, userId } });
	return count > 0;
}

/** null when the album isn't the user's; otherwise its media page. */
export async function listAlbumMedia(userId: string, albumId: string, cursor: Cursor | null) {
	const album = await prisma.album.findFirst({
		where: { id: albumId, userId },
		select: { id: true }
	});
	if (!album) return null;
	return listMedia({ userId, status: 'READY', albums: { some: { albumId } } }, cursor);
}

/** An album's name and all its READY items, oldest first, for a download; null when it isn't the user's. */
export async function getAlbumDownload(userId: string, id: string) {
	const album = await prisma.album.findFirst({ where: { id, userId }, select: { name: true } });
	if (!album) return null;
	const items = await prisma.media.findMany({
		where: { userId, status: 'READY', albums: { some: { albumId: id } } },
		orderBy: [{ takenAt: 'asc' }, { id: 'asc' }],
		select: { id: true, userId: true, name: true, takenAt: true }
	});
	return { name: album.name, items };
}

/** null => 404 (album not owned, or any id not the user's READY media). Otherwise the number newly added. */
export function addItems(
	userId: string,
	albumId: string,
	mediaIds: string[]
): Promise<number | null> {
	return prisma.$transaction(async (tx) => {
		const album = await tx.album.findFirst({
			where: { id: albumId, userId },
			select: { id: true }
		});
		if (!album) return null;
		const owned = await tx.media.count({
			where: { id: { in: mediaIds }, userId, status: 'READY' }
		});
		if (owned !== mediaIds.length) return null;
		const { count } = await tx.albumMedia.createMany({
			data: mediaIds.map((mediaId) => ({ albumId, mediaId })),
			skipDuplicates: true
		});
		// Explicit, because a no-op re-add must not reorder the album list.
		if (count > 0)
			await tx.album.update({ where: { id: albumId }, data: { updatedAt: new Date() } });
		return count;
	});
}

/** null => 404 (album not owned). Otherwise the number removed. */
export function removeItems(
	userId: string,
	albumId: string,
	mediaIds: string[]
): Promise<number | null> {
	return prisma.$transaction(async (tx) => {
		const album = await tx.album.findFirst({
			where: { id: albumId, userId },
			select: { id: true, coverId: true }
		});
		if (!album) return null;
		const { count } = await tx.albumMedia.deleteMany({
			where: { albumId, mediaId: { in: mediaIds } }
		});
		if (count > 0) {
			await tx.album.update({
				where: { id: albumId },
				data: {
					updatedAt: new Date(),
					...(album.coverId && mediaIds.includes(album.coverId) ? { coverId: null } : {})
				}
			});
		}
		return count;
	});
}
