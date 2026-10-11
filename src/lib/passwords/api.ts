import type { PasswordInput, PasswordItem, RevealResult } from './types.js';

/** Same message rule as albums/api.ts (the server's `message`, else `Request failed (<status>)`), plus the status. */
export class ApiError extends Error {
	readonly status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

// Same error shape as albums/api.ts's send(), but carries the status so callers can tell 404 apart.
async function send(url: string, init: RequestInit): Promise<Response> {
	const res = await fetch(url, init);
	if (!res.ok) {
		const error = await res.json().catch(() => null);
		throw new ApiError(
			typeof error?.message === 'string' ? error.message : `Request failed (${res.status})`,
			res.status
		);
	}
	return res;
}

export async function createPassword(input: PasswordInput): Promise<PasswordItem> {
	const res = await send('/api/passwords', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(input)
	});
	return (await res.json()) as PasswordItem;
}

export async function deletePassword(id: string): Promise<void> {
	await send(`/api/passwords/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** POST, not GET: the service worker only handles GET, and phase 2 will send a body. */
export async function revealPassword(id: string): Promise<string> {
	const res = await send(`/api/passwords/${encodeURIComponent(id)}/reveal`, { method: 'POST' });
	return ((await res.json()) as RevealResult).password;
}
