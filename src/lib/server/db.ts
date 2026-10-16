import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from '$app/env/private';
import { PrismaClient } from './prisma/client.js';
import { softDelete } from './soft-delete.js';

// One client (and connection pool) for the whole server: auth and the media endpoints share it.
// `prismaBase` sees soft-deleted rows and really deletes; use it for Better Auth, hard purges and ownership checks.
export const prismaBase = new PrismaClient({
	adapter: new PrismaPg({ connectionString: DATABASE_URL })
});

/** The app's client: media, albums and passwords are soft-deleted (src/lib/server/soft-delete.ts). */
export const prisma = prismaBase.$extends({
	name: 'soft-delete',
	query: {
		$allModels: {
			$allOperations: softDelete({
				Media: prismaBase.media,
				Album: prismaBase.album,
				Password: prismaBase.password
			})
		}
	}
});
