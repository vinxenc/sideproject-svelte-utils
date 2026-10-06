import { error } from '@sveltejs/kit';
import { prisma } from '#lib/server/db.js';
import { originalKey, thumbKey } from '#lib/server/media.js';
import { presignGet } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

const URL_TTL_SECONDS = 60 * 60;

/** `/api/media/:id/original` and `/thumb`: 302 to a short-lived presigned URL, so the bucket itself stays private. */
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Sign in required');
	const { id, variant } = params;
	if (variant !== 'original' && variant !== 'thumb') error(404, 'Not found');
	// Someone else's id, a PENDING upload and a made-up id are all the same 404.
	const media = await prisma.media.findFirst({
		where: { id, userId: locals.user.id, status: 'READY' }
	});
	if (!media || (variant === 'thumb' && !media.hasThumb)) error(404, 'Not found');

	const url = await presignGet(
		variant === 'thumb' ? thumbKey(media) : originalKey(media),
		URL_TTL_SECONDS
	);
	// Cached for half the URL's life, so scrolling back through the grid reuses the signed URL
	// (and with it the browser's cached image) instead of signing a fresh, uncacheable one each time.
	return new Response(null, {
		status: 302,
		headers: { location: url, 'cache-control': `private, max-age=${URL_TTL_SECONDS / 2}` }
	});
};
