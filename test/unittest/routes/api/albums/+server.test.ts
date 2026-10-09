import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../../../../src/routes/api/albums/+server.js';
import { albumRow } from '../../../helpers/albums.js';

const db = vi.hoisted(() => ({ album: { findMany: vi.fn(), create: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof GET>[0];

function getEvent(query = '', user: { id: string } | null = { id: 'u1' }): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/albums${query}`),
		params: {},
		request: new Request(`http://localhost/api/albums${query}`)
	} as unknown as Ev;
}

function postEvent(body: unknown, user: { id: string } | null = { id: 'u1' }): Ev {
	const raw = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		locals: { user },
		url: new URL('http://localhost/api/albums'),
		params: {},
		request: new Request('http://localhost/api/albums', { method: 'POST', body: raw })
	} as unknown as Ev;
}

beforeEach(() => {
	db.album.findMany.mockReset().mockResolvedValue([]);
	db.album.create.mockReset().mockResolvedValue(albumRow({ id: 'a1', name: 'Trip' }));
});

describe('GET /api/albums', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(GET(getEvent('', null))).rejects.toMatchObject({
			status: 401,
			body: { message: 'Sign in required' }
		});
		expect(db.album.findMany).not.toHaveBeenCalled();
	});

	it('answers the first page of 30 with no-store', async () => {
		const res = await GET(getEvent());

		expect(db.album.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ take: 31, where: { userId: 'u1' } })
		);
		expect(await res.json()).toEqual({ items: [], nextCursor: null });
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('honours limit and cursor', async () => {
		const at = new Date(5000);

		await GET(getEvent(`?limit=2&cursor=5000_a9`));

		expect(db.album.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				take: 3,
				where: {
					userId: 'u1',
					OR: [{ updatedAt: { lt: at } }, { updatedAt: at, id: { lt: 'a9' } }]
				}
			})
		);
	});

	it.each(['?limit=0', '?limit=61', '?limit=abc'])('answers 400 for %s', async (query) => {
		await expect(GET(getEvent(query))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid limit' }
		});
	});

	it('answers 400 for a malformed cursor', async () => {
		await expect(GET(getEvent('?cursor=zzz'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid cursor' }
		});
	});
});

describe('POST /api/albums', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(POST(postEvent({ name: 'Trip' }, null))).rejects.toMatchObject({ status: 401 });
		expect(db.album.create).not.toHaveBeenCalled();
	});

	it('rejects a body that is not an object with 400', async () => {
		await expect(POST(postEvent('"Trip"'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid request' }
		});
		await expect(POST(postEvent('not json'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid request' }
		});
	});

	it.each([
		[{}, 'Enter an album name'],
		[{ name: '   ' }, 'Enter an album name'],
		[{ name: 'a\nb' }, "Album names can't contain line breaks"],
		[{ name: 'x'.repeat(101) }, 'Album names can be up to 100 characters']
	])('answers 400 for %j with the name error', async (body, message) => {
		await expect(POST(postEvent(body))).rejects.toMatchObject({
			status: 400,
			body: { message }
		});
		expect(db.album.create).not.toHaveBeenCalled();
	});

	it('creates the trimmed album and answers 201 with no-store', async () => {
		const res = await POST(postEvent({ name: '  Trip  ' }));

		expect(db.album.create).toHaveBeenCalledWith(
			expect.objectContaining({ data: { userId: 'u1', name: 'Trip' } })
		);
		expect(res.status).toBe(201);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toMatchObject({ id: 'a1', name: 'Trip', count: 0, previews: [] });
	});
});
