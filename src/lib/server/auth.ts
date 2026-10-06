import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { jwt, openAPI } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import { prisma } from './db.js';

export const auth = betterAuth({
	secret: BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	emailAndPassword: { enabled: true },
	// Access token: the session_data cookie, a 5-minute JWT signed with the private key whose public
	// half is published at /api/auth/jwks, so any service can verify it without a shared secret.
	// Refresh token: the session_token cookie, backed by the session table (revocable).
	session: { cookieCache: { enabled: true, strategy: 'jwt' } },
	// sveltekitCookies must stay last so cookies set by server-side auth.api calls reach the response
	plugins: [openAPI(), jwt({ sessionCookieCache: true }), sveltekitCookies(getRequestEvent)]
});
