import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `cache-${version}`;
// Hashed build output (JS/CSS): its URL changes whenever its content does.
const IMMUTABLE = immutable.map(({ path }) => path);
// Offline fallback for any page that isn't cached ("/" is only a redirect).
const FALLBACK = '/sign-in';
// Precached for offline: build output, everything in /static, and the fallback page.
const ASSETS = [...IMMUTABLE, ...assets.map(({ path }) => path), FALLBACK];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Hashed files can never be stale: cache-first.
			const hit = IMMUTABLE.includes(url.pathname) && (await cache.match(url.pathname));
			if (hit) return hit;

			// Everything else (pages, /static files like the manifest): network-first, cache when offline.
			try {
				const response = await fetch(event.request);
				if (response.status === 200) cache.put(event.request, response.clone());
				return response;
			} catch (err) {
				const cached = (await cache.match(event.request)) ?? (await cache.match(FALLBACK));
				if (cached) return cached;
				throw err;
			}
		})()
	);
});
