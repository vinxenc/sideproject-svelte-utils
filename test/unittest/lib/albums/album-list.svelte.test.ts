import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlbumList } from '#lib/albums/album-list.svelte.js';
import { albumSummary } from '../../helpers/albums.js';
import { deferred } from '../../helpers/media.js';

const api = vi.hoisted(() => ({ fetchAlbums: vi.fn() }));
vi.mock('#lib/albums/api.js', () => api);

beforeEach(() => {
	api.fetchAlbums.mockReset();
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('AlbumList', () => {
	it('loads the first page with the constructor limit and no cursor', async () => {
		api.fetchAlbums.mockResolvedValue({ items: [albumSummary({ id: 'a1' })], nextCursor: 'c1' });
		const list = new AlbumList(5);

		await list.load();

		expect(api.fetchAlbums).toHaveBeenCalledWith({ limit: 5, cursor: null });
		expect(list.items.map((i) => i.id)).toEqual(['a1']);
		expect(list.loaded).toBe(true);
		expect(list.done).toBe(false);
		expect(list.loading).toBe(false);
	});

	it('appends the next page using its cursor', async () => {
		api.fetchAlbums
			.mockResolvedValueOnce({ items: [albumSummary({ id: 'a1' })], nextCursor: 'c1' })
			.mockResolvedValueOnce({ items: [albumSummary({ id: 'a2' })], nextCursor: null });
		const list = new AlbumList();

		await list.load();
		await list.load();

		expect(api.fetchAlbums).toHaveBeenLastCalledWith({ limit: undefined, cursor: 'c1' });
		expect(list.items.map((i) => i.id)).toEqual(['a1', 'a2']);
		expect(list.done).toBe(true);
	});

	it('does not request again once done, nor while a page is loading', async () => {
		const pending = deferred<{ items: never[]; nextCursor: string | null }>();
		api.fetchAlbums.mockReturnValueOnce(pending.promise);
		const list = new AlbumList();

		const first = list.load();
		const second = list.load();
		expect(list.loading).toBe(true);
		pending.resolve({ items: [], nextCursor: null });
		await Promise.all([first, second]);
		await list.load();

		expect(api.fetchAlbums).toHaveBeenCalledTimes(1);
	});

	it('dedupes albums that show up on two pages', async () => {
		api.fetchAlbums
			.mockResolvedValueOnce({ items: [albumSummary({ id: 'a1' })], nextCursor: 'c1' })
			.mockResolvedValueOnce({
				items: [albumSummary({ id: 'a1', name: 'moved' }), albumSummary({ id: 'a2' })],
				nextCursor: null
			});
		const list = new AlbumList();

		await list.load();
		await list.load();

		expect(list.items.map((i) => i.id)).toEqual(['a1', 'a2']);
	});

	it('keeps the error text and no items when a page fails, and retries from the same cursor', async () => {
		api.fetchAlbums
			.mockRejectedValueOnce(new Error('Request failed (500)'))
			.mockResolvedValueOnce({ items: [albumSummary({ id: 'a1' })], nextCursor: null });
		const list = new AlbumList();

		await list.load();
		expect(list.error).toBe('Request failed (500)');
		expect(list.loaded).toBe(false);
		expect(list.loading).toBe(false);

		await list.load();
		expect(list.error).toBe('');
		expect(list.items).toHaveLength(1);
	});

	it('uses a generic message for a failure that is not an Error', async () => {
		api.fetchAlbums.mockRejectedValueOnce('boom');
		const list = new AlbumList();

		await list.load();

		expect(list.error).toBe('Something went wrong');
	});

	it('reset clears everything and drops a page still in flight', async () => {
		const pending = deferred<{ items: ReturnType<typeof albumSummary>[]; nextCursor: null }>();
		api.fetchAlbums.mockReturnValueOnce(pending.promise);
		const list = new AlbumList();

		const inFlight = list.load();
		list.reset();
		pending.resolve({ items: [albumSummary({ id: 'stale' })], nextCursor: null });
		await inFlight;

		expect(list.items).toEqual([]);
		expect(list.loaded).toBe(false);
		expect(list.done).toBe(false);
		expect(list.loading).toBe(false);
		expect(list.error).toBe('');
	});

	it('reset starts paging from the first page again', async () => {
		api.fetchAlbums
			.mockResolvedValueOnce({ items: [albumSummary({ id: 'a1' })], nextCursor: 'c1' })
			.mockResolvedValueOnce({ items: [albumSummary({ id: 'b1' })], nextCursor: null });
		const list = new AlbumList();
		await list.load();

		list.reset();
		await list.load();

		expect(api.fetchAlbums).toHaveBeenLastCalledWith({ limit: undefined, cursor: null });
		expect(list.items.map((i) => i.id)).toEqual(['b1']);
	});

	it('ignores a failure from before a reset', async () => {
		const pending = deferred<never>();
		api.fetchAlbums.mockReturnValueOnce(pending.promise);
		const list = new AlbumList();

		const inFlight = list.load();
		list.reset();
		pending.reject(new Error('late'));
		await inFlight;

		expect(list.error).toBe('');
	});
});
