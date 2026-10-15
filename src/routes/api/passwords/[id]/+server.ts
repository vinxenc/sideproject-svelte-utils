import { error } from '@sveltejs/kit';
import { deletePassword } from '#lib/server/passwords.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	if (!(await deletePassword(locals.user.id, params.id))) error(404, 'Not found');
	return new Response(null, { status: 204, headers: NO_STORE });
};
