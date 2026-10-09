import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../../../../../../src/routes/api/albums/[id]/media/+server.js';
import { mediaRow } from '../../../../../helpers/media.js';

const db = vi.hoisted(() => ({
	album: { findFirst: vi.fn() },
	media: { findMany: vi.fn() }
}));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof GET>[0];

function event(query = '', user: { id: string } | null = { id: 'u1' }, id = 'a1'): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/albums/${id}/media${query}`),
		params: { id },
		request: new Request(`http://localhost/api/albums/${id}/media${query}`)
	} as unknown as Ev;
}

beforeEach(() => {
	db.album.findFirst.mockReset().mockResolvedValue({ id: 'a1' });
	db.media.findMany.mockReset().mockResolvedValue([mediaRow({ id: 'm1' })]);
});

describe('GET /api/albums/:id/media', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(GET(event('', null))).rejects.toMatchObject({ status: 401 });
		expect(db.album.findFirst).not.toHaveBeenCalled();
	});

	it("answers 404 when the album is not the caller's, without reading media", async () => {
		db.album.findFirst.mockResolvedValue(null);

		await expect(GET(event())).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
		expect(db.media.findMany).not.toHaveBeenCalled();
	});

	it("answers the album's READY media, newest first, filtered to the album", async () => {
		const res = await GET(event());

		expect(db.album.findFirst).toHaveBeenCalledWith({
			where: { id: 'a1', userId: 'u1' },
			select: { id: true }
		});
		expect(db.media.findMany).toHaveBeenCalledWith({
			where: { userId: 'u1', status: 'READY', albums: { some: { albumId: 'a1' } } },
			orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
			take: 61
		});
		expect(await res.json()).toEqual({
			items: [
				{
					id: 'm1',
					kind: 'IMAGE',
					name: 'beach.jpg',
					width: 1600,
					height: 1200,
					duration: null,
					takenAt: '2024-05-01T10:00:00.000Z',
					hasThumb: true
				}
			],
			nextCursor: null
		});
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('passes a cursor through to the keyset query', async () => {
		await GET(event('?cursor=1714557600000_m9'));

		expect(db.media.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					OR: [
						{ takenAt: { lt: new Date(1714557600000) } },
						{ takenAt: new Date(1714557600000), id: { lt: 'm9' } }
					]
				})
			})
		);
	});

	it('answers 400 for a malformed cursor', async () => {
		await expect(GET(event('?cursor=zzz'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid cursor' }
		});
	});
});
