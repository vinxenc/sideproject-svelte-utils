import { parse } from 'exifr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepare } from '#lib/media/prepare.js';

vi.mock('exifr', () => ({ parse: vi.fn() }));

const LAST_MODIFIED = Date.parse('2024-02-02T12:00:00.000Z');
const photo = (name = 'a.jpg') =>
	new File(['p'], name, { type: 'image/jpeg', lastModified: LAST_MODIFIED });
const clip = () => new File(['v'], 'clip.mp4', { type: 'video/mp4', lastModified: LAST_MODIFIED });
const lastModified = new Date(LAST_MODIFIED);

const bitmap = (width: number, height: number) => ({ width, height, close: vi.fn() });

let ctx: {
	fillRect: ReturnType<typeof vi.fn>;
	drawImage: ReturnType<typeof vi.fn>;
	fillStyle: string;
	imageSmoothingQuality: string;
};
/** Every canvas that asked for a 2D context, in order; their width/height are what was drawn. */
let canvases: HTMLCanvasElement[];
let videos: HTMLVideoElement[];
let toBlob: ReturnType<typeof vi.spyOn>;
let load: ReturnType<typeof vi.spyOn>;
const createObjectURL = vi.fn(() => 'blob:x');
const revokeObjectURL = vi.fn();

beforeEach(() => {
	vi.mocked(parse).mockReset().mockResolvedValue(undefined);
	ctx = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '', imageSmoothingQuality: '' };
	canvases = [];
	videos = [];
	vi.stubGlobal(
		'createImageBitmap',
		vi.fn(async () => bitmap(4000, 3000))
	);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
		this: HTMLCanvasElement
	) {
		canvases.push(this);
		return ctx as unknown as CanvasRenderingContext2D;
	});
	toBlob = vi
		.spyOn(HTMLCanvasElement.prototype, 'toBlob')
		.mockImplementation((callback) => callback?.(new Blob(['t'], { type: 'image/jpeg' })));
	load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
	const createElement = document.createElement.bind(document);
	vi.spyOn(document, 'createElement').mockImplementation(((
		tag: string,
		options?: ElementCreationOptions
	) => {
		const el = createElement(tag, options);
		if (tag === 'video') videos.push(el as HTMLVideoElement);
		return el;
	}) as typeof document.createElement);
	URL.createObjectURL = createObjectURL;
	URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	createObjectURL.mockClear();
	revokeObjectURL.mockClear();
	Reflect.deleteProperty(URL, 'createObjectURL');
	Reflect.deleteProperty(URL, 'revokeObjectURL');
});

/** Gives the captured <video> the metadata a real decoder would report. */
function describeVideo(
	video: HTMLVideoElement,
	{ duration, width, height }: { duration: number; width: number; height: number }
) {
	Object.defineProperty(video, 'duration', { configurable: true, value: duration });
	Object.defineProperty(video, 'videoWidth', { configurable: true, value: width });
	Object.defineProperty(video, 'videoHeight', { configurable: true, value: height });
	let time = 0;
	Object.defineProperty(video, 'currentTime', {
		configurable: true,
		get: () => time,
		set: (v: number) => {
			time = v;
		}
	});
}

describe('prepare: photos', () => {
	it('takes the date from the EXIF DateTimeOriginal', async () => {
		vi.mocked(parse).mockResolvedValue({ DateTimeOriginal: new Date('2023-03-04T05:06:07Z') });

		const result = await prepare(photo(), 'IMAGE');

		expect(parse).toHaveBeenCalledWith(expect.any(File), ['DateTimeOriginal', 'CreateDate']);
		expect(result.takenAt).toEqual(new Date('2023-03-04T05:06:07Z'));
	});

	it('falls back to the EXIF CreateDate', async () => {
		vi.mocked(parse).mockResolvedValue({ CreateDate: new Date('2022-01-01T00:00:00Z') });

		const result = await prepare(photo(), 'IMAGE');

		expect(result.takenAt).toEqual(new Date('2022-01-01T00:00:00Z'));
	});

	it('uses the last-modified time when the photo has no EXIF date', async () => {
		vi.mocked(parse).mockResolvedValue(undefined);

		expect((await prepare(photo(), 'IMAGE')).takenAt).toEqual(lastModified);
	});

	it('uses the last-modified time when the EXIF date is invalid', async () => {
		vi.mocked(parse).mockResolvedValue({ DateTimeOriginal: new Date('nonsense') });

		expect((await prepare(photo(), 'IMAGE')).takenAt).toEqual(lastModified);
	});

	it('uses the last-modified time when the EXIF cannot be read', async () => {
		vi.mocked(parse).mockRejectedValue(new Error('not a JPEG'));

		expect((await prepare(photo(), 'IMAGE')).takenAt).toEqual(lastModified);
	});

	it('scales a 4000x3000 photo to a 1024x768 JPEG thumbnail and reports its full size', async () => {
		const result = await prepare(photo(), 'IMAGE');

		expect(result).toMatchObject({ width: 4000, height: 3000, duration: null });
		expect(result.thumb).toBeInstanceOf(Blob);
		expect(canvases[0]).toMatchObject({ width: 1024, height: 768 });
		expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
		expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1024, 768);
	});

	it('does not enlarge a small photo', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => bitmap(500, 400))
		);

		await prepare(photo(), 'IMAGE');

		expect(canvases[0]).toMatchObject({ width: 500, height: 400 });
	});

	it('keeps a thumbnail at least one pixel wide for a very tall photo', async () => {
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => bitmap(1, 5000))
		);

		await prepare(photo(), 'IMAGE');

		expect(canvases[0].width).toBe(1);
	});

	it('still reports the size when the browser gives no canvas context', async () => {
		vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);

		const result = await prepare(photo(), 'IMAGE');

		expect(result).toMatchObject({ width: 4000, height: 3000, thumb: null });
	});

	it('reports nothing about a photo the browser cannot decode, and closes nothing', async () => {
		const decodeFailure = vi.fn(async () => {
			throw new Error('unsupported');
		});
		vi.stubGlobal('createImageBitmap', decodeFailure);

		const result = await prepare(photo(), 'IMAGE');

		expect(result).toEqual({
			takenAt: lastModified,
			width: null,
			height: null,
			duration: null,
			thumb: null
		});
	});

	it('closes the decoded bitmap once the thumbnail is made', async () => {
		const decoded = bitmap(4000, 3000);
		vi.stubGlobal(
			'createImageBitmap',
			vi.fn(async () => decoded)
		);

		await prepare(photo(), 'IMAGE');

		expect(decoded.close).toHaveBeenCalledTimes(1);
	});
});

describe('prepare: videos', () => {
	it('reads duration and size, and takes a thumbnail a second in', async () => {
		const pending = prepare(clip(), 'VIDEO');
		const video = videos[0];
		describeVideo(video, { duration: 10, width: 1920, height: 1080 });
		video.dispatchEvent(new Event('loadeddata'));
		await vi.waitFor(() => expect(video.currentTime).toBe(1));
		video.dispatchEvent(new Event('seeked'));

		const result = await pending;

		expect(result).toMatchObject({
			takenAt: lastModified,
			width: 1920,
			height: 1080,
			duration: 10
		});
		expect(result.thumb).toBeInstanceOf(Blob);
		expect(createObjectURL).toHaveBeenCalledWith(expect.any(File));
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
		expect(video.hasAttribute('src')).toBe(false);
		expect(load).toHaveBeenCalled();
	});

	it('takes the middle frame of a clip shorter than two seconds', async () => {
		const pending = prepare(clip(), 'VIDEO');
		const video = videos[0];
		describeVideo(video, { duration: 1, width: 640, height: 480 });
		video.dispatchEvent(new Event('loadeddata'));
		await vi.waitFor(() => expect(video.currentTime).toBe(0.5));
		video.dispatchEvent(new Event('seeked'));

		await pending;

		expect(video.currentTime).toBe(0.5);
	});

	it('takes the first frame when the duration is unknown, without seeking', async () => {
		const pending = prepare(clip(), 'VIDEO');
		const video = videos[0];
		describeVideo(video, { duration: Infinity, width: 640, height: 480 });
		video.dispatchEvent(new Event('loadeddata'));

		const result = await pending;

		expect(result).toMatchObject({ duration: null, width: 640, height: 480 });
		expect(result.thumb).toBeInstanceOf(Blob);
		expect(video.currentTime).toBe(0);
	});

	it('keeps the duration but makes no thumbnail when the frame size is zero', async () => {
		const pending = prepare(clip(), 'VIDEO');
		const video = videos[0];
		describeVideo(video, { duration: 10, width: 0, height: 0 });
		video.dispatchEvent(new Event('loadeddata'));

		const result = await pending;

		expect(result).toEqual({
			takenAt: lastModified,
			width: null,
			height: null,
			duration: 10,
			thumb: null
		});
		expect(video.currentTime).toBe(0);
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
	});

	it('reports nothing when the video fails to decode', async () => {
		const pending = prepare(clip(), 'VIDEO');
		const video = videos[0];
		video.dispatchEvent(new Event('error'));

		expect(await pending).toEqual({
			takenAt: lastModified,
			width: null,
			height: null,
			duration: null,
			thumb: null
		});
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
		expect(load).toHaveBeenCalled();
		expect(video.hasAttribute('src')).toBe(false);
	});

	it('gives up on a video that never loads', async () => {
		const controller = new AbortController();
		vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
		const pending = prepare(clip(), 'VIDEO');
		const video = videos[0];

		controller.abort(new Error('timeout'));

		expect(await pending).toEqual({
			takenAt: lastModified,
			width: null,
			height: null,
			duration: null,
			thumb: null
		});
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
		expect(video.hasAttribute('src')).toBe(false);
	});
});
