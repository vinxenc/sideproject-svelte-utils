import 'dotenv/config'; // loads .env if present; real environment variables take precedence
import { defineConfig } from 'prisma/config';

// The app's variables are defined in src/env.ts; the Prisma CLI runs outside SvelteKit, so it reads
// DATABASE_URL from the environment directly. Unset is fine for `prisma generate` (run on install);
// commands that connect (migrate, studio) report a missing or invalid URL themselves.
export default defineConfig({ datasource: { url: process.env.DATABASE_URL } });
