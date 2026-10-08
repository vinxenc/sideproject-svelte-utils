import { flushSync } from 'svelte';
import { toast } from 'svelte-sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepare } from '#lib/media/prepare.js';
import type { Prepared } from '#lib/media/prepare.js';
import { uploads } from '#lib/media/uploads.svelte.js';
import type { Row } from '#lib/media/uploads.svelte.js';
import { uploadMedia } from '#lib/media/upload.js';
import type { MediaItem } from '#lib/media/types.js';
import { deferred, mediaItem } from '../../helpers/media.js';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
// jsdom can't decode media; a file "prepares" instantly with no thumbnail.
vi.mock('#lib/media/prepare.js', () => ({
	prepare: vi.fn(async () => ({
		takenAt: new Date(0),
		width: null,
		height: null,
		duration: null,
		thumb: null
	}))
}));
vi.mock('#lib/media/upload.js', () => ({ uploadMedia: vi.fn() }));

const photo = (name = 'a.jpg') => new File(['x'], name, { type: 'image/jpeg' });
const ITEM: MediaItem = mediaItem();
const PREPARED = (overrides: Partial<Prepared> = {}): Prepared => ({
	takenAt: new Date(0),
	width: null,
	height: null,
	duration: null,
	thumb: null,
	...overrides
});

const createObjectURL = vi.fn(() => 'blob:x');
const revokeObjectURL = vi.fn();

/** Lets queued callbacks (preview, toast, release) run before asserting. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The row for a file, found by name, as the store holds it. */
const rowFor = (name: string) => uploads.rows.find((r) => r.file.name === name) as Row;

beforeEach(() => {
	createObjectURL.mockClear();
	revokeObjectURL.mockClear();
	URL.createObjectURL = createObjectURL;
	URL.revokeObjectURL = revokeObjectURL;
	vi.mocked(prepare).mockReset().mockResolvedValue(PREPARED());
	vi.mocked(uploadMedia).mockReset().mockResolvedValue(ITEM);
});

afterEach(() => {
	uploads.close();
	vi.clearAllMocks();
	Reflect.deleteProperty(URL, 'createObjectURL');
	Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('uploads', () => {
	it('rejects unsupported files with one toast and keeps the rest', () => {
		uploads.add([new File(['x'], 'doc.pdf'), new File([''], 'empty.png'), photo()]);
		expect(uploads.rows.map((r) => r.file.name)).toEqual(['a.jpg']);
		expect(toast.error).toHaveBeenCalledExactlyOnceWith('doc.pdf: Unsupported file type', {
			description: 'and 1 more skipped'
		});
	});

	it('moves a picked file from preview to ready once it is prepared', async () => {
		uploads.add([photo()]);
		expect(uploads.rows[0].stage).toBe('preview');
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		expect(uploads.rows[0].previewUrl).toBeNull();
	});

	it('keeps pending in sync for effects as rows are added and removed', () => {
		const seen: number[] = [];
		const cleanup = $effect.root(() => {
			$effect(() => {
				seen.push(uploads.pending.length);
			});
		});
		flushSync();
		uploads.add([photo('a.jpg'), photo('b.jpg')]);
		flushSync();
		uploads.remove(uploads.rows[0]);
		flushSync();
		cleanup();
		expect(seen).toEqual([0, 2, 1]);
		expect(uploads.uploading).toBe(false);
	});

	it('shows the thumbnail and duration once a picked file is prepared', async () => {
		const thumb = new Blob(['t']);
		vi.mocked(prepare).mockResolvedValueOnce(PREPARED({ thumb, duration: 3 }));

		uploads.add([photo()]);

		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		expect(uploads.rows[0]).toMatchObject({ previewUrl: 'blob:x', duration: 3 });
		expect(createObjectURL).toHaveBeenCalledWith(thumb);

		uploads.remove(uploads.rows[0]);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
	});

	it('makes no preview for a file that was removed before it was prepared', async () => {
		const prepared = deferred<Prepared>();
		vi.mocked(prepare).mockReturnValueOnce(prepared.promise);
		uploads.add([photo()]);
		uploads.remove(uploads.rows[0]);

		prepared.resolve(PREPARED({ thumb: new Blob(['t']) }));
		await settle();

		expect(createObjectURL).not.toHaveBeenCalled();
		expect(uploads.rows).toHaveLength(0);
	});

	it('does not mark a row ready when its preview finishes after the upload has started', async () => {
		const prepared = deferred<Prepared>();
		vi.mocked(prepare).mockReturnValueOnce(prepared.promise);
		const upload = deferred<MediaItem>();
		vi.mocked(uploadMedia).mockReturnValueOnce(upload.promise);
		uploads.add([photo()]);

		const row = uploads.rows[0];
		void uploads.run(row);
		prepared.resolve(PREPARED());
		await settle();

		expect(row.stage).toBe('queued');
		upload.resolve(ITEM);
		await settle();
	});

	it('reports a single rejected file with no description', () => {
		uploads.add([new File(['x'], 'doc.pdf')]);

		expect(toast.error).toHaveBeenCalledWith('doc.pdf: Unsupported file type', {
			description: undefined
		});
	});

	it('reports progress while a file uploads, then finishes and announces it', async () => {
		const onuploaded = vi.fn();
		const detach = uploads.attach(onuploaded);
		uploads.add([photo()]);
		uploads.open = true;
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		const gate = deferred<MediaItem>();
		vi.mocked(uploadMedia).mockImplementationOnce(async (_file, _prepared, onStage) => {
			onStage('uploading', 0.4);
			return gate.promise;
		});

		uploads.submit();
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('uploading'));
		expect(uploads.rows[0].progress).toBe(0.4);

		gate.resolve(ITEM);
		await vi.waitFor(() => expect(uploads.rows).toHaveLength(0));
		expect(onuploaded).toHaveBeenCalledWith(ITEM);
		expect(uploads.open).toBe(false);
		expect(toast.success).toHaveBeenCalledWith('Added 1 item to the gallery');
		detach();
	});

	it('counts every item in the success message', async () => {
		const onuploaded = vi.fn();
		const detach = uploads.attach(onuploaded);
		uploads.add([photo('a.jpg'), photo('b.jpg')]);
		await vi.waitFor(() => expect(uploads.pending).toHaveLength(2));

		uploads.submit();

		await vi.waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith('Added 2 items to the gallery')
		);
		expect(onuploaded).toHaveBeenCalledTimes(2);
		detach();
	});

	it('records an upload error on its row and keeps the row while the dialog is open', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		uploads.open = true;
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		vi.mocked(uploadMedia).mockRejectedValueOnce(new Error('boom'));

		uploads.submit();

		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('error'));
		expect(uploads.rows[0].error).toBe('boom');
		expect(uploads.rows).toHaveLength(1);
		expect(toast.error).not.toHaveBeenCalled();
		detach();
	});

	it('uses a generic message when the failure is not an Error', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		uploads.open = true;
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		vi.mocked(uploadMedia).mockRejectedValueOnce('nope');

		uploads.submit();

		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('error'));
		expect(uploads.rows[0].error).toBe('Upload failed');
		detach();
	});

	it('offers a review action for failures while the gallery is shown and the dialog is closed', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		vi.mocked(uploadMedia).mockRejectedValueOnce(new Error('boom'));

		uploads.submit();

		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith('1 upload failed', {
			description: undefined,
			action: { label: 'Review', onClick: expect.any(Function) }
		});
		expect(uploads.rows).toHaveLength(1);
		detach();
	});

	it('reopens the dialog from the review action', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		vi.mocked(uploadMedia).mockRejectedValueOnce(new Error('boom'));
		uploads.submit();
		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

		const { action } = vi.mocked(toast.error).mock.calls[0][1] as unknown as {
			action: { onClick: () => void };
		};
		action.onClick();

		expect(uploads.open).toBe(true);
		detach();
	});

	it('describes what was added alongside a partial failure', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo('ok.jpg'), photo('bad.jpg')]);
		await vi.waitFor(() => expect(uploads.pending).toHaveLength(2));
		vi.mocked(uploadMedia).mockImplementation(async (file) => {
			if (file.name === 'bad.jpg') throw new Error('boom');
			return ITEM;
		});

		uploads.submit();

		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith('1 upload failed', {
			description: '1 added to the gallery',
			action: { label: 'Review', onClick: expect.any(Function) }
		});
		detach();
	});

	it('counts every failure in the message', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo('a.jpg'), photo('b.jpg')]);
		await vi.waitFor(() => expect(uploads.pending).toHaveLength(2));
		vi.mocked(uploadMedia).mockRejectedValue(new Error('boom'));

		uploads.submit();

		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith('2 uploads failed', {
			description: undefined,
			action: { label: 'Review', onClick: expect.any(Function) }
		});
		detach();
	});

	it('does not offer a review action once the gallery has been left', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		vi.mocked(uploadMedia).mockRejectedValueOnce(new Error('boom'));
		uploads.submit();
		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		const { action } = vi.mocked(toast.error).mock.calls[0][1] as unknown as {
			action: { onClick: () => void };
		};

		detach();
		action.onClick();

		expect(uploads.open).toBe(false);
	});

	it('clears the failed rows and gives no action when nothing is listening', async () => {
		uploads.add([photo()]);
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		vi.mocked(uploadMedia).mockRejectedValueOnce(new Error('boom'));

		uploads.submit();

		await vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith('1 upload failed', {
			description: undefined,
			action: undefined
		});
		expect(uploads.rows).toHaveLength(0);
	});

	it('submits only files that are not already done or in flight', async () => {
		uploads.add([photo('a.jpg'), photo('b.jpg'), photo('c.jpg')]);
		await vi.waitFor(() => expect(uploads.pending).toHaveLength(3));
		const inFlight = deferred<MediaItem>();
		vi.mocked(uploadMedia).mockReturnValueOnce(inFlight.promise);
		const b = rowFor('b.jpg');
		const a = rowFor('a.jpg');
		void uploads.run(b);
		await uploads.run(a);
		expect(a.stage).toBe('done');
		const before = vi.mocked(uploadMedia).mock.calls.length;

		uploads.submit();

		expect(vi.mocked(uploadMedia).mock.calls.length).toBe(before + 1);
		expect(vi.mocked(uploadMedia).mock.calls.at(-1)?.[0].name).toBe('c.jpg');
		inFlight.resolve(ITEM);
		await settle();
	});

	it('keeps the rows and closes the dialog when it is shut while uploads run', async () => {
		uploads.add([photo()]);
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		const upload = deferred<MediaItem>();
		vi.mocked(uploadMedia).mockReturnValueOnce(upload.promise);
		uploads.open = true;
		uploads.submit();

		uploads.close();

		expect(uploads.open).toBe(false);
		expect(uploads.rows).toHaveLength(1);
		upload.resolve(ITEM);
		await settle();
	});

	it('discards a selection when the gallery is left while idle', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		uploads.open = true;

		detach();

		expect(uploads.open).toBe(false);
		expect(uploads.rows).toHaveLength(0);
	});

	it('keeps the uploads running when the gallery is left mid-upload', async () => {
		const detach = uploads.attach(vi.fn());
		uploads.add([photo()]);
		await vi.waitFor(() => expect(uploads.rows[0].stage).toBe('ready'));
		const upload = deferred<MediaItem>();
		vi.mocked(uploadMedia).mockReturnValueOnce(upload.promise);
		uploads.open = true;
		uploads.submit();

		detach();

		expect(uploads.open).toBe(false);
		expect(uploads.rows).toHaveLength(1);
		upload.resolve(ITEM);
		await settle();
	});
});
