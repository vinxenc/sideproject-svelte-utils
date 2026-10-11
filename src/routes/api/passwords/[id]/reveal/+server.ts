import { error, json } from '@sveltejs/kit';
import type { RevealResult } from '#lib/passwords/types.js';
import { revealPassword } from '#lib/server/passwords.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

// POST on purpose: the service worker only handles GET, and phase 2 will send a passkey assertion body.
export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	const password = await revealPassword(locals.user.id, params.id);
	if (password === null) error(404, 'Not found');
	return json({ password } satisfies RevealResult, { headers: NO_STORE });
};
