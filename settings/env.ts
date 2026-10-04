// Environment for tools that run outside SvelteKit, such as the Prisma CLI (prisma.config.ts).
// The app itself reads its variables through SvelteKit: src/env.ts → $app/env/private.
import 'dotenv/config'; // loads .env if present; real environment variables take precedence
import { cleanEnv, url } from 'envalid';

export const env = cleanEnv(process.env, {
	// Optional so `prisma generate` (run on install) works without a database.
	DATABASE_URL: url({ default: undefined, desc: 'Postgres connection string' })
});
