import { PrismaPg } from '@prisma/adapter-pg';
import { DATABASE_URL } from '$app/env/private';
import { PrismaClient } from './prisma/client.js';

// One client (and connection pool) for the whole server: auth and the media endpoints share it.
export const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: DATABASE_URL })
});
