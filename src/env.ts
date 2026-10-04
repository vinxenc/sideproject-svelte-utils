import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string; local: see docker-compose.yml'
	},
	BETTER_AUTH_SECRET: {
		description: 'Signs sessions and tokens. Generate with `openssl rand -base64 32`.'
	}
});
