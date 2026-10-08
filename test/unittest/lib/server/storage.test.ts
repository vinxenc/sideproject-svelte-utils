import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { head, presignGet, presignPut, remove } from '#lib/server/storage.js';

const fetchMock = vi.fn<(req: Request) => Promise<Response>>();

beforeEach(() => {
	fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** The last request the storage client sent. */
function lastRequest(): Request {
	return fetchMock.mock.calls.at(-1)![0];
}

describe('presigned URLs', () => {
	it('presigns a PUT that signs the content type and length, for 15 minutes by default', async () => {
		const url = new URL(await presignPut('u1/m1/original', 'image/jpeg', 123));

		expect(url.href.startsWith('http://s3.test/media/u1/m1/original?')).toBe(true);
		expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
		const signed = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
		expect(signed).toContain('content-length');
		expect(signed).toContain('content-type');
	});

	it('honours a custom expiry for a PUT', async () => {
		const url = new URL(await presignPut('u1/m1/original', 'image/jpeg', 123, 60));

		expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
	});

	it('presigns a GET for one hour by default', async () => {
		const url = new URL(await presignGet('u1/m1/original'));

		expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
	});

	it('honours a custom expiry for a GET', async () => {
		const url = new URL(await presignGet('u1/m1/original', 120));

		expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
	});

	it('percent-encodes each segment of the key', async () => {
		const url = new URL(await presignGet('u1/a b#c.jpg'));

		expect(url.pathname).toBe('/media/u1/a%20b%23c.jpg');
	});

	it.each(['u1/../u2/x', 'u1/./x'])('refuses the key %s', async (key) => {
		await expect(presignPut(key, 'image/jpeg', 1)).rejects.toThrow(`Invalid object key: ${key}`);
		await expect(presignGet(key)).rejects.toThrow(`Invalid object key: ${key}`);
		await expect(head(key)).rejects.toThrow(`Invalid object key: ${key}`);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('head', () => {
	it('returns null for an object that does not exist', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

		expect(await head('k')).toBeNull();
	});

	it('returns the size and type of an existing object, using HEAD', async () => {
		fetchMock.mockResolvedValue(
			new Response(null, {
				status: 200,
				headers: { 'content-length': '42', 'content-type': 'image/png' }
			})
		);

		expect(await head('k')).toEqual({ size: 42, contentType: 'image/png' });
		expect(lastRequest().method).toBe('HEAD');
	});

	it('throws on any other failure', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

		await expect(head('k')).rejects.toThrow('S3 HEAD k failed: 403');
	});
});

describe('remove', () => {
	it('deletes each key', async () => {
		await remove('a', 'b');

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls.every(([req]) => req.method === 'DELETE')).toBe(true);
		expect(fetchMock.mock.calls.map(([req]) => new URL(req.url).pathname).sort()).toEqual([
			'/media/a',
			'/media/b'
		]);
	});

	it('treats a missing key as deleted', async () => {
		fetchMock
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(new Response(null, { status: 404 }));

		await expect(remove('a', 'b')).resolves.toBeUndefined();
	});

	it('rejects when a delete is refused', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

		await expect(remove('a')).rejects.toThrow('S3 DELETE a failed: 403');
	});

	it('does nothing when given no keys', async () => {
		await remove();

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
