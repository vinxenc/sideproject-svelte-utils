import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handle } from '../../src/hooks.server.js';

const session = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock('#lib/server/session.js', () => session);

const U = { id: 'u1', name: 'Ann', email: 'ann@example.com' };

type HandleArgs = Parameters<typeof handle>[0];

function run(pathname: string, locals: Record<string, unknown>) {
	const response = new Response('ok');
	const resolve = vi.fn(async () => response);
	const event = { url: new URL(`http://localhost${pathname}`), locals };
	const result = handle({ event, resolve } as unknown as HandleArgs);
	return { result, response, resolve, event };
}

beforeEach(() => {
	session.getUser.mockReset().mockResolvedValue(U);
});

describe('handle', () => {
	it('leaves Better Auth requests alone and does not look the session up', async () => {
		const sentinel = { id: 'sentinel' };
		const locals: { user?: unknown } = { user: sentinel };
		const { result, response, resolve } = run('/api/auth/sign-in', locals);

		await expect(result).resolves.toBe(response);
		expect(session.getUser).not.toHaveBeenCalled();
		expect(locals.user).toBe(sentinel);
		expect(resolve).toHaveBeenCalledTimes(1);
	});

	it('fills locals.user from the session for every other request', async () => {
		const locals: { user?: unknown } = {};
		const { result, response, resolve, event } = run('/dashboard', locals);

		await expect(result).resolves.toBe(response);
		expect(session.getUser).toHaveBeenCalledWith(event);
		expect(locals.user).toEqual(U);
		expect(resolve).toHaveBeenCalledTimes(1);
	});
});
