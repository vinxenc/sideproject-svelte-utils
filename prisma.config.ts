import { defineConfig } from 'prisma/config';
import { env } from './settings/env';

export default defineConfig({ datasource: { url: env.DATABASE_URL } });
