import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'SQLite connection string, e.g. file:./prisma/dev.db'
	},
	BETTER_AUTH_SECRET: {
		description: 'Signs sessions and tokens. Generate with `openssl rand -base64 32`.'
	}
});
