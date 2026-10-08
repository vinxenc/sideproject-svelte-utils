import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: never) => void;
const sw = vi.hoisted(() => ({
	listeners: new Map<string, Listener>(),
	skipWaiting: vi.fn(async () => {}),
	claim: vi.fn(async () => {})
}));
vi.mock('$app/service-worker', () => ({
	self: {
		addEventListener: (type: string, fn: Listener) => sw.listeners.set(type, fn),
		location: { origin: 'http://localhost' },
		skipWaiting: sw.skipWaiting,
		clients: { claim: sw.claim }
	}
}));
vi.mock('$app/manifest', () => ({
	immutable: [{ path: '/_app/immutable/app.js' }],
	assets: [{ path: '/manifest.webmanifest' }]
}));
vi.mock('$app/env', () => ({ version: 'v1' }));

// A non-literal specifier keeps svelte-check from type-checking the worker with the app's DOM lib.
const WORKER: string = '../../../src/service-worker/index.ts';
beforeAll(async () => {
	await import(/* @vite-ignore */ WORKER);
});

/** A Cache that keys entries by absolute URL, the way the browser does. */
class FakeCache {
	entries = new Map<string, Response>();
	match = vi.fn(async (request: string | { url: string }) => this.entries.get(this.key(request)));
	put = vi.fn(async (request: string | { url: string }, response: Response) => {
		this.entries.set(this.key(request), response);
	});
	addAll = vi.fn<(requests: string[]) => Promise<void>>(async () => {});

	key(request: string | { url: string }) {
		return new URL(typeof request === 'string' ? request : request.url, 'http://localhost').href;
	}

	seed(path: string, response: Response) {
		this.entries.set(this.key(path), response);
	}
}

class FakeCacheStorage {
	caches = new Map<string, FakeCache>();
	open = vi.fn(async (name: string) => this.cache(name));
	keys = vi.fn(async () => [...this.caches.keys()]);
	delete = vi.fn<(name: string) => Promise<boolean>>(async () => true);

	/** The named cache, created on first use, the way caches.open() does. */
	cache(name: string) {
		let cache = this.caches.get(name);
		if (!cache) this.caches.set(name, (cache = new FakeCache()));
		return cache;
	}
}

let storage: FakeCacheStorage;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	storage = new FakeCacheStorage();
	fetchMock = vi.fn(async () => new Response('network', { status: 200 }));
	vi.stubGlobal('caches', storage);
	vi.stubGlobal('fetch', fetchMock);
	sw.skipWaiting.mockClear();
	sw.claim.mockClear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

/** Fires a lifecycle event through the listener the worker registered. */
function fire(type: string, event: object) {
	(sw.listeners.get(type) as unknown as (e: object) => void)(event);
	return event;
}

function installEvent() {
	return fire('install', { waitUntil: vi.fn() }) as { waitUntil: ReturnType<typeof vi.fn> };
}

function activateEvent() {
	return fire('activate', { waitUntil: vi.fn() }) as { waitUntil: ReturnType<typeof vi.fn> };
}

function fetchEvent(url: string, { method = 'GET', mode = 'cors' } = {}) {
	return fire('fetch', {
		request: { method, url, mode },
		respondWith: vi.fn(),
		waitUntil: vi.fn()
	}) as {
		request: object;
		respondWith: ReturnType<typeof vi.fn>;
		waitUntil: ReturnType<typeof vi.fn>;
	};
}

/** The promise the worker handed to respondWith, awaited. */
async function answer(event: ReturnType<typeof fetchEvent>) {
	return event.respondWith.mock.calls[0][0] as Promise<Response>;
}

describe('service worker registration', () => {
	it('listens for install, activate and fetch', () => {
		expect([...sw.listeners.keys()].sort()).toEqual(['activate', 'fetch', 'install']);
	});
});

describe('install', () => {
	it('precaches the build assets, the manifest and the sign-in fallback, then takes over', async () => {
		const event = installEvent();
		await event.waitUntil.mock.calls[0][0];

		expect(storage.open).toHaveBeenCalledWith('utilities-v1');
		expect(storage.cache('utilities-v1').addAll).toHaveBeenCalledWith([
			'/_app/immutable/app.js',
			'/manifest.webmanifest',
			'/sign-in'
		]);
		expect(sw.skipWaiting).toHaveBeenCalledTimes(1);
	});
});

describe('activate', () => {
	it('deletes only the old worker caches, then claims the open pages', async () => {
		storage.keys.mockResolvedValueOnce(['utilities-v0', 'utilities-v1', 'other']);
		const event = activateEvent();
		await event.waitUntil.mock.calls[0][0];

		expect(storage.delete).toHaveBeenCalledTimes(1);
		expect(storage.delete).toHaveBeenCalledWith('utilities-v0');
		expect(sw.claim).toHaveBeenCalledTimes(1);
	});
});

describe('fetch', () => {
	it('ignores anything but GET', () => {
		const event = fetchEvent('http://localhost/dashboard', { method: 'POST' });

		expect(event.respondWith).not.toHaveBeenCalled();
	});

	it('ignores requests to other origins', () => {
		const event = fetchEvent('https://cdn.example.com/lib.js');

		expect(event.respondWith).not.toHaveBeenCalled();
	});

	it.each(['/api/media/x/thumb', '/api/albums'])('leaves %s to the network, uncached', (path) => {
		const event = fetchEvent(`http://localhost${path}`);

		expect(event.respondWith).not.toHaveBeenCalled();
	});

	it('answers a hashed build file from the cache without asking the network', async () => {
		storage.cache('utilities-v1').seed('/_app/immutable/app.js', new Response('cached'));

		const event = fetchEvent('http://localhost/_app/immutable/app.js');
		const response = await answer(event);

		expect(await response.text()).toBe('cached');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('fetches a hashed build file that is not cached yet', async () => {
		const event = fetchEvent('http://localhost/_app/immutable/app.js');
		const response = await answer(event);

		expect(await response.text()).toBe('network');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('returns a network response and caches it in the background', async () => {
		const event = fetchEvent('http://localhost/dashboard', { mode: 'navigate' });
		const response = await answer(event);
		await event.waitUntil.mock.calls[0][0];

		expect(await response.text()).toBe('network');
		expect(storage.cache('utilities-v1').put).toHaveBeenCalledWith(
			expect.objectContaining({ url: 'http://localhost/dashboard' }),
			expect.any(Response)
		);
	});

	it.each(['private, no-store', 'private, No-Store'])(
		'does not cache a response marked cache-control %s',
		async (cacheControl) => {
			fetchMock.mockResolvedValueOnce(
				new Response('secret', { status: 200, headers: { 'cache-control': cacheControl } })
			);
			const event = fetchEvent('http://localhost/api/whoami');
			await answer(event);

			expect(event.waitUntil).not.toHaveBeenCalled();
		}
	);

	it('does not cache a failed response, but still returns it', async () => {
		fetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }));
		const event = fetchEvent('http://localhost/missing');

		const response = await answer(event);

		expect(response.status).toBe(404);
		expect(event.waitUntil).not.toHaveBeenCalled();
	});

	it('swallows a failure to write the cache', async () => {
		storage.cache('utilities-v1').put.mockRejectedValueOnce(new Error('quota exceeded'));
		const event = fetchEvent('http://localhost/dashboard');
		await answer(event);

		await expect(event.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
	});

	it('serves a cached page when offline', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('offline'));
		storage.cache('utilities-v1').seed('http://localhost/dashboard', new Response('saved page'));

		const response = await answer(fetchEvent('http://localhost/dashboard', { mode: 'navigate' }));

		expect(await response.text()).toBe('saved page');
	});

	it('serves the sign-in page for an uncached navigation when offline', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('offline'));
		storage.cache('utilities-v1').seed('/sign-in', new Response('sign-in page'));

		const response = await answer(fetchEvent('http://localhost/notes', { mode: 'navigate' }));

		expect(await response.text()).toBe('sign-in page');
	});

	it('rethrows the network error for an uncached request that is not a navigation', async () => {
		const failure = new TypeError('offline');
		fetchMock.mockRejectedValueOnce(failure);

		const promise = answer(fetchEvent('http://localhost/data.json'));

		await expect(promise).rejects.toBe(failure);
	});
});
