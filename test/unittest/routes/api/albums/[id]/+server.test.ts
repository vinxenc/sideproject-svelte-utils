import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toSummary } from '#lib/server/albums.js';
import { DELETE, PATCH } from '../../../../../../src/routes/api/albums/[id]/+server.js';
import { albumRow } from '../../../../helpers/albums.js';

const db = vi.hoisted(() => ({
	album: { deleteMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() }
}));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof DELETE>[0];

function event(user: { id: string } | null = { id: 'u1' }, id = 'a1'): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/albums/${id}`),
		params: { id },
		request: new Request(`http://localhost/api/albums/${id}`, { method: 'DELETE' })
	} as unknown as Ev;
}

/** A PATCH event. A string body is sent as it is (for non-JSON bodies); anything else is JSON-encoded. */
function patchEvent(body: unknown, user: { id: string } | null = { id: 'u1' }, id = 'a1') {
	const raw = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		locals: { user },
		url: new URL(`http://localhost/api/albums/${id}`),
		params: { id },
		request: new Request(`http://localhost/api/albums/${id}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: raw
		})
	} as unknown as Parameters<typeof PATCH>[0];
}

beforeEach(() => {
	db.album.deleteMany.mockReset().mockResolvedValue({ count: 1 });
	db.album.updateMany.mockReset().mockResolvedValue({ count: 1 });
	db.album.findFirst.mockReset().mockResolvedValue(albumRow({ name: 'New' }));
});

describe('DELETE /api/albums/:id', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(DELETE(event(null))).rejects.toMatchObject({ status: 401 });
		expect(db.album.deleteMany).not.toHaveBeenCalled();
	});

	it("deletes the owner's album and answers 204 with no body", async () => {
		const res = await DELETE(event());

		expect(db.album.deleteMany).toHaveBeenCalledWith({ where: { id: 'a1', userId: 'u1' } });
		expect(res.status).toBe(204);
		expect(res.body).toBeNull();
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it("answers 404 for an album that is not the caller's, or does not exist", async () => {
		db.album.deleteMany.mockResolvedValue({ count: 0 });

		await expect(DELETE(event({ id: 'u2' }))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
	});
});

describe('PATCH /api/albums/:id', () => {
	it('rejects signed-out callers with 401, without touching the database', async () => {
		await expect(PATCH(patchEvent({ name: 'New' }, null))).rejects.toMatchObject({ status: 401 });
		expect(db.album.updateMany).not.toHaveBeenCalled();
	});

	it('rejects a body that is not JSON with 400', async () => {
		await expect(PATCH(patchEvent('{'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid request' }
		});
		expect(db.album.updateMany).not.toHaveBeenCalled();
	});

	it('rejects a JSON null body with 400', async () => {
		await expect(PATCH(patchEvent('null'))).rejects.toMatchObject({
			status: 400,
			body: { message: 'Invalid request' }
		});
	});

	it('rejects an invalid name with the checkAlbumName message, without touching the database', async () => {
		const cases: [unknown, string][] = [
			[{}, 'Enter an album name'],
			[{ name: '   ' }, 'Enter an album name'],
			[{ name: 'x'.repeat(101) }, 'Album names can be up to 100 characters'],
			[{ name: 'a\nb' }, "Album names can't contain line breaks"]
		];
		for (const [body, message] of cases) {
			await expect(PATCH(patchEvent(body))).rejects.toMatchObject({
				status: 400,
				body: { message }
			});
		}
		expect(db.album.updateMany).not.toHaveBeenCalled();
	});

	it("answers 404 for an album that is not the caller's, or does not exist", async () => {
		db.album.updateMany.mockResolvedValue({ count: 0 });

		await expect(PATCH(patchEvent({ name: 'New' }, { id: 'u2' }))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
	});

	it('renames with the trimmed name and answers the summary, uncached', async () => {
		const res = await PATCH(patchEvent({ name: '  New  ' }));

		expect(db.album.updateMany).toHaveBeenCalledWith({
			where: { id: 'a1', userId: 'u1' },
			data: { name: 'New' }
		});
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual(toSummary(albumRow({ name: 'New' }) as never));
	});
});
