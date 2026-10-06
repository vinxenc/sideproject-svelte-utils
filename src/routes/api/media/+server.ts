import { error, json } from '@sveltejs/kit';
import { checkMedia, THUMB_TYPE } from '#lib/media/types.js';
import type { MediaPage, UploadTicket } from '#lib/media/types.js';
import { prisma } from '#lib/server/db.js';
import { NO_STORE, originalKey, thumbKey, toItem } from '#lib/server/media.js';
import type { Media } from '#lib/server/prisma/client.js';
import { presignPut, remove } from '#lib/server/storage.js';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 60;
// A PENDING row this old was abandoned: its presigned upload URLs expired long ago.
const STALE_PENDING_MS = 24 * 60 * 60 * 1000;

// The cursor is the last item's sort key rather than its id, so it keeps working if that item is
// deleted before the next page is requested.
const encodeCursor = (m: Pick<Media, 'takenAt' | 'id'>) => `${m.takenAt.getTime()}_${m.id}`;

function decodeCursor(value: string) {
	const match = /^(-?\d+)_(.+)$/.exec(value);
	const takenAt = match && new Date(Number(match[1]));
	if (!match || !takenAt || Number.isNaN(takenAt.getTime())) error(400, 'Invalid cursor');
	return { takenAt, id: match[2] };
}

/** Deletes this user's abandoned uploads, objects first so a failure leaves the row for next time. */
async function purgeStale(userId: string) {
	const stale = await prisma.media.findMany({
		where: {
			userId,
			status: 'PENDING',
			createdAt: { lt: new Date(Date.now() - STALE_PENDING_MS) }
		},
		select: { id: true, userId: true }
	});
	if (!stale.length) return;
	await remove(...stale.flatMap((m) => [originalKey(m), thumbKey(m)]));
	await prisma.media.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } });
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Sign in required');
	const userId = locals.user.id;
	const cursorParam = url.searchParams.get('cursor');
	const cursor = cursorParam ? decodeCursor(cursorParam) : null;

	// Housekeeping rides on the first page only, and must never stop the gallery from loading.
	if (!cursor)
		await purgeStale(userId).catch((e) => console.error('Purging stale uploads failed', e));

	const rows = await prisma.media.findMany({
		where: {
			userId,
			status: 'READY',
			...(cursor
				? {
						OR: [
							{ takenAt: { lt: cursor.takenAt } },
							{ takenAt: cursor.takenAt, id: { lt: cursor.id } }
						]
					}
				: {})
		},
		orderBy: [{ takenAt: 'desc' }, { id: 'desc' }],
		take: PAGE_SIZE + 1
	});
	const items = rows.slice(0, PAGE_SIZE);
	const last = items.at(-1);
	const page: MediaPage = {
		items: items.map(toItem),
		nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last) : null
	};
	return json(page, { headers: NO_STORE });
};

const dimension = (v: unknown) =>
	typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 100_000 ? v : null;
const seconds = (v: unknown) =>
	typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1_000_000 ? v : null;

// EXIF and file clocks are often junk; don't let one pin an item to the far future.
function takenAtOf(v: unknown) {
	const now = new Date();
	const date = typeof v === 'string' ? new Date(v) : now;
	return Number.isNaN(date.getTime()) || date.getTime() > now.getTime() + 24 * 60 * 60 * 1000
		? now
		: date;
}

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in required');
	const body: Record<string, unknown> | null = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'Invalid request');

	const name = typeof body.name === 'string' ? body.name.trim().slice(0, 255) : '';
	if (!name) error(400, 'Missing file name');
	const size = body.size;
	if (typeof size !== 'number' || !Number.isInteger(size)) error(400, 'Invalid file size');
	const checked = checkMedia({ name, type: typeof body.type === 'string' ? body.type : '', size });
	if (!checked.ok) error(400, checked.error);

	const media = await prisma.media.create({
		data: {
			userId: locals.user.id,
			kind: checked.kind,
			name,
			contentType: checked.contentType,
			size,
			width: dimension(body.width),
			height: dimension(body.height),
			duration: checked.kind === 'VIDEO' ? seconds(body.duration) : null,
			takenAt: takenAtOf(body.takenAt)
		}
	});
	const [original, thumb] = await Promise.all([
		presignPut(originalKey(media), checked.contentType),
		body.thumb === true ? presignPut(thumbKey(media), THUMB_TYPE) : null
	]);
	const ticket: UploadTicket = { id: media.id, contentType: checked.contentType, original, thumb };
	return json(ticket, { status: 201, headers: NO_STORE });
};
