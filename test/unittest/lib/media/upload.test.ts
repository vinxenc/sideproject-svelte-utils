import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prepared } from '#lib/media/prepare.js';
import type { UploadStage } from '#lib/media/upload.js';
import { deferred, mediaItem } from '../../helpers/media.js';

type Upload = typeof import('#lib/media/upload.js');

/** XMLHttpRequest stand-in: records each PUT, and settles it by hand or, with `autoStatus`, by itself. */
class FakeXHR {
	static instances: FakeXHR[] = [];
	/** When set, every send settles on its own: with this status, or with a network error. */
	static autoStatus: number | 'network' | null = null;

	method = '';
	url = '';
	headers: Record<string, string> = {};
	body: unknown;
	status = 0;
	upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;

	constructor() {
		FakeXHR.instances.push(this);
	}

	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(name: string, value: string) {
		this.headers[name] = value;
	}

	send(body: unknown) {
		this.body = body;
		const auto = FakeXHR.autoStatus;
		if (auto === null) return;
		queueMicrotask(() => (auto === 'network' ? this.fail() : this.respond(auto)));
	}

	respond(status: number) {
		this.status = status;
		this.onload?.();
	}

	fail() {
		this.onerror?.();
	}

	progress(loaded: number, total: number, lengthComputable = true) {
		this.upload.onprogress?.({ loaded, total, lengthComputable } as ProgressEvent);
	}
}

const TICKET = {
	id: 'm1',
	contentType: 'image/jpeg',
	original: 'https://s3/o',
	thumb: 'https://s3/t'
};
const ITEM = mediaItem();
const file = new File(['photo-bytes'], 'beach.jpg', { type: 'image/jpeg' });
const takenAt = new Date('2024-05-01T10:00:00.000Z');
const prepared = (overrides: Partial<Prepared> = {}): Prepared => ({
	takenAt,
	width: 1600,
	height: 1200,
	duration: null,
	thumb: new Blob(['tt'], { type: 'image/jpeg' }),
	...overrides
});

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
let uploadMedia: Upload['uploadMedia'];

/** Answers the API the way the server does: a ticket for the first call, the item for the completion. */
function serveApi(ticket: unknown = TICKET, status = 201) {
	fetchMock.mockImplementation(async (url) =>
		url === '/api/media' ? json(ticket, status) : json(ITEM)
	);
}

/** Waits for the upload to start its PUTs, returning [original, thumb]. */
async function puts(count = 2) {
	await vi.waitFor(() => expect(FakeXHR.instances).toHaveLength(count));
	return FakeXHR.instances;
}

beforeEach(async () => {
	vi.resetModules();
	({ uploadMedia } = await import('#lib/media/upload.js'));
	FakeXHR.instances = [];
	FakeXHR.autoStatus = null;
	fetchMock.mockReset();
	serveApi();
	vi.stubGlobal('fetch', fetchMock);
	vi.stubGlobal('XMLHttpRequest', FakeXHR);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('uploadMedia', () => {
	it('reports each stage, and the upload progress of the original', async () => {
		const onStage = vi.fn<(stage: UploadStage, fraction: number) => void>();
		const run = uploadMedia(file, Promise.resolve(prepared()), onStage);

		const [original, thumb] = await puts();
		original.progress(50, 100);
		original.respond(200);
		thumb.respond(200);

		await expect(run).resolves.toEqual(ITEM);
		expect(onStage.mock.calls).toEqual([
			['preparing', 0],
			['uploading', 0],
			['uploading', 0.5],
			['finishing', 1]
		]);
	});

	it('posts the file description, with the thumbnail size, as JSON', async () => {
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original, thumb] = await puts();
		original.respond(200);
		thumb.respond(200);
		await run;

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/media');
		expect(init?.method).toBe('POST');
		expect(init?.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.parse(init?.body as string)).toEqual({
			name: 'beach.jpg',
			type: 'image/jpeg',
			size: file.size,
			takenAt: takenAt.toISOString(),
			width: 1600,
			height: 1200,
			duration: null,
			thumb: 2
		});
	});

	it('PUTs the file to the signed original URL and the thumbnail to the signed thumb URL', async () => {
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original, thumb] = await puts();
		original.respond(200);
		thumb.respond(200);
		await run;

		expect(original).toMatchObject({ method: 'PUT', url: 'https://s3/o' });
		expect(original.headers).toEqual({ 'Content-Type': 'image/jpeg' });
		expect(original.body).toBe(file);
		expect(thumb).toMatchObject({ method: 'PUT', url: 'https://s3/t' });
		expect(thumb.headers).toEqual({ 'Content-Type': 'image/jpeg' });
	});

	it('ignores progress that the browser cannot measure', async () => {
		const onStage = vi.fn();
		const run = uploadMedia(file, Promise.resolve(prepared()), onStage);
		const [original, thumb] = await puts();

		original.progress(50, 100, false);
		original.respond(200);
		thumb.respond(200);
		await run;

		expect(onStage.mock.calls.filter(([stage]) => stage === 'uploading')).toEqual([
			['uploading', 0]
		]);
	});

	it('uploads only the original when there is no thumbnail to send', async () => {
		const run = uploadMedia(file, Promise.resolve(prepared({ thumb: null })), vi.fn());
		const [original] = await puts(1);
		original.respond(200);

		await run;

		expect(FakeXHR.instances).toHaveLength(1);
		const init = fetchMock.mock.calls[0][1];
		expect(JSON.parse(init?.body as string)).not.toHaveProperty('thumb');
	});

	it('uploads only the original when the server issues no thumbnail URL', async () => {
		serveApi({ ...TICKET, thumb: null });
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original] = await puts(1);
		original.respond(200);

		await run;

		expect(FakeXHR.instances).toHaveLength(1);
	});

	it('still succeeds when the thumbnail upload fails, and logs it', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original, thumb] = await puts();
		original.respond(200);
		thumb.respond(500);

		await expect(run).resolves.toEqual(ITEM);
		expect(warn).toHaveBeenCalledWith('Thumbnail upload failed', expect.any(Error));
	});

	it('rejects when the original is refused', async () => {
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original, thumb] = await puts();
		original.respond(403);
		thumb.respond(200);

		await expect(run).rejects.toThrow('Upload failed (403)');
	});

	it('rejects with a network message when the connection drops', async () => {
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original, thumb] = await puts();
		original.fail();
		thumb.respond(200);

		await expect(run).rejects.toThrow('Network error while uploading');
	});

	it('passes the server message through when creating the upload is refused', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 'Unsupported file type' }, 400));

		await expect(uploadMedia(file, Promise.resolve(prepared()), vi.fn())).rejects.toThrow(
			'Unsupported file type'
		);
	});

	it('falls back to the status when the error body is not JSON', async () => {
		fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));

		await expect(uploadMedia(file, Promise.resolve(prepared()), vi.fn())).rejects.toThrow(
			'Request failed (500)'
		);
	});

	it('falls back to the status when the message is not text', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 42 }, 400));

		await expect(uploadMedia(file, Promise.resolve(prepared()), vi.fn())).rejects.toThrow(
			'Request failed (400)'
		);
	});

	it('completes the upload with a bodyless POST', async () => {
		const run = uploadMedia(file, Promise.resolve(prepared()), vi.fn());
		const [original, thumb] = await puts();
		original.respond(200);
		thumb.respond(200);
		await run;

		expect(fetchMock).toHaveBeenLastCalledWith('/api/media/m1/complete', { method: 'POST' });
	});

	it('keeps at most three uploads in their preparing stage at once, and hands a slot on as soon as one ends', async () => {
		FakeXHR.autoStatus = 200;
		const preps = [0, 1, 2, 3].map(() => deferred<Prepared>());
		const stages = [0, 1, 2, 3].map(() => vi.fn());
		const runs = preps.map((p, i) => {
			const run = uploadMedia(file, p.promise, stages[i]);
			run.catch(() => {});
			return run;
		});
		const sawPreparing = (i: number) =>
			stages[i].mock.calls.some((call) => call[0] === 'preparing');

		await Promise.resolve();
		await Promise.resolve();
		expect(stages.filter((_, i) => sawPreparing(i))).toHaveLength(3);
		expect(sawPreparing(3)).toBe(false);

		preps[0].reject(new Error('cannot read'));
		await expect(runs[0]).rejects.toThrow('cannot read');
		await vi.waitFor(() => expect(sawPreparing(3)).toBe(true));

		for (const p of preps.slice(1)) p.resolve(prepared());
		await Promise.allSettled(runs.slice(1));

		// A free slot is taken at once: the fifth file starts without waiting for anything else.
		const fifth = vi.fn();
		const later = uploadMedia(file, Promise.resolve(prepared()), fifth);
		await vi.waitFor(() => expect(fifth).toHaveBeenCalledWith('preparing', 0));
		await later;
	});
});
