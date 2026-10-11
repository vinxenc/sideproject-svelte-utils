import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from '../../../../../src/routes/(app)/passwords/+page.server.js';
import { passwordRow } from '../../../helpers/passwords.js';

const db = vi.hoisted(() => ({ password: { findMany: vi.fn() } }));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

type Ev = Parameters<typeof load>[0];

function loadEvent(user: { id: string } | null = { id: 'u1' }) {
	const setHeaders = vi.fn();
	const event = {
		locals: { user },
		url: new URL('http://localhost/passwords'),
		params: {},
		setHeaders
	} as unknown as Ev;
	return { event, setHeaders };
}

beforeEach(() => {
	db.password.findMany.mockReset().mockResolvedValue([passwordRow()]);
});

describe('passwords page load', () => {
	it('redirects signed-out users to sign-in without reading the vault', async () => {
		const { event, setHeaders } = loadEvent(null);

		await expect(load(event)).rejects.toMatchObject({ status: 303, location: '/sign-in' });
		expect(db.password.findMany).not.toHaveBeenCalled();
		expect(setHeaders).not.toHaveBeenCalled();
	});

	it('returns the items without a password and sets no-store', async () => {
		const { event, setHeaders } = loadEvent();

		const data = await load(event);

		expect(data).toEqual({
			passwords: [
				{
					id: 'p1',
					name: 'GitHub',
					username: 'ada@example.com',
					type: 'APP',
					createdAt: '2024-05-01T10:00:00.000Z'
				}
			]
		});
		expect(JSON.stringify(data)).not.toContain('password"');
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, no-store' });
		expect(db.password.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { userId: 'u1' } })
		);
	});
});
