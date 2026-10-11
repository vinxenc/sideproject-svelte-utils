import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../../../../src/routes/api/passwords/+server.js';
import { passwordRow } from '../../../helpers/passwords.js';

const db = vi.hoisted(() => ({ password: { create: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof POST>[0];

function postEvent(body: unknown, user: { id: string } | null = { id: 'u1' }): Ev {
	const raw = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		locals: { user },
		url: new URL('http://localhost/api/passwords'),
		params: {},
		request: new Request('http://localhost/api/passwords', { method: 'POST', body: raw })
	} as unknown as Ev;
}

const valid = { name: 'GitHub', type: 'APP', username: 'ada@example.com', password: 'hunter2' };

beforeEach(() => {
	db.password.create.mockReset().mockResolvedValue(passwordRow());
});

describe('POST /api/passwords', () => {
	it('rejects signed-out callers with 401 and writes nothing', async () => {
		await expect(POST(postEvent(valid, null))).rejects.toMatchObject({
			status: 401,
			body: { message: 'Sign in required' }
		});
		expect(db.password.create).not.toHaveBeenCalled();
	});

	it.each(['not json', '[]', '"text"', '5', ''])(
		'answers 400 Invalid request for %j',
		async (body) => {
			await expect(POST(postEvent(body))).rejects.toMatchObject({
				status: 400,
				body: { message: 'Invalid request' }
			});
			expect(db.password.create).not.toHaveBeenCalled();
		}
	);

	it.each([
		[{ ...valid, name: '  ' }, 'Enter a name'],
		[{ ...valid, name: 'a'.repeat(101) }, 'Names can be up to 100 characters'],
		[{ ...valid, name: 'a\nb' }, "Names can't contain line breaks"],
		[{ ...valid, type: 'LOGIN' }, 'Choose a type'],
		[{ ...valid, username: 3 }, 'Invalid username'],
		[{ ...valid, username: 'u'.repeat(255) }, 'Usernames can be up to 254 characters'],
		[{ ...valid, password: '' }, 'Enter a password'],
		[{ ...valid, password: 'a\u0000b' }, "Passwords can't contain null characters"],
		[{ ...valid, password: 'p'.repeat(1025) }, 'Passwords can be up to 1024 characters']
	])('answers 400 with the field message for %j', async (body, message) => {
		await expect(POST(postEvent(body))).rejects.toMatchObject({ status: 400, body: { message } });
		expect(db.password.create).not.toHaveBeenCalled();
	});

	it('creates the entry with the checked input and answers 201 with no-store', async () => {
		db.password.create.mockResolvedValue(passwordRow());

		const res = await POST(
			postEvent({ ...valid, name: '  GitHub  ', username: '   ', password: '  pw  ' })
		);

		expect(db.password.create).toHaveBeenCalledWith({
			data: { userId: 'u1', name: 'GitHub', username: null, password: '  pw  ', type: 'APP' },
			select: expect.any(Object)
		});
		expect(res.status).toBe(201);
		expect(res.headers.get('cache-control')).toBe('private, no-store');
		expect(await res.json()).toEqual({
			id: 'p1',
			name: 'GitHub',
			username: 'ada@example.com',
			type: 'APP',
			createdAt: '2024-05-01T10:00:00.000Z'
		});
	});
});
