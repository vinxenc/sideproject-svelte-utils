import { beforeEach, describe, expect, it, vi } from 'vitest';
import { softDelete } from '#lib/server/soft-delete.js';

const media = { update: vi.fn(), updateMany: vi.fn() };
const hook = softDelete({ Media: media });
const query = vi.fn();

type Call = Parameters<typeof hook>[0];
const run = (operation: string, args?: object, model = 'Media') =>
	hook({ model, operation, args, query } as unknown as Call);

beforeEach(() => {
	media.update.mockReset().mockResolvedValue({ id: 'm1' });
	media.updateMany.mockReset().mockResolvedValue({ count: 2 });
	query.mockReset().mockResolvedValue('result');
});

describe('softDelete', () => {
	it.each([
		'findFirst',
		'findFirstOrThrow',
		'findMany',
		'findUnique',
		'findUniqueOrThrow',
		'count',
		'aggregate',
		'groupBy',
		'update',
		'updateMany'
	])('hides deleted rows from %s', async (operation) => {
		await expect(run(operation, { where: { userId: 'u1' }, take: 5 })).resolves.toBe('result');

		expect(query).toHaveBeenCalledWith({ where: { deletedAt: null, userId: 'u1' }, take: 5 });
	});

	it('filters calls that have no arguments at all', async () => {
		await run('count');

		expect(query).toHaveBeenCalledWith({ where: { deletedAt: null } });
	});

	it('lets a caller ask for deleted rows, to list, restore or purge them', async () => {
		await run('findMany', { where: { deletedAt: { not: null } } });

		expect(query).toHaveBeenCalledWith({ where: { deletedAt: { not: null } } });
	});

	it('turns delete into an update that sets deletedAt, keeping select and the live-row filter', async () => {
		await expect(run('delete', { where: { id: 'm1' }, select: { id: true } })).resolves.toEqual({
			id: 'm1'
		});

		expect(media.update).toHaveBeenCalledWith({
			where: { deletedAt: null, id: 'm1' },
			select: { id: true },
			data: { deletedAt: expect.any(Date) }
		});
		expect(query).not.toHaveBeenCalled();
	});

	it('turns deleteMany into an updateMany that sets deletedAt on live rows only', async () => {
		await expect(run('deleteMany', { where: { userId: 'u1' } })).resolves.toEqual({ count: 2 });

		expect(media.updateMany).toHaveBeenCalledWith({
			where: { deletedAt: null, userId: 'u1' },
			data: { deletedAt: expect.any(Date) }
		});
		expect(query).not.toHaveBeenCalled();
	});

	it('soft-deletes every live row for a deleteMany without a filter', async () => {
		await run('deleteMany');

		expect(media.updateMany).toHaveBeenCalledWith({
			where: { deletedAt: null },
			data: { deletedAt: expect.any(Date) }
		});
	});

	it('passes creates through untouched', async () => {
		const args = { data: { name: 'a' } };

		await run('create', args);

		expect(query).toHaveBeenCalledWith(args);
	});

	it('leaves other models alone, deletes included', async () => {
		const args = { where: { id: 'x' } };

		await run('delete', args, 'AlbumMedia');
		await run('findMany', args, 'AlbumMedia');

		expect(media.update).not.toHaveBeenCalled();
		expect(query).toHaveBeenNthCalledWith(1, args);
		expect(query).toHaveBeenNthCalledWith(2, args);
	});
});
