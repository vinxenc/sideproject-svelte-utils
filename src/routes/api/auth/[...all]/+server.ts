import { error } from '@sveltejs/kit';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.js';
import { withClientIp } from '#lib/server/client-ip.js';
import type { RequestHandler } from './$types';

// Better Auth's REST API (sign-in, sign-up, session, …) as its own route,
// so hooks.server.ts doesn't have to intercept requests for it.
const betterAuth = toSvelteKitHandler(auth);

// The two plugin endpoints the sign-up flow needs: verifying a code (guarded by
// beforeEmailVerification in email-verification.ts) and mailing one (only to unverified users).
const OPEN = new Set(['email-otp/verify-email', 'email-otp/send-verification-otp']);
// Core link-based verification. The emailOTP plugin replaces it, so it never needs to be reachable.
const CLOSED_CORE = new Set(['verify-email', 'send-verification-email']);

// Every other email-otp endpoint (/sign-in/email-otp, /forget-password/email-otp, /email-otp/check-verification-otp,
// /email-otp/reset-password, …) would let a mailbox alone sign in or reset a password.
function closed(all: string): boolean {
	const segments = all.toLowerCase().split('/').filter(Boolean);
	const path = segments.join('/');
	if (OPEN.has(path)) return false;
	return segments.includes('email-otp') || CLOSED_CORE.has(path);
}

export const GET: RequestHandler = async (event) => {
	if (closed(event.params.all)) error(404, 'Not found');
	return betterAuth({ request: withClientIp(event) });
};
export const POST = GET;
