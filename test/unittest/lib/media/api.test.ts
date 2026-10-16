import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_ITEMS_PER_REQUEST } from '#lib/albums/types.js';
import { deleteMedia, deleteMediaItems } from '#lib/media/api.js';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('deleteMedia', () => {
	it('deletes by encoded id and resolves with nothing', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

		await expect(deleteMedia('m/1')).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith('/api/media/m%2F1', { method: 'DELETE' });
	});

	it('throws the server message on a failure', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ message: 'Not found' }), {
				status: 404,
				headers: { 'content-type': 'application/json' }
			})
		);

		await expect(deleteMedia('m1')).rejects.toThrow('Not found');
	});

	it('falls back to the status when the body is not JSON', async () => {
		fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

		await expect(deleteMedia('m1')).rejects.toThrow('Request failed (500)');
	});
});

describe('deleteMediaItems', () => {
	const json = (body: unknown, status = 200) =>
		new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
	const ids = Array.from({ length: MAX_ITEMS_PER_REQUEST + 1 }, (_, i) => `m${i}`);

	it('sends one DELETE with the ids and resolves with the deleted count', async () => {
		fetchMock.mockResolvedValue(json({ deleted: 2 }));

		expect(await deleteMediaItems(['m1', 'm2'])).toBe(2);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('/api/media', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ mediaIds: ['m1', 'm2'] })
		});
	});

	it('splits a large selection into chunks sent one after another and sums the counts', async () => {
		fetchMock
			.mockResolvedValueOnce(json({ deleted: MAX_ITEMS_PER_REQUEST }))
			.mockResolvedValueOnce(json({ deleted: 0 }));

		expect(await deleteMediaItems(ids)).toBe(MAX_ITEMS_PER_REQUEST);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const [first, second] = fetchMock.mock.calls.map(
			(c) => JSON.parse(c[1]?.body as string).mediaIds
		);
		expect(first).toHaveLength(MAX_ITEMS_PER_REQUEST);
		expect(second).toEqual([ids[MAX_ITEMS_PER_REQUEST]]);
	});

	it('makes no request for an empty selection', async () => {
		expect(await deleteMediaItems([])).toBe(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('stops at the first failed chunk and throws the server message', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 'Not found' }, 404));

		await expect(deleteMediaItems(ids)).rejects.toThrow('Not found');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
