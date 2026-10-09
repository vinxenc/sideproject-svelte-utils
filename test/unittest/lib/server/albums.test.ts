import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_ITEMS_PER_REQUEST } from '#lib/albums/types.js';
import {
	addItems,
	createAlbum,
	deleteAlbum,
	getAlbumSummary,
	listAlbumMedia,
	listAlbums,
	parseLimit,
	parseMediaIds,
	removeItems,
	summarySelect,
	toSummary
} from '#lib/server/albums.js';
import { albumRow } from '../../helpers/albums.js';
import { mediaRow } from '../../helpers/media.js';
import { thrown } from '../../helpers/thrown.js';

const db = vi.hoisted(() => ({
	album: {
		findMany: vi.fn(),
		findFirst: vi.fn(),
		create: vi.fn(),
		deleteMany: vi.fn(),
		update: vi.fn()
	},
	media: { findMany: vi.fn(), count: vi.fn() },
	albumMedia: { createMany: vi.fn(), deleteMany: vi.fn() },
	$transaction: vi.fn()
}));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

const UPDATED = new Date('2024-05-01T10:00:00.000Z');

/** A summarySelect link row, as the album's `media` relation returns it. */
const link = (id: string, extra: Record<string, unknown> = {}) => ({
	media: { id, kind: 'IMAGE', hasThumb: true, ...extra }
});

beforeEach(() => {
	for (const fn of [
		db.album.findMany,
		db.album.findFirst,
		db.album.create,
		db.album.deleteMany,
		db.album.update,
		db.media.findMany,
		db.media.count,
		db.albumMedia.createMany,
		db.albumMedia.deleteMany
	]) {
		fn.mockReset();
	}
	db.album.update.mockResolvedValue({});
	// Interactive transactions: the callback runs against the same mock client.
	db.$transaction.mockReset().mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe('summarySelect', () => {
	it('orders the previews first added, so the cover falls back to the first added item', () => {
		expect(summarySelect.media.orderBy).toEqual([{ addedAt: 'asc' }, { mediaId: 'asc' }]);
	});
});

describe('toSummary', () => {
	it('lists the cover first, then the first items, and counts the READY items', () => {
		const summary = toSummary(
			albumRow({
				cover: { id: 'c', kind: 'VIDEO', hasThumb: false, status: 'READY' },
				media: [link('a'), link('b')],
				_count: { media: 7 }
			}) as never
		);

		expect(summary).toEqual({
			id: 'a1',
			name: 'Trip',
			count: 7,
			createdAt: '2024-05-01T10:00:00.000Z',
			updatedAt: '2024-05-01T10:00:00.000Z',
			previews: [
				{ id: 'c', kind: 'VIDEO', hasThumb: false },
				{ id: 'a', kind: 'IMAGE', hasThumb: true },
				{ id: 'b', kind: 'IMAGE', hasThumb: true }
			]
		});
	});

	it('does not repeat the cover among the first items', () => {
		const summary = toSummary(
			albumRow({
				cover: { id: 'b', kind: 'IMAGE', hasThumb: true, status: 'READY' },
				media: [link('a'), link('b'), link('c')]
			}) as never
		);

		expect(summary.previews.map((p) => p.id)).toEqual(['b', 'a', 'c']);
	});

	it('skips a cover that is not READY', () => {
		const summary = toSummary(
			albumRow({
				cover: { id: 'x', kind: 'IMAGE', hasThumb: true, status: 'PENDING' },
				media: [link('a')]
			}) as never
		);

		expect(summary.previews.map((p) => p.id)).toEqual(['a']);
	});

	it('shows no previews for an empty album, and no cover when there is none', () => {
		expect(toSummary(albumRow() as never).previews).toEqual([]);
	});

	it('never shows more than three previews', () => {
		const summary = toSummary(
			albumRow({ media: [link('a'), link('b'), link('c')], _count: { media: 9 } }) as never
		);

		expect(summary.previews).toHaveLength(3);
	});
});

describe('parseMediaIds', () => {
	it('returns the ids without duplicates, in order', () => {
		expect(parseMediaIds({ mediaIds: ['a', 'b', 'a'] })).toEqual(['a', 'b']);
	});

	it.each([
		[null, 'Invalid request'],
		['text', 'Invalid request'],
		[{ mediaIds: 'x' }, 'Invalid media ids'],
		[{}, 'Invalid media ids'],
		[{ mediaIds: [1] }, 'Invalid media ids'],
		[{ mediaIds: [''] }, 'Invalid media ids'],
		[{ mediaIds: ['x'.repeat(65)] }, 'Invalid media ids'],
		[{ mediaIds: [] }, 'No media ids']
	])('rejects %j with 400 %s', (body, message) => {
		expect(thrown(() => parseMediaIds(body))).toMatchObject({
			status: 400,
			body: { message }
		});
	});

	it('rejects more than 500 distinct ids, counting after dedupe', () => {
		const many = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, i) => `m${i}`);
		expect(thrown(() => parseMediaIds({ mediaIds: many }))).toMatchObject({
			status: 400,
			body: { message: 'Too many items (500 at most)' }
		});
		const dupes = [...many.slice(0, MAX_ITEMS_PER_REQUEST), ...many.slice(0, 10)];
		expect(parseMediaIds({ mediaIds: dupes })).toHaveLength(MAX_ITEMS_PER_REQUEST);
	});
});

describe('parseLimit', () => {
	it('defaults to 30 when absent', () => {
		expect(parseLimit(null)).toBe(30);
	});

	it.each(['1', '60', '7'])('accepts %s', (value) => {
		expect(parseLimit(value)).toBe(Number(value));
	});

	it.each(['0', '61', 'abc', '-1', '2.5', ''])('rejects %j with 400', (value) => {
		expect(thrown(() => parseLimit(value))).toMatchObject({
			status: 400,
			body: { message: 'Invalid limit' }
		});
	});
});

describe('listAlbums', () => {
	it("queries the owner's albums newest first, one more than the limit", async () => {
		db.album.findMany.mockResolvedValue([]);

		const page = await listAlbums('u1', 5, null);

		expect(db.album.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: 'u1' },
				orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
				take: 6
			})
		);
		expect(page).toEqual({ items: [], nextCursor: null });
	});

	it('adds the (updatedAt, id) keyset to the query when given a cursor', async () => {
		const at = new Date(1000);
		db.album.findMany.mockResolvedValue([]);

		await listAlbums('u1', 5, { at, id: 'a9' });

		expect(db.album.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					userId: 'u1',
					OR: [{ updatedAt: { lt: at } }, { updatedAt: at, id: { lt: 'a9' } }]
				}
			})
		);
	});

	it('returns the summaries and a next cursor when a further album exists', async () => {
		db.album.findMany.mockResolvedValue([
			albumRow({ id: 'a2', updatedAt: UPDATED }),
			albumRow({ id: 'a1', updatedAt: new Date(0) }),
			albumRow({ id: 'a0', updatedAt: new Date(0) })
		]);

		const page = await listAlbums('u1', 2, null);

		expect(page.items.map((a) => a.id)).toEqual(['a2', 'a1']);
		expect(page.nextCursor).toBe(`${new Date(0).getTime()}_a1`);
	});
});

describe('getAlbumSummary', () => {
	it('scopes the lookup to the owner and returns null when there is none', async () => {
		db.album.findFirst.mockResolvedValue(null);

		expect(await getAlbumSummary('u1', 'a1')).toBeNull();
		expect(db.album.findFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 'a1', userId: 'u1' } })
		);
	});

	it("returns the summary when the album is the owner's", async () => {
		db.album.findFirst.mockResolvedValue(albumRow());

		expect((await getAlbumSummary('u1', 'a1'))?.id).toBe('a1');
	});
});

describe('createAlbum and deleteAlbum', () => {
	it('creates the album for the owner and returns it with no items', async () => {
		db.album.create.mockResolvedValue(albumRow({ name: 'Trip' }));

		const album = await createAlbum('u1', 'Trip');

		expect(db.album.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: { userId: 'u1', name: 'Trip' } })
		);
		expect(album).toMatchObject({ name: 'Trip', count: 0, previews: [] });
	});

	it('reports whether a row was deleted, scoped to the owner', async () => {
		db.album.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

		expect(await deleteAlbum('u1', 'a1')).toBe(true);
		expect(await deleteAlbum('u2', 'a1')).toBe(false);
		expect(db.album.deleteMany).toHaveBeenCalledWith({ where: { id: 'a1', userId: 'u2' } });
	});
});

describe('listAlbumMedia', () => {
	it("returns null without querying media when the album is not the owner's", async () => {
		db.album.findFirst.mockResolvedValue(null);

		expect(await listAlbumMedia('u1', 'a1', null)).toBeNull();
		expect(db.media.findMany).not.toHaveBeenCalled();
	});

	it('pages the READY media linked to the album', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1' });
		db.media.findMany.mockResolvedValue([mediaRow({ id: 'm1' })]);

		const page = await listAlbumMedia('u1', 'a1', null);

		expect(db.media.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { userId: 'u1', status: 'READY', albums: { some: { albumId: 'a1' } } }
			})
		);
		expect(page?.items.map((i) => i.id)).toEqual(['m1']);
	});
});

describe('addItems', () => {
	it("returns null and inserts nothing when the album is not the owner's", async () => {
		db.album.findFirst.mockResolvedValue(null);

		expect(await addItems('u1', 'a1', ['m1'])).toBeNull();
		expect(db.albumMedia.createMany).not.toHaveBeenCalled();
	});

	it("returns null and inserts nothing when any id is not one of the owner's READY media", async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1' });
		db.media.count.mockResolvedValue(1);

		expect(await addItems('u1', 'a1', ['m1', 'foreign'])).toBeNull();
		expect(db.media.count).toHaveBeenCalledWith({
			where: { id: { in: ['m1', 'foreign'] }, userId: 'u1', status: 'READY' }
		});
		expect(db.albumMedia.createMany).not.toHaveBeenCalled();
		expect(db.album.update).not.toHaveBeenCalled();
	});

	it('inserts the links, skipping duplicates, and bumps the album when something was added', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1' });
		db.media.count.mockResolvedValue(2);
		db.albumMedia.createMany.mockResolvedValue({ count: 2 });

		expect(await addItems('u1', 'a1', ['m1', 'm2'])).toBe(2);
		expect(db.albumMedia.createMany).toHaveBeenCalledWith({
			data: [
				{ albumId: 'a1', mediaId: 'm1' },
				{ albumId: 'a1', mediaId: 'm2' }
			],
			skipDuplicates: true
		});
		expect(db.album.update).toHaveBeenCalledWith({
			where: { id: 'a1' },
			data: { updatedAt: expect.any(Date) }
		});
	});

	it('does not bump the album when every id was already present', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1' });
		db.media.count.mockResolvedValue(1);
		db.albumMedia.createMany.mockResolvedValue({ count: 0 });

		expect(await addItems('u1', 'a1', ['m1'])).toBe(0);
		expect(db.album.update).not.toHaveBeenCalled();
	});
});

describe('removeItems', () => {
	it("returns null when the album is not the owner's", async () => {
		db.album.findFirst.mockResolvedValue(null);

		expect(await removeItems('u1', 'a1', ['m1'])).toBeNull();
		expect(db.albumMedia.deleteMany).not.toHaveBeenCalled();
	});

	it('removes the links and bumps the album without touching the cover when it stays', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1', coverId: 'cover' });
		db.albumMedia.deleteMany.mockResolvedValue({ count: 1 });

		expect(await removeItems('u1', 'a1', ['m1'])).toBe(1);
		expect(db.albumMedia.deleteMany).toHaveBeenCalledWith({
			where: { albumId: 'a1', mediaId: { in: ['m1'] } }
		});
		expect(db.album.update).toHaveBeenCalledWith({
			where: { id: 'a1' },
			data: { updatedAt: expect.any(Date) }
		});
	});

	it('clears the cover when the cover item is removed', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1', coverId: 'm1' });
		db.albumMedia.deleteMany.mockResolvedValue({ count: 1 });

		await removeItems('u1', 'a1', ['m1', 'm2']);

		expect(db.album.update).toHaveBeenCalledWith({
			where: { id: 'a1' },
			data: { updatedAt: expect.any(Date), coverId: null }
		});
	});

	it('does nothing to the album when none of the ids were in it', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1', coverId: null });
		db.albumMedia.deleteMany.mockResolvedValue({ count: 0 });

		expect(await removeItems('u1', 'a1', ['m1'])).toBe(0);
		expect(db.album.update).not.toHaveBeenCalled();
	});
});
