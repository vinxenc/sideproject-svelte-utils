import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string; local: see docker-compose.yml'
	},
	BETTER_AUTH_SECRET: {
		description: 'Signs sessions and tokens. Generate with `openssl rand -base64 32`.'
	},
	S3_ENDPOINT: {
		description:
			'S3-compatible API origin, path-style (bucket in the path). Local: RustFS from docker-compose.yml.'
	},
	S3_REGION: {
		description: 'Region used to sign S3 requests (`auto` for R2, `us-east-1` for RustFS).'
	},
	S3_BUCKET: {
		description: 'Bucket that holds uploaded photos, videos and their thumbnails.'
	},
	S3_ACCESS_KEY_ID: {
		description: 'S3 access key; local: RUSTFS_ACCESS_KEY in docker-compose.yml.'
	},
	S3_SECRET_ACCESS_KEY: {
		description: 'S3 secret key; local: RUSTFS_SECRET_KEY in docker-compose.yml.'
	}
});
