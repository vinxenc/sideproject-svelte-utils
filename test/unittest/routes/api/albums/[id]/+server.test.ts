import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '../../../../../../src/routes/api/albums/[id]/+server.js';

const db = vi.hoisted(() => ({ album: { deleteMany: vi.fn() } }));
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

beforeEach(() => {
	db.album.deleteMany.mockReset().mockResolvedValue({ count: 1 });
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
