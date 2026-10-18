import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_ITEMS_PER_REQUEST } from '#lib/albums/types.js';
import { deleteMediaItems, PartialDeleteError } from '#lib/media/api.js';

const fetchMock = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
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

	it('falls back to the status when a failed chunk has no JSON body', async () => {
		fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));

		await expect(deleteMediaItems(['m1'])).rejects.toThrow('Request failed (500)');
	});

	it('stops at the first failed chunk and throws the server message', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 'Not found' }, 404));

		await expect(deleteMediaItems(ids)).rejects.toThrow('Not found');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('says which ids went through before a later chunk failed', async () => {
		fetchMock
			.mockResolvedValueOnce(json({ deleted: MAX_ITEMS_PER_REQUEST }))
			.mockResolvedValueOnce(json({ message: 'Not found' }, 404));

		const error = await deleteMediaItems(ids).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(PartialDeleteError);
		expect(error).toMatchObject({
			message: 'Not found',
			deletedIds: ids.slice(0, MAX_ITEMS_PER_REQUEST)
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
