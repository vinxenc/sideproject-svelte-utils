import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../../../../../../src/routes/api/passwords/[id]/reveal/+server.js';

const db = vi.hoisted(() => ({ password: { findFirst: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof POST>[0];

function revealEvent(id: string, user: { id: string } | null = { id: 'u1' }): Ev {
	return {
		locals: { user },
		url: new URL(`http://localhost/api/passwords/${id}/reveal`),
		params: { id },
		request: new Request(`http://localhost/api/passwords/${id}/reveal`, { method: 'POST' })
	} as unknown as Ev;
}

beforeEach(() => {
	db.password.findFirst.mockReset().mockResolvedValue({ password: 'hunter2' });
});

describe('POST /api/passwords/[id]/reveal', () => {
	it('rejects signed-out callers with 401 and reads nothing', async () => {
		await expect(POST(revealEvent('p1', null))).rejects.toMatchObject({
			status: 401,
			body: { message: 'Sign in required' }
		});
		expect(db.password.findFirst).not.toHaveBeenCalled();
	});

	it('answers 200 with the password and no-store, scoped to the user', async () => {
		const res = await POST(revealEvent('p1'));

		expect(db.password.findFirst).toHaveBeenCalledWith({
			where: { id: 'p1', userId: 'u1' },
			select: { password: true }
		});
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual({ password: 'hunter2' });
	});

	it('answers 404 when the entry is missing or not the user’s', async () => {
		db.password.findFirst.mockResolvedValue(null);

		await expect(POST(revealEvent('other'))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Not found' }
		});
	});
});
