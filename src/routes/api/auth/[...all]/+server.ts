import { error } from '@sveltejs/kit';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

// Better Auth's REST API (sign-in, sign-up, session, …) as its own route,
// so hooks.server.ts doesn't have to intercept requests for it.
const betterAuth = toSvelteKitHandler(auth);

// The email-otp plugin's HTTP endpoints (/email-otp/*, /sign-in/email-otp, /forget-password/email-otp)
// let a mailbox alone sign in or reset a password, which defeats a second factor built on the code.
// EmailOtp calls auth.api server-side, which does not go through HTTP, so it is unaffected.
const closed = (path: string) => path.toLowerCase().split('/').includes('email-otp');

export const GET: RequestHandler = async (event) => {
	if (closed(event.params.all)) error(404, 'Not found');
	return betterAuth(event);
};
export const POST = GET;
