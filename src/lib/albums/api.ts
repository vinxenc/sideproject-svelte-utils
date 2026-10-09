import {
	MAX_ITEMS_PER_REQUEST,
	type AddItemsResult,
	type AlbumPage,
	type AlbumSummary,
	type ItemsRequest,
	type RemoveItemsResult
} from './types.js';

// Same error shape as upload.ts's post(): the server's message when it sent one.
async function send(url: string, init: RequestInit): Promise<Response> {
	const res = await fetch(url, init);
	if (!res.ok) {
		const error = await res.json().catch(() => null);
		throw new Error(
			typeof error?.message === 'string' ? error.message : `Request failed (${res.status})`
		);
	}
	return res;
}

function sendJson(url: string, method: string, body: unknown): Promise<Response> {
	return send(url, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

export async function fetchAlbums(opts: { limit?: number; cursor?: string | null } = {}) {
	const params = new URLSearchParams();
	if (opts.limit !== undefined) params.set('limit', String(opts.limit));
	if (opts.cursor) params.set('cursor', opts.cursor);
	const query = params.toString();
	const res = await send(`/api/albums${query ? `?${query}` : ''}`, {});
	return (await res.json()) as AlbumPage;
}

export async function createAlbum(name: string) {
	const res = await sendJson('/api/albums', 'POST', { name });
	return (await res.json()) as AlbumSummary;
}

export async function deleteAlbum(id: string): Promise<void> {
	await send(`/api/albums/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Splits `mediaIds` into chunks of MAX_ITEMS_PER_REQUEST, sent one after another; returns the summed `added`. */
export async function addToAlbum(id: string, mediaIds: string[]): Promise<number> {
	let added = 0;
	for (const chunk of chunks(mediaIds)) {
		const res = await sendJson(`/api/albums/${encodeURIComponent(id)}/items`, 'POST', {
			mediaIds: chunk
		} satisfies ItemsRequest);
		added += ((await res.json()) as AddItemsResult).added;
	}
	return added;
}

/** Same chunking; returns the summed `removed`. */
export async function removeFromAlbum(id: string, mediaIds: string[]): Promise<number> {
	let removed = 0;
	for (const chunk of chunks(mediaIds)) {
		const res = await sendJson(`/api/albums/${encodeURIComponent(id)}/items`, 'DELETE', {
			mediaIds: chunk
		} satisfies ItemsRequest);
		removed += ((await res.json()) as RemoveItemsResult).removed;
	}
	return removed;
}

function chunks(ids: string[]) {
	const out: string[][] = [];
	for (let i = 0; i < ids.length; i += MAX_ITEMS_PER_REQUEST)
		out.push(ids.slice(i, i + MAX_ITEMS_PER_REQUEST));
	return out;
}
