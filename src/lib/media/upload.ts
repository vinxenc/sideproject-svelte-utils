import type { Prepared } from './prepare.js';
import { THUMB_TYPE } from './types.js';
import type { MediaItem, UploadTicket } from './types.js';

const MAX_CONCURRENT = 3;

// One limit for the whole page, however many drops queued files: a slot is held for a file's
// entire pipeline (prepare, upload, complete), and release() hands it straight to the next waiter.
let running = 0;
const waiting: (() => void)[] = [];

async function acquire() {
	if (running < MAX_CONCURRENT) {
		running++;
		return;
	}
	await new Promise<void>((resolve) => waiting.push(resolve));
}

function release() {
	const next = waiting.shift();
	if (next) next();
	else running--;
}

export type UploadStage = 'preparing' | 'uploading' | 'finishing';

async function post<T>(url: string, body?: unknown): Promise<T> {
	const res = await fetch(url, {
		method: 'POST',
		...(body === undefined
			? {}
			: { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
	});
	if (!res.ok) {
		const error = await res.json().catch(() => null);
		throw new Error(
			typeof error?.message === 'string' ? error.message : `Request failed (${res.status})`
		);
	}
	return res.json();
}

// XMLHttpRequest rather than fetch: it is the only way to get upload progress.
function put(
	url: string,
	contentType: string,
	body: Blob,
	onProgress?: (fraction: number) => void
) {
	return new Promise<void>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		// The URL is signed for exactly this type; any other makes storage answer 403.
		xhr.setRequestHeader('Content-Type', contentType);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress?.(e.loaded / e.total);
		};
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(`Upload failed (${xhr.status})`));
		xhr.onerror = () => reject(new Error('Network error while uploading'));
		xhr.send(body);
	});
}

/**
 * Uploads one photo or video straight to object storage and returns the finished item. Waits for one
 * of the 3 upload slots first; `onStage` reports where the file is, and `fraction` (0..1) the original's upload.
 * `preparing` is the file's `prepare()`, usually started earlier for its preview and possibly still running.
 */
export async function uploadMedia(
	file: File,
	preparing: Promise<Prepared>,
	onStage: (stage: UploadStage, fraction: number) => void
): Promise<MediaItem> {
	await acquire();
	try {
		onStage('preparing', 0);
		const prepared = await preparing;

		const ticket = await post<UploadTicket>('/api/media', {
			name: file.name,
			type: file.type,
			size: file.size,
			takenAt: prepared.takenAt.toISOString(),
			width: prepared.width,
			height: prepared.height,
			duration: prepared.duration,
			thumb: prepared.thumb?.size
		});

		onStage('uploading', 0);
		const { thumb } = prepared;
		await Promise.all([
			put(ticket.original, ticket.contentType, file, (fraction) => onStage('uploading', fraction)),
			// A missing thumbnail only costs a placeholder tile, so it must not fail the upload.
			thumb && ticket.thumb
				? put(ticket.thumb, THUMB_TYPE, thumb).catch((e) =>
						console.warn('Thumbnail upload failed', e)
					)
				: null
		]);

		onStage('finishing', 1);
		return await post<MediaItem>(`/api/media/${ticket.id}/complete`);
	} finally {
		release();
	}
}
