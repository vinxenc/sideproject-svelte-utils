import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '../../../../../../src/routes/api/media/[id]/+server.js';

const db = vi.hoisted(() => ({ media: { deleteMany: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof DELETE>[0];

function event(user: { id: string } | null = { id: 'u1' }, id = 'm1'): Ev {
	return {
		locals: { user },
		params: { id },
		request: new Request(`http://localhost/api/media/${id}`, { method: 'DELETE' })
	} as unknown as Ev;
}

beforeEach(() => {
	db.media.deleteMany.mockReset().mockResolvedValue({ count: 1 });
	vi.restoreAllMocks();
});

describe('DELETE /api/media/:id', () => {
	it('rejects signed-out callers with 401', async () => {
		await expect(DELETE(event(null))).rejects.toMatchObject({ status: 401 });
		expect(db.media.deleteMany).not.toHaveBeenCalled();
	});

	it('answers 404 when the caller has no READY item with that id', async () => {
		db.media.deleteMany.mockResolvedValue({ count: 0 });

		await expect(DELETE(event())).rejects.toMatchObject({ status: 404 });
		expect(db.media.deleteMany).toHaveBeenCalledWith({
			where: { id: 'm1', userId: 'u1', status: 'READY' }
		});
	});

	it('soft-deletes through the extended client and answers 204 uncached, leaving the stored files', async () => {
		const res = await DELETE(event());

		expect(db.media.deleteMany).toHaveBeenCalledWith({
			where: { id: 'm1', userId: 'u1', status: 'READY' }
		});
		expect(res.status).toBe(204);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});
});
