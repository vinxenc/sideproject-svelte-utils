import { describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/adapter-pg', () => ({
	PrismaPg: class {
		opts: unknown;
		constructor(opts: unknown) {
			this.opts = opts;
		}
	}
}));
vi.mock('#lib/server/prisma/client.js', () => ({
	PrismaClient: class {
		media = { name: 'media' };
		album = { name: 'album' };
		password = { name: 'password' };
		init: { adapter: { opts: unknown } };
		constructor(init: { adapter: { opts: unknown } }) {
			this.init = init;
		}
		$extends(extension: unknown) {
			return { extension };
		}
	}
}));

describe('prisma', () => {
	it('connects through the pg adapter using DATABASE_URL', async () => {
		const { prismaBase } = await import('#lib/server/db.js');

		const { init } = prismaBase as unknown as { init: { adapter: { opts: unknown } } };
		expect(init.adapter.opts).toEqual({
			connectionString: 'postgresql://test:test@localhost:5432/test'
		});
	});

	it('soft-deletes media, albums and passwords on the extended client', async () => {
		const { prisma, prismaBase } = await import('#lib/server/db.js');

		const { extension } = prisma as unknown as {
			extension: { name: string; query: { $allModels: { $allOperations: unknown } } };
		};
		expect(extension.name).toBe('soft-delete');
		expect(extension.query.$allModels.$allOperations).toBeTypeOf('function');
		expect(prisma).not.toBe(prismaBase);
	});
});
