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
		init: { adapter: { opts: unknown } };
		constructor(init: { adapter: { opts: unknown } }) {
			this.init = init;
		}
	}
}));

describe('prisma', () => {
	it('connects through the pg adapter using DATABASE_URL', async () => {
		const { prisma } = await import('#lib/server/db.js');

		const { init } = prisma as unknown as { init: { adapter: { opts: unknown } } };
		expect(init.adapter.opts).toEqual({
			connectionString: 'postgresql://test:test@localhost:5432/test'
		});
	});
});
