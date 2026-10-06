import type { MediaItem } from '#lib/media/types.js';
import type { Media } from './prisma/client.js';

// Everything a user uploads lives under their own id, so one prefix scopes their objects.
export const originalKey = (m: Pick<Media, 'userId' | 'id'>) => `${m.userId}/${m.id}/original`;
export const thumbKey = (m: Pick<Media, 'userId' | 'id'>) => `${m.userId}/${m.id}/thumb`;

/** Cache-Control for API responses holding one user's data; the service worker honours no-store. */
export const NO_STORE = { 'cache-control': 'private, no-store' };

export function toItem(m: Media): MediaItem {
	return {
		id: m.id,
		kind: m.kind,
		name: m.name,
		duration: m.duration,
		takenAt: m.takenAt.toISOString(),
		hasThumb: m.hasThumb
	};
}
