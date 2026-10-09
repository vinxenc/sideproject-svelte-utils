import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	addToAlbum,
	createAlbum,
	deleteAlbum,
	fetchAlbums,
	removeFromAlbum
} from '#lib/albums/api.js';
import { MAX_ITEMS_PER_REQUEST } from '#lib/albums/types.js';

const fetchMock = vi.fn();

function reply(body: unknown, status = 200) {
	return new Response(body === undefined ? null : JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fetchAlbums', () => {
	it('requests the first page with the default size when no options are given', async () => {
		fetchMock.mockResolvedValue(reply({ items: [], nextCursor: null }));

		await fetchAlbums();

		expect(fetchMock).toHaveBeenCalledWith('/api/albums', {});
	});

	it('sends limit then cursor', async () => {
		fetchMock.mockImplementation(async () => reply({ items: [], nextCursor: null }));

		await fetchAlbums({ limit: 5 });
		await fetchAlbums({ limit: 30, cursor: '1000_a1' });

		expect(fetchMock.mock.calls[0][0]).toBe('/api/albums?limit=5');
		expect(fetchMock.mock.calls[1][0]).toBe('/api/albums?limit=30&cursor=1000_a1');
	});

	it('omits a null cursor', async () => {
		fetchMock.mockResolvedValue(reply({ items: [], nextCursor: null }));

		await fetchAlbums({ cursor: null });

		expect(fetchMock).toHaveBeenCalledWith('/api/albums', {});
	});

	it('returns the page', async () => {
		const page = { items: [], nextCursor: 'c' };
		fetchMock.mockResolvedValue(reply(page));

		expect(await fetchAlbums()).toEqual(page);
	});

	it('throws the server message on failure', async () => {
		fetchMock.mockResolvedValue(reply({ status: 400, message: 'Invalid limit' }, 400));

		await expect(fetchAlbums({ limit: 0 })).rejects.toThrow('Invalid limit');
	});

	it('falls back to the status when the failure has no JSON body', async () => {
		fetchMock.mockResolvedValue(new Response('oops', { status: 500 }));

		await expect(fetchAlbums()).rejects.toThrow('Request failed (500)');
	});
});

describe('createAlbum', () => {
	it('posts the name as JSON', async () => {
		const album = { id: 'a1', name: 'Trip' };
		fetchMock.mockResolvedValue(reply(album, 201));

		expect(await createAlbum('Trip')).toEqual(album);
		expect(fetchMock).toHaveBeenCalledWith('/api/albums', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Trip' })
		});
	});

	it('throws the validation message from the server', async () => {
		fetchMock.mockResolvedValue(reply({ status: 400, message: 'Enter an album name' }, 400));

		await expect(createAlbum('x')).rejects.toThrow('Enter an album name');
	});
});

describe('deleteAlbum', () => {
	it('deletes by encoded id and resolves with nothing', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

		await expect(deleteAlbum('a/1')).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith('/api/albums/a%2F1', { method: 'DELETE' });
	});

	it('throws on a 404', async () => {
		fetchMock.mockResolvedValue(reply({ status: 404, message: 'Not found' }, 404));

		await expect(deleteAlbum('a1')).rejects.toThrow('Not found');
	});
});

describe('addToAlbum and removeFromAlbum', () => {
	it('posts the ids and returns the added count', async () => {
		fetchMock.mockResolvedValue(reply({ added: 2 }));

		expect(await addToAlbum('a1', ['m1', 'm2'])).toBe(2);
		expect(fetchMock).toHaveBeenCalledWith('/api/albums/a1/items', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ mediaIds: ['m1', 'm2'] })
		});
	});

	it('sends DELETE and returns the removed count', async () => {
		fetchMock.mockResolvedValue(reply({ removed: 1 }));

		expect(await removeFromAlbum('a1', ['m1'])).toBe(1);
		expect(fetchMock).toHaveBeenCalledWith('/api/albums/a1/items', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ mediaIds: ['m1'] })
		});
	});

	it('splits a large selection into chunks sent one after another and sums the results', async () => {
		const ids = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, i) => `m${i}`);
		fetchMock
			.mockResolvedValueOnce(reply({ added: MAX_ITEMS_PER_REQUEST }))
			.mockResolvedValueOnce(reply({ added: 1 }));

		expect(await addToAlbum('a1', ids)).toBe(MAX_ITEMS_PER_REQUEST + 1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [first, second] = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).mediaIds);
		expect(first).toHaveLength(MAX_ITEMS_PER_REQUEST);
		expect(second).toEqual([ids[MAX_ITEMS_PER_REQUEST]]);
	});

	it('chunks removals the same way and sums the removed counts', async () => {
		const ids = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, i) => `m${i}`);
		fetchMock
			.mockResolvedValueOnce(reply({ removed: 3 }))
			.mockResolvedValueOnce(reply({ removed: 0 }));

		expect(await removeFromAlbum('a1', ids)).toBe(3);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('makes no request for an empty selection', async () => {
		expect(await addToAlbum('a1', [])).toBe(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('stops at the first failed chunk', async () => {
		const ids = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, i) => `m${i}`);
		fetchMock.mockResolvedValueOnce(reply({ status: 404, message: 'Not found' }, 404));

		await expect(addToAlbum('a1', ids)).rejects.toThrow('Not found');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
