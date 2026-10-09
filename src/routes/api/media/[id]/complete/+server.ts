import { error, json } from '@sveltejs/kit';
import { prisma } from '#lib/server/db.js';
import { MAX_THUMB_BYTES, NO_STORE, originalKey, thumbKey, toItem } from '#lib/server/media.js';
import type { Media } from '#lib/server/prisma/client.js';
import { head, remove } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
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

	// An optional album to link the upload into. A missing or foreign album is ignored: the upload still completes.
	const body = await request.json().catch(() => null);
	const albumId =
		body && typeof body === 'object' && typeof body.albumId === 'string' ? body.albumId : null;
	const album = albumId
		? await prisma.album.findFirst({
				where: { id: albumId, userId: locals.user.id },
				select: { id: true }
			})
		: null;
	const data = { status: 'READY', hasThumb } as const;
	let ready: Media;
	if (album) {
		try {
			[ready] = await prisma.$transaction([
				prisma.media.update({ where: { id: media.id }, data }),
				prisma.albumMedia.create({ data: { albumId: album.id, mediaId: media.id } }),
				prisma.album.update({ where: { id: album.id }, data: { updatedAt: new Date() } })
			]);
		} catch (e) {
			// The album was deleted between the lookup and the link: finish the upload unlinked.
			console.error('Linking the upload to its album failed', e);
			ready = await prisma.media.update({ where: { id: media.id }, data });
		}
	} else {
		ready = await prisma.media.update({ where: { id: media.id }, data });
	}
	return json(toItem(ready), { headers: NO_STORE });
};
