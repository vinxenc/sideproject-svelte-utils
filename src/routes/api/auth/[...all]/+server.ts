import { getAuth } from '#lib/server/auth.js';
import type { RequestHandler } from './$types';

// Better Auth's REST API (sign-in, sign-up, session, …) as its own route,
// so hooks.server.ts doesn't have to intercept requests for it.
export const GET: RequestHandler = ({ request }) => getAuth().handler(request);
export const POST = GET;
