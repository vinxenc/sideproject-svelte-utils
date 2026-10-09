import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from '../../../../../../../src/routes/api/albums/[id]/items/+server.js';

const db = vi.hoisted(() => ({
	album: { findFirst: vi.fn(), update: vi.fn() },
	media: { count: vi.fn() },
	albumMedia: { createMany: vi.fn(), deleteMany: vi.fn() },
	$transaction: vi.fn()
}));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof POST>[0];

function event(
	body: unknown,
	{ user = { id: 'u1' } as { id: string } | null, method = 'POST' } = {}
): Ev {
	const raw = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		locals: { user },
		url: new URL('http://localhost/api/albums/a1/items'),
		params: { id: 'a1' },
		request: new Request('http://localhost/api/albums/a1/items', { method, body: raw })
	} as unknown as Ev;
}

beforeEach(() => {
	db.album.findFirst.mockReset().mockResolvedValue({ id: 'a1', coverId: null });
	db.album.update.mockReset().mockResolvedValue({});
	db.media.count.mockReset().mockResolvedValue(2);
	db.albumMedia.createMany.mockReset().mockResolvedValue({ count: 2 });
	db.albumMedia.deleteMany.mockReset().mockResolvedValue({ count: 2 });
	db.$transaction.mockReset().mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
});

describe('POST /api/albums/:id/items', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(POST(event({ mediaIds: ['m1'] }, { user: null }))).rejects.toMatchObject({
			status: 401
		});
	});

	it.each([
		['not json', 'Invalid request'],
		[{ mediaIds: 'm1' }, 'Invalid media ids'],
		[{ mediaIds: [] }, 'No media ids']
	])('answers 400 for %j', async (body, message) => {
		await expect(POST(event(body))).rejects.toMatchObject({ status: 400, body: { message } });
	});

	it("answers 404 when the album is not the caller's", async () => {
		db.album.findFirst.mockResolvedValue(null);

		await expect(POST(event({ mediaIds: ['m1', 'm2'] }))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
		expect(db.albumMedia.createMany).not.toHaveBeenCalled();
	});

	it("answers 404 and inserts nothing when an id is not one of the caller's READY media", async () => {
		db.media.count.mockResolvedValue(1);

		await expect(POST(event({ mediaIds: ['m1', 'foreign'] }))).rejects.toMatchObject({
			status: 404
		});
		expect(db.albumMedia.createMany).not.toHaveBeenCalled();
	});

	it('answers the number added, with no-store', async () => {
		const res = await POST(event({ mediaIds: ['m1', 'm2', 'm1'] }));

		expect(db.albumMedia.createMany).toHaveBeenCalledWith({
			data: [
				{ albumId: 'a1', mediaId: 'm1' },
				{ albumId: 'a1', mediaId: 'm2' }
			],
			skipDuplicates: true
		});
		expect(await res.json()).toEqual({ added: 2 });
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('answers 0 and does not bump the album when everything was already in it', async () => {
		db.albumMedia.createMany.mockResolvedValue({ count: 0 });

		const res = await POST(event({ mediaIds: ['m1', 'm2'] }));

		expect(await res.json()).toEqual({ added: 0 });
		expect(db.album.update).not.toHaveBeenCalled();
	});
});

describe('DELETE /api/albums/:id/items', () => {
	const del = (body: unknown, user?: { id: string } | null) =>
		DELETE(event(body, { method: 'DELETE', user }));

	it('rejects signed-out callers with 401', async () => {
		await expect(del({ mediaIds: ['m1'] }, null)).rejects.toMatchObject({ status: 401 });
	});

	it('answers 400 for a malformed body', async () => {
		await expect(del('not json')).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid request' }
		});
	});

	it("answers 404 when the album is not the caller's", async () => {
		db.album.findFirst.mockResolvedValue(null);

		await expect(del({ mediaIds: ['m1'] })).rejects.toMatchObject({ status: 404 });
	});

	it('removes the links and answers the number removed', async () => {
		const res = await del({ mediaIds: ['m1'] });

		expect(db.albumMedia.deleteMany).toHaveBeenCalledWith({
			where: { albumId: 'a1', mediaId: { in: ['m1'] } }
		});
		expect(await res.json()).toEqual({ removed: 2 });
	});

	it('clears the cover when the cover item is among those removed', async () => {
		db.album.findFirst.mockResolvedValue({ id: 'a1', coverId: 'm1' });

		await del({ mediaIds: ['m1'] });

		expect(db.album.update).toHaveBeenCalledWith({
			where: { id: 'a1' },
			data: { updatedAt: expect.any(Date), coverId: null }
		});
	});
});
