import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createPassword,
	deletePassword,
	itemSelect,
	listPasswords,
	revealPassword,
	toItem
} from '#lib/server/passwords.js';
import { passwordRow } from '../../helpers/passwords.js';

const db = vi.hoisted(() => ({
	password: {
		findMany: vi.fn(),
		create: vi.fn(),
		findFirst: vi.fn(),
		deleteMany: vi.fn()
	}
}));
vi.mock('#lib/server/db.js', () => ({ prisma: db }));

beforeEach(() => {
	db.password.findMany.mockReset().mockResolvedValue([]);
	db.password.create.mockReset().mockResolvedValue(passwordRow());
	db.password.findFirst.mockReset().mockResolvedValue(null);
	db.password.deleteMany.mockReset().mockResolvedValue({ count: 0 });
});

describe('itemSelect', () => {
	it('selects every column except the password', () => {
		expect(itemSelect).toEqual({
			id: true,
			name: true,
			username: true,
			type: true,
			createdAt: true
		});
		expect(itemSelect).not.toHaveProperty('password');
	});
});

describe('toItem', () => {
	it('maps the row to an item with an ISO createdAt and no password', () => {
		expect(toItem(passwordRow({ username: null, type: 'API_KEY' }))).toEqual({
			id: 'p1',
			name: 'GitHub',
			username: null,
			type: 'API_KEY',
			createdAt: '2024-05-01T10:00:00.000Z'
		});
	});
});

describe('listPasswords', () => {
	it('queries only the user’s rows, newest first, without the password column', async () => {
		db.password.findMany.mockResolvedValue([passwordRow()]);

		const items = await listPasswords('u1');

		expect(db.password.findMany).toHaveBeenCalledWith({
			where: { userId: 'u1' },
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: itemSelect
		});
		expect(items).toEqual([
			{
				id: 'p1',
				name: 'GitHub',
				username: 'ada@example.com',
				type: 'APP',
				createdAt: '2024-05-01T10:00:00.000Z'
			}
		]);
		expect(items[0]).not.toHaveProperty('password');
	});

	it('returns an empty list for a user with no entries', async () => {
		expect(await listPasswords('u1')).toEqual([]);
	});
});

describe('createPassword', () => {
	it('stores the input for the user and returns the item', async () => {
		const input = {
			name: 'Bank',
			username: null,
			password: '  pw  ',
			type: 'PIN_PLATFORM' as const
		};
		db.password.create.mockResolvedValue(passwordRow({ name: 'Bank', username: null }));

		const item = await createPassword('u1', input);

		expect(db.password.create).toHaveBeenCalledWith({
			data: { userId: 'u1', ...input },
			select: itemSelect
		});
		expect(item).toMatchObject({ name: 'Bank', username: null });
		expect(item).not.toHaveProperty('password');
	});
});

describe('revealPassword', () => {
	it('reads the password only for the user’s entry', async () => {
		db.password.findFirst.mockResolvedValue({ password: 'hunter2' });

		expect(await revealPassword('u1', 'p1')).toBe('hunter2');
		expect(db.password.findFirst).toHaveBeenCalledWith({
			where: { id: 'p1', userId: 'u1' },
			select: { password: true }
		});
	});

	it('returns null when the entry is missing or belongs to someone else', async () => {
		db.password.findFirst.mockResolvedValue(null);

		expect(await revealPassword('u1', 'other')).toBeNull();
	});
});

describe('deletePassword', () => {
	it('deletes only the user’s entry and reports whether one was removed', async () => {
		db.password.deleteMany.mockResolvedValue({ count: 1 });

		expect(await deletePassword('u1', 'p1')).toBe(true);
		expect(db.password.deleteMany).toHaveBeenCalledWith({ where: { id: 'p1', userId: 'u1' } });
	});

	it('returns false when nothing matched', async () => {
		db.password.deleteMany.mockResolvedValue({ count: 0 });

		expect(await deletePassword('u1', 'other')).toBe(false);
	});
});
