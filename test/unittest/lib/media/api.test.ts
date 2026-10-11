import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteMedia } from '#lib/media/api.js';

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
