import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emailOTP, jwt, openAPI } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import { CLIENT_IP_HEADER } from './client-ip.js';
import { prisma } from './db.js';
import { EMAIL_OTP_ENGINE } from './email-otp.js';
import {
	EMAIL_VERIFICATION,
	RATE_LIMIT,
	emailVerificationHooks,
	ownsData,
	sendVerificationCode
} from './email-verification.js';
import { mailer } from './mail/index.js';

export const auth = betterAuth({
	secret: BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, { provider: 'postgresql' }),
	// Sign-up creates the user unverified and without a session; the emailOTP plugin mails the code.
	emailAndPassword: { enabled: true, requireEmailVerification: true },
	emailVerification: EMAIL_VERIFICATION,
	rateLimit: RATE_LIMIT,
	hooks: emailVerificationHooks(ownsData(prisma)),
	// The emailOTP plugin mails the sign-up / unverified-sign-in code by calling its send endpoint with the
	// browser's request but the init-time context, whose trusted origins are empty while baseURL is unset
	// (formCsrfMiddleware then refuses the Origin and nothing is mailed). Until BETTER_AUTH_URL is set, trust
	// the request's own origin; once it is set, its origin is trusted and this special case switches itself off.
	trustedOrigins: process.env.BETTER_AUTH_URL
		? []
		: (request) => (request ? [new URL(request.url).origin] : []),
	// The client IP comes only from the header the /api/auth route sets from SvelteKit's getClientAddress().
	advanced: { ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
	// Access token: the session_data cookie, a 5-minute JWT signed with the private key whose public
	// half is published at /api/auth/jwks, so any service can verify it without a shared secret.
	// Refresh token: the session_token cookie, backed by the session table (revocable).
	session: { cookieCache: { enabled: true, strategy: 'jwt' } },
	plugins: [
		openAPI(),
		jwt({ sessionCookieCache: true }),
		// Sign-up verification (plugin-native) and the engine for EmailOtp (src/lib/server/email-otp.ts).
		// Only email-otp/verify-email and email-otp/send-verification-otp are reachable over HTTP
		// (src/routes/api/auth/[...all]/+server.ts). EmailOtp still mails its own codes via createVerificationOTP.
		emailOTP({
			...EMAIL_OTP_ENGINE,
			overrideDefaultEmailVerification: true,
			sendVerificationOTP: sendVerificationCode(mailer)
		}),
		// sveltekitCookies must stay last so cookies set by server-side auth.api calls reach the response
		sveltekitCookies(getRequestEvent)
	]
});
