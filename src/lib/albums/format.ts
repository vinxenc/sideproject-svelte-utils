import type { AlbumSummary } from './types.js';

/** 0 -> "No items", 1 -> "1 item", 12 -> "12 items" */
export function formatCount(count: number) {
	if (count === 0) return 'No items';
	return count === 1 ? '1 item' : `${count} items`;
}

/** "12 items · Oct 9, 2026" (updatedAt, toLocaleDateString(undefined, { dateStyle: 'medium' })) */
export function albumSubtitle(album: Pick<AlbumSummary, 'count' | 'updatedAt'>) {
	const date = new Date(album.updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
	return `${formatCount(album.count)} · ${date}`;
}
