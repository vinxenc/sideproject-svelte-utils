import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../../../../src/routes/api/media/+server.js';
import { mediaRow } from '../../../helpers/media.js';

const db = vi.hoisted(() => ({
	media: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() }
}));
const storage = vi.hoisted(() => ({
	presignPut: vi.fn(),
	remove: vi.fn()
}));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));
vi.mock('#lib/server/storage.js', () => storage);

type Ev = Parameters<typeof GET>[0];

const NOW = new Date('2024-06-01T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function getEvent(query = '', user: { id: string } | null = { id: 'u1' }): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/media${query}`),
		params: {},
		request: new Request(`http://localhost/api/media${query}`)
	} as unknown as Ev;
}

function postEvent(body: unknown, user: { id: string } | null = { id: 'u1' }): Ev {
	const raw = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		locals: { user },
		url: new URL('http://localhost/api/media'),
		params: {},
		request: new Request('http://localhost/api/media', { method: 'POST', body: raw })
	} as unknown as Ev;
}

/** A valid upload announcement, with overrides. */
function announce(overrides: Record<string, unknown> = {}) {
	return { name: 'beach.jpg', type: 'image/jpeg', size: 1234, ...overrides };
}

/** The `data` argument of the last `prisma.media.create` call. */
function createdData() {
	return db.media.create.mock.calls.at(-1)?.[0].data;
}

beforeEach(() => {
	vi.useFakeTimers({ now: NOW });
	db.media.findMany.mockReset().mockResolvedValue([]);
	db.media.deleteMany.mockReset().mockResolvedValue({ count: 0 });
	db.media.create.mockReset().mockResolvedValue(mediaRow({ id: 'm1' }));
	storage.presignPut
		.mockReset()
		.mockImplementation(async (key: string) => `https://s3.test/${key}?put`);
	storage.remove.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('GET /api/media', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(GET(getEvent('', null))).rejects.toMatchObject({
			status: 401,
			body: { message: 'Sign in required' }
		});
		expect(db.media.findMany).not.toHaveBeenCalled();
	});

	it('returns an empty first page and purges nothing when there are no stale rows', async () => {
		const res = await GET(getEvent());

		expect(db.media.findMany).toHaveBeenCalledTimes(2);
		expect(db.media.findMany).toHaveBeenNthCalledWith(1, {
			where: {
				userId: 'u1',
				status: 'PENDING',
				createdAt: { lt: new Date(NOW.getTime() - DAY) }
			},
			select: { id: true, userId: true }
		});
		expect(db.media.findMany).toHaveBeenNthCalledWith(2, {
			where: { userId: 'u1', status: 'READY' },
			orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
			take: 61
		});
		expect(storage.remove).not.toHaveBeenCalled();
		expect(db.media.deleteMany).not.toHaveBeenCalled();
		expect(await res.json()).toEqual({ items: [], nextCursor: null });
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('deletes stale uploads, objects first, then their rows', async () => {
		db.media.findMany
			.mockResolvedValueOnce([
				{ id: 's1', userId: 'u1' },
				{ id: 's2', userId: 'u1' }
			])
			.mockResolvedValueOnce([]);

		await GET(getEvent());

		expect(storage.remove).toHaveBeenCalledWith(
			'u1/s1/original',
			'u1/s1/thumb',
			'u1/s2/original',
			'u1/s2/thumb'
		);
		expect(db.media.deleteMany).toHaveBeenCalledWith({
			where: { id: { in: ['s1', 's2'] } }
		});
		const removeOrder = storage.remove.mock.invocationCallOrder[0];
		const deleteOrder = db.media.deleteMany.mock.invocationCallOrder[0];
		expect(removeOrder).toBeLessThan(deleteOrder);
	});

	it('still serves the page when purging stale uploads fails', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		db.media.findMany.mockResolvedValueOnce([{ id: 's1', userId: 'u1' }]).mockResolvedValueOnce([]);
		storage.remove.mockRejectedValueOnce(new Error('storage down'));

		const res = await GET(getEvent());

		expect(res.status).toBe(200);
		expect(spy).toHaveBeenCalledWith('Purging stale uploads failed', expect.any(Error));
		expect(db.media.deleteMany).not.toHaveBeenCalled();
	});

	it('pages from a valid cursor without purging, and URL-encodes it', async () => {
		const t = Date.parse('2024-05-01T10:00:00Z');
		const cursor = `${t}_m9`;

		await GET(getEvent(`?cursor=${encodeURIComponent(cursor)}`));

		expect(db.media.findMany).toHaveBeenCalledTimes(1);
		expect(db.media.findMany).toHaveBeenCalledWith({
			where: {
				userId: 'u1',
				status: 'READY',
				OR: [{ takenAt: { lt: new Date(t) } }, { takenAt: new Date(t), id: { lt: 'm9' } }]
			},
			orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
			take: 61
		});
	});

	it.each(['garbage', '99999999999999999999_x'])('rejects cursor %s with 400', async (cursor) => {
		await expect(GET(getEvent(`?cursor=${encodeURIComponent(cursor)}`))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid cursor' }
		});
		expect(db.media.findMany).not.toHaveBeenCalled();
	});

	it('accepts a negative timestamp in the cursor', async () => {
		const res = await GET(getEvent(`?cursor=${encodeURIComponent('-5_x')}`));

		expect(res.status).toBe(200);
		expect(db.media.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					userId: 'u1',
					status: 'READY',
					OR: [{ takenAt: { lt: new Date(-5) } }, { takenAt: new Date(-5), id: { lt: 'x' } }]
				}
			})
		);
	});

	it('returns 60 items and a cursor to the 60th when there is one more row', async () => {
		const base = Date.parse('2024-05-01T10:00:00Z');
		const rows = Array.from({ length: 61 }, (_, i) =>
			mediaRow({ id: `m${i}`, takenAt: new Date(base - i * 1000) })
		);
		db.media.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);

		const res = await GET(getEvent());
		const page = (await res.json()) as {
			items: { id: string; takenAt: string }[];
			nextCursor: string;
		};

		expect(page.items).toHaveLength(60);
		expect(page.items[0]).toEqual({
			id: 'm0',
			kind: 'IMAGE',
			name: 'beach.jpg',
			width: 1600,
			height: 1200,
			duration: null,
			takenAt: new Date(base).toISOString(),
			hasThumb: true
		});
		expect(page.nextCursor).toBe(`${rows[59].takenAt.getTime()}_m59`);
	});

	it('ends the feed when exactly 60 rows come back', async () => {
		const rows = Array.from({ length: 60 }, (_, i) => mediaRow({ id: `m${i}` }));
		db.media.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows);

		const res = await GET(getEvent());

		expect(((await res.json()) as { items: unknown[]; nextCursor: unknown }).nextCursor).toBeNull();
	});
});

describe('POST /api/media', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(POST(postEvent(announce(), null))).rejects.toMatchObject({ status: 401 });
		expect(db.media.create).not.toHaveBeenCalled();
	});

	it.each(['not json', 'null', '5'])('rejects the body %j with 400', async (body) => {
		await expect(POST(postEvent(body))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid request' }
		});
	});

	it.each([
		['missing', {}],
		['non-string', { name: 5 }],
		['blank', { name: '   ' }]
	])('rejects a file name that is %s with 400', async (_label, overrides) => {
		await expect(
			POST(postEvent(announce({ name: undefined, ...overrides })))
		).rejects.toMatchObject({
			status: 400,
			body: { message: 'Missing file name' }
		});
	});

	it('trims the name and cuts it to 255 characters', async () => {
		await POST(postEvent(announce({ name: `  ${'a'.repeat(300)}  `, type: 'image/jpeg' })));

		expect(createdData().name).toBe('a'.repeat(255));
	});

	it.each(['10', 1.5, undefined])('rejects the size %j with 400', async (size) => {
		await expect(POST(postEvent(announce({ size })))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid file size' }
		});
	});

	it('takes the content type from the extension when the browser reports none', async () => {
		await POST(postEvent(announce({ name: 'a.jpg', type: 5 })));

		expect(createdData().contentType).toBe('image/jpeg');
	});

	it('rejects unsupported types with 400', async () => {
		await expect(
			POST(postEvent(announce({ name: 'doc.pdf', type: 'application/pdf' })))
		).rejects.toMatchObject({ status: 400, body: { message: 'Unsupported file type' } });
	});

	it('rejects an empty file with 400', async () => {
		await expect(POST(postEvent(announce({ size: 0 })))).rejects.toMatchObject({
			status: 400,
			body: { message: 'The file is empty' }
		});
	});

	it('creates an IMAGE row and returns a 201 ticket with the original URL', async () => {
		const res = await POST(
			postEvent(
				announce({
					width: 1920,
					height: 1080,
					takenAt: '2024-05-01T10:00:00.000Z'
				})
			)
		);

		expect(db.media.create).toHaveBeenCalledWith({
			data: {
				userId: 'u1',
				kind: 'IMAGE',
				name: 'beach.jpg',
				contentType: 'image/jpeg',
				size: 1234,
				width: 1920,
				height: 1080,
				duration: null,
				takenAt: new Date('2024-05-01T10:00:00.000Z')
			}
		});
		expect(res.status).toBe(201);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual({
			id: 'm1',
			contentType: 'image/jpeg',
			original: 'https://s3.test/u1/m1/original?put',
			thumb: null
		});
		expect(storage.presignPut).toHaveBeenCalledTimes(1);
		expect(storage.presignPut).toHaveBeenCalledWith('u1/m1/original', 'image/jpeg', 1234);
	});

	it.each([0, -1, 1.5, 100_001, '100'])('drops the dimension %j', async (value) => {
		await POST(postEvent(announce({ width: value, height: value })));

		expect(createdData()).toMatchObject({ width: null, height: null });
	});

	it('keeps a dimension of exactly 100000', async () => {
		await POST(postEvent(announce({ width: 100_000, height: 100_000 })));

		expect(createdData()).toMatchObject({ width: 100_000, height: 100_000 });
	});

	it('ignores a duration on an IMAGE', async () => {
		await POST(postEvent(announce({ duration: 5 })));

		expect(createdData().duration).toBeNull();
	});

	it('keeps a VIDEO duration', async () => {
		const res = await POST(
			postEvent({ name: 'clip.mp4', type: 'video/mp4', size: 99, duration: 12.5 })
		);

		expect(createdData()).toMatchObject({
			kind: 'VIDEO',
			contentType: 'video/mp4',
			duration: 12.5
		});
		expect(storage.presignPut).toHaveBeenCalledWith('u1/m1/original', 'video/mp4', 99);
		expect((await res.json()) as unknown).toMatchObject({ contentType: 'video/mp4' });
	});

	it.each([
		['negative', -1],
		['infinite', Infinity],
		['too long', 1_000_001],
		['a string', 'x']
	])('drops a VIDEO duration that is %s', async (_label, duration) => {
		await POST(postEvent({ name: 'clip.mp4', type: 'video/mp4', size: 99, duration }));

		expect(createdData().duration).toBeNull();
	});

	it('keeps a VIDEO duration of zero', async () => {
		await POST(postEvent({ name: 'clip.mp4', type: 'video/mp4', size: 99, duration: 0 }));

		expect(createdData().duration).toBe(0);
	});

	it('keeps a past takenAt', async () => {
		await POST(postEvent(announce({ takenAt: '2024-05-01T10:00:00.000Z' })));

		expect(createdData().takenAt).toEqual(new Date('2024-05-01T10:00:00.000Z'));
	});

	it.each([
		['an unparseable date', 'not a date'],
		['a date two days ahead', new Date(NOW.getTime() + 2 * DAY).toISOString()],
		['a non-string', 123]
	])('replaces takenAt that is %s with now', async (_label, takenAt) => {
		await POST(postEvent(announce({ takenAt })));

		expect(createdData().takenAt).toEqual(NOW);
	});

	it('keeps a takenAt an hour ahead, since clocks drift', async () => {
		const soon = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
		await POST(postEvent(announce({ takenAt: soon })));

		expect(createdData().takenAt).toEqual(new Date(soon));
	});

	it('presigns a thumbnail when one of an acceptable size is announced', async () => {
		const res = await POST(postEvent(announce({ thumb: 5000 })));

		expect(storage.presignPut).toHaveBeenCalledTimes(2);
		expect(storage.presignPut).toHaveBeenLastCalledWith('u1/m1/thumb', 'image/jpeg', 5000);
		expect(await res.json()).toMatchObject({ thumb: 'https://s3.test/u1/m1/thumb?put' });
	});

	it.each([
		['zero', 0],
		['too big', 2 * 1024 * 1024 + 1],
		['fractional', 1.5],
		['missing', undefined]
	])('does not presign a thumbnail that is %s', async (_label, thumb) => {
		const res = await POST(postEvent(announce({ thumb })));

		expect(storage.presignPut).toHaveBeenCalledTimes(1);
		expect(await res.json()).toMatchObject({ thumb: null });
	});

	it('accepts a thumbnail of exactly the maximum size', async () => {
		await POST(postEvent(announce({ thumb: 2 * 1024 * 1024 })));

		expect(storage.presignPut).toHaveBeenCalledTimes(2);
	});
});
