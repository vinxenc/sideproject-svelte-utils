import { error, json } from '@sveltejs/kit';
import { prisma } from '#lib/server/db.js';
import { MAX_THUMB_BYTES, NO_STORE, originalKey, thumbKey, toItem } from '#lib/server/media.js';
import { head, remove } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	// Only a PENDING row the caller owns: someone else's id, a finished upload and a made-up id
	// are all the same 404.
	const media = await prisma.media.findFirst({
		where: { id: params.id, userId: locals.user.id, status: 'PENDING' }
	});
	if (!media) error(404, 'Not found');

	const [original, thumb] = await Promise.all([head(originalKey(media)), head(thumbKey(media))]);
	if (!original) error(409, 'The file has not been uploaded');
	if (original.size !== media.size) {
		// The signed upload URL makes the storage refuse any other length; this catches a store that doesn't.
		await remove(originalKey(media), thumbKey(media));
		await prisma.media.delete({ where: { id: media.id } });
		error(422, 'The uploaded file does not match its declared size');
	}

	const hasThumb = thumb !== null && thumb.size <= MAX_THUMB_BYTES;
	if (thumb && !hasThumb) await remove(thumbKey(media));

	const ready = await prisma.media.update({
		where: { id: media.id },
		data: { status: 'READY', hasThumb }
	});
	return json(toItem(ready), { headers: NO_STORE });
};
