import type { MediaItem } from '#lib/media/types.js';
import type { Media } from '#lib/server/prisma/client.js';

/** A gallery item as the API returns it (an image with a thumbnail). */
export function mediaItem(overrides: Partial<MediaItem> = {}): MediaItem {
	return {
		id: 'm1',
		kind: 'IMAGE',
		name: 'beach.jpg',
		width: 1600,
		height: 1200,
		duration: null,
		takenAt: '2024-05-01T10:00:00.000Z',
		hasThumb: true,
		...overrides
	};
}

/** A full Prisma `Media` row, as `findMany` returns it. */
export function mediaRow(overrides: Partial<Media> = {}): Media {
	return {
		id: 'm1',
		userId: 'u1',
		kind: 'IMAGE',
		status: 'READY',
		name: 'beach.jpg',
		contentType: 'image/jpeg',
		size: 1000,
		width: 1600,
		height: 1200,
		duration: null,
		takenAt: new Date('2024-05-01T10:00:00.000Z'),
		hasThumb: true,
		createdAt: new Date('2024-05-01T10:00:00.000Z'),
		updatedAt: new Date('2024-05-01T10:00:00.000Z'),
		...overrides
	};
}

export function deferred<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}
