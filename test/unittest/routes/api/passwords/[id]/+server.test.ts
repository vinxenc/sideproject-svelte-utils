import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '../../../../../../src/routes/api/passwords/[id]/+server.js';

const db = vi.hoisted(() => ({ password: { deleteMany: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof DELETE>[0];

function deleteEvent(id: string, user: { id: string } | null = { id: 'u1' }): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/passwords/${id}`),
		params: { id },
		request: new Request(`http://localhost/api/passwords/${id}`, { method: 'DELETE' })
	} as unknown as Ev;
}

beforeEach(() => {
	db.password.deleteMany.mockReset().mockResolvedValue({ count: 1 });
});

describe('DELETE /api/passwords/[id]', () => {
	it('rejects signed-out callers with 401 and deletes nothing', async () => {
		await expect(DELETE(deleteEvent('p1', null))).rejects.toMatchObject({
			status: 401,
			body: { message: 'Sign in required' }
		});
		expect(db.password.deleteMany).not.toHaveBeenCalled();
	});

	it('answers 204 with no body and no-store', async () => {
		const res = await DELETE(deleteEvent('p1'));

		expect(db.password.deleteMany).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'u1' } });
		expect(res.status).toBe(204);
		expect(res.body).toBeNull();
		expect(res.headers.get('cache-control')).toBe('private, no-store');
	});

	it('answers 404 when the entry is missing or not the user’s', async () => {
		db.password.deleteMany.mockResolvedValue({ count: 0 });

		await expect(DELETE(deleteEvent('other'))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
	});
});
