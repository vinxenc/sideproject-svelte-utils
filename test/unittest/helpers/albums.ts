import type { AlbumPreview, AlbumSummary } from '#lib/albums/types.js';

/** An album summary as the API returns it: no previews, one item, updated on 2024-05-01. */
export function albumSummary(overrides: Partial<AlbumSummary> = {}): AlbumSummary {
	return {
		id: 'a1',
		name: 'Trip',
		count: 1,
		createdAt: '2024-05-01T10:00:00.000Z',
		updatedAt: '2024-05-01T10:00:00.000Z',
		previews: [],
		...overrides
	};
}

/** A stack photo for a card, with a thumbnail unless told otherwise. */
export function albumPreview(overrides: Partial<AlbumPreview> = {}): AlbumPreview {
	return { id: 'm1', kind: 'IMAGE', hasThumb: true, ...overrides };
}

/** The summary's Prisma row shape, as `album.findMany` / `album.create` return it with summarySelect. */
export function albumRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'a1',
		name: 'Trip',
		createdAt: new Date('2024-05-01T10:00:00.000Z'),
		updatedAt: new Date('2024-05-01T10:00:00.000Z'),
		cover: null,
		media: [],
		_count: { media: 0 },
		...overrides
	};
}
