// The one place environment variables are defined: the app (via #settings/env, server code only)
// and CLIs such as Prisma (prisma.config.ts) all read them from here.
// devDefault values match docker-compose.yml. envalid uses them only when NODE_ENV is set and isn't
// `production` (vite dev sets `development`), so local dev needs no .env; everywhere else, including
// vite preview, hosts and CLIs run without NODE_ENV, every variable must be set.
import 'dotenv/config'; // loads .env if present; real environment variables take precedence
import { cleanEnv, str, url } from 'envalid';

const load = () =>
	cleanEnv(process.env, {
		DATABASE_URL: url({
			devDefault: 'postgresql://utilities:utilities@localhost:5432/utilities',
			desc: 'Postgres connection string'
		}),
		BETTER_AUTH_SECRET: str({
			devDefault: 'dev-only-insecure-secret-change-me',
			desc: 'Signs sessions and tokens. Generate with `openssl rand -base64 32`.'
		}),
		S3_ENDPOINT: url({
			devDefault: 'http://localhost:9000',
			desc: 'S3-compatible API origin, path-style (bucket in the path)'
		}),
		S3_REGION: str({
			devDefault: 'us-east-1',
			desc: 'Region used to sign S3 requests (`auto` for R2)'
		}),
		S3_BUCKET: str({ devDefault: 'media', desc: 'Bucket for photos, videos and thumbnails' }),
		S3_ACCESS_KEY_ID: str({ devDefault: 'utilities', desc: 'S3 access key' }),
		S3_SECRET_ACCESS_KEY: str({ devDefault: 'utilities-secret', desc: 'S3 secret key' })
	});

type Env = ReturnType<typeof load>;
let cached: Env | undefined;

// Validated on first read, not on import: `vite build` imports server modules to analyse routes,
// and must not need runtime secrets. So read `env.X` inside functions, never at module top level.
export const env = new Proxy({} as Env, {
	get: (_, key) => (cached ??= load())[key as keyof Env]
});
