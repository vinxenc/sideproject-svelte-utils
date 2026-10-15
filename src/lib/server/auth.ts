import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, jwt, openAPI } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import { prisma } from './db.js';
import { EMAIL_OTP_ENGINE } from './email-otp.js';

export const auth = betterAuth({
	secret: BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	emailAndPassword: { enabled: true },
	// Access token: the session_data cookie, a 5-minute JWT signed with the private key whose public
	// half is published at /api/auth/jwks, so any service can verify it without a shared secret.
	// Refresh token: the session_token cookie, backed by the session table (revocable).
	session: { cookieCache: { enabled: true, strategy: 'jwt' } },
	plugins: [
		openAPI(),
		jwt({ sessionCookieCache: true }),
		// Engine for EmailOtp (src/lib/server/email-otp.ts): code generation, hashing, expiry, attempt cap.
		// Its HTTP endpoints are closed in src/routes/api/auth/[...all]/+server.ts.
		emailOTP({
			...EMAIL_OTP_ENGINE,
			// Never mails. EmailOtp calls createVerificationOTP and mails the code itself. The plugin's own
			// mail path runs in the background and only logs failures (the after-sign-up hook, which needs
			// sendVerificationOnSignUp or overrideDefaultEmailVerification, and neither is set), so a stub
			// that throws is the only way to make sure nothing mails through it.
			sendVerificationOTP: () =>
				Promise.reject(new Error('email-otp: EmailOtp mails the code, not the plugin'))
		}),
		// sveltekitCookies must stay last so cookies set by server-side auth.api calls reach the response
		sveltekitCookies(getRequestEvent)
	]
});
