import { error } from '@sveltejs/kit';
import { prisma } from '#lib/server/db.js';
import { NO_STORE, originalKey, thumbKey } from '#lib/server/media.js';
import { remove } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

/** Deletes one of the caller's READY items: the row, its album links, and its stored files. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	const { id } = params;
	const userId = locals.user.id;
	// Someone else's id, a PENDING upload and a made-up id are all the same 404.
	const { count } = await prisma.media.deleteMany({ where: { id, userId, status: 'READY' } });
	if (count === 0) error(404, 'Not found');

	// The row is gone, so a storage hiccup must not fail the request: it only leaves orphaned objects.
	try {
		await remove(originalKey({ userId, id }), thumbKey({ userId, id }));
	} catch (e) {
		console.error(`Removing the stored files of media ${id} failed`, e);
	}
	return new Response(null, { status: 204, headers: NO_STORE });
};
