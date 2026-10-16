import { error } from '@sveltejs/kit';
import { prisma } from '#lib/server/db.js';
import { NO_STORE } from '#lib/server/media.js';
import type { RequestHandler } from './$types';

/** Soft-deletes one of the caller's READY items. Its album links and stored files stay, so it can be restored. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	const { id } = params;
	const userId = locals.user.id;
	// Someone else's id, a PENDING upload and a made-up id are all the same 404.
	const { count } = await prisma.media.deleteMany({ where: { id, userId, status: 'READY' } });
	if (count === 0) error(404, 'Not found');
	return new Response(null, { status: 204, headers: NO_STORE });
};
