import { error, json } from '@sveltejs/kit';
import { checkPasswordInput } from '#lib/passwords/types.js';
import { createPassword } from '#lib/server/passwords.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in required');
	const body: unknown = await request.json().catch(() => null);
	// Also covers a body that isn't JSON or isn't an object ('Invalid request').
	const checked = checkPasswordInput(body);
	if (!checked.ok) error(400, checked.error);
	return json(await createPassword(locals.user.id, checked.input), {
		status: 201,
		headers: NO_STORE
	});
};
