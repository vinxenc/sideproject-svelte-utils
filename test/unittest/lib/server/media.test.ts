import { describe, expect, it, vi } from 'vitest';
import {
	decodeCursor,
	encodeCursor,
	listMedia,
	MAX_THUMB_BYTES,
	MEDIA_PAGE_SIZE,
	NO_STORE,
	originalKey,
	thumbKey,
	toItem
} from '#lib/server/media.js';
import { mediaRow } from '../../helpers/media.js';
import { thrown } from '../../helpers/thrown.js';

const db = vi.hoisted(() => ({ media: { findMany: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

describe('media helpers', () => {
	it('builds the object keys under the owner prefix', () => {
		const row = mediaRow({ id: 'm1', userId: 'u1' });

		expect(originalKey(row)).toBe('u1/m1/original');
		expect(thumbKey(row)).toBe('u1/m1/thumb');
	});

	it('caps thumbnails at 2 MiB', () => {
		expect(MAX_THUMB_BYTES).toBe(2 * 1024 * 1024);
	});

	it('marks responses as private and not storable', () => {
		expect(NO_STORE).toEqual({ 'cache-control': 'private, no-store' });
	});

	it('maps a row to the public item, with takenAt as ISO text', () => {
		const item = toItem(
			mediaRow({
				id: 'v1',
				kind: 'VIDEO',
				name: 'clip.mp4',
				width: 1280,
				height: 720,
				duration: 4.5,
				takenAt: new Date('2024-05-01T10:00:00.000Z'),
				hasThumb: false,
				userId: 'u1',
				size: 9,
				status: 'READY',
				contentType: 'video/mp4'
			})
		);

		expect(item).toEqual({
			id: 'v1',
			kind: 'VIDEO',
			name: 'clip.mp4',
			width: 1280,
			height: 720,
			duration: 4.5,
			takenAt: '2024-05-01T10:00:00.000Z',
			hasThumb: false
		});
		expect(Object.keys(item)).toHaveLength(8);
	});
});

describe('media cursors', () => {
	const AT = new Date('2024-05-01T10:00:00.000Z');

	it('encodes a position as its time in ms and the id', () => {
		expect(encodeCursor(AT, 'm1')).toBe(`${AT.getTime()}_m1`);
	});

	it('decodes what it encoded, keeping ids that contain underscores', () => {
		expect(decodeCursor(`${AT.getTime()}_a_b`)).toEqual({ at: AT, id: 'a_b' });
	});

	it('decodes negative times (before 1970)', () => {
		expect(decodeCursor('-1000_m1')).toEqual({ at: new Date(-1000), id: 'm1' });
	});

	it.each(['', 'abc', '123', '_m1', '12_', 'x_m1', `${'9'.repeat(20)}_m1`])(
		'rejects the malformed cursor %j with 400',
		(value) => {
			expect(thrown(() => decodeCursor(value))).toMatchObject({
				status: 400,
				body: { message: 'Invalid cursor' }
			});
		}
	);
});

describe('listMedia', () => {
	const row = (id: string, at: string) => mediaRow({ id, takenAt: new Date(at) });

	it('pages READY media matching the filter, newest first, with no cursor on the first page', async () => {
		db.media.findMany.mockResolvedValue([row('m2', '2024-05-02T00:00:00Z')]);

		const page = await listMedia({ userId: 'u1', status: 'READY' }, null);

		expect(db.media.findMany).toHaveBeenCalledWith({
			where: { userId: 'u1', status: 'READY' },
			orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
			take: MEDIA_PAGE_SIZE + 1
		});
		expect(page.items.map((i) => i.id)).toEqual(['m2']);
		expect(page.nextCursor).toBeNull();
	});

	it('adds the (takenAt, id) keyset condition when given a cursor', async () => {
		const at = new Date('2024-05-01T10:00:00.000Z');
		db.media.findMany.mockResolvedValue([]);

		await listMedia({ status: 'READY' }, { at, id: 'm5' });

		expect(db.media.findMany).toHaveBeenCalledWith({
			where: {
				status: 'READY',
				OR: [{ takenAt: { lt: at } }, { takenAt: at, id: { lt: 'm5' } }]
			},
			orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
			take: MEDIA_PAGE_SIZE + 1
		});
	});

	it('returns a next cursor from the last item when a further row exists, and drops the extra row', async () => {
		const rows = Array.from({ length: MEDIA_PAGE_SIZE + 1 }, (_, i) =>
			row(`m${i}`, `2024-05-01T10:${String(i % 60).padStart(2, '0')}:00Z`)
		);
		db.media.findMany.mockResolvedValue(rows);

		const page = await listMedia({ userId: 'u1' }, null);

		expect(page.items).toHaveLength(MEDIA_PAGE_SIZE);
		const last = rows[MEDIA_PAGE_SIZE - 1];
		expect(page.nextCursor).toBe(encodeCursor(last.takenAt, last.id));
	});
});
