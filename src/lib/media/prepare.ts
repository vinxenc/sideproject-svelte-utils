import { THUMB_TYPE } from './types.js';
import type { MediaKind } from './types.js';

// Longest edge of a thumbnail or video poster, in pixels. The gallery shows some tiles at 2x2
// (about 500 CSS px wide), which needs this much to stay sharp on a high-DPI screen.
const THUMB_SIZE = 1024;
const THUMB_QUALITY = 0.8;
// A browser that can't decode a file may never fire the event we are waiting for.
const DECODE_TIMEOUT_MS = 10_000;

/** What the browser can work out about a file before it is uploaded. */
export type Prepared = {
	takenAt: Date;
	/** Null when the browser can't decode the file (e.g. HEIC on Chrome). */
	width: number | null;
	height: number | null;
	/** Seconds, videos only. */
	duration: number | null;
	/** A JPEG of the photo or a frame of the video; null when the file can't be decoded. */
	thumb: Blob | null;
};

export async function prepare(file: File, kind: MediaKind): Promise<Prepared> {
	const [takenAt, decoded] = await Promise.all([
		kind === 'IMAGE' ? dateTaken(file) : null,
		kind === 'IMAGE' ? decodeImage(file) : decodeVideo(file)
	]);
	return { takenAt: takenAt ?? new Date(file.lastModified), ...decoded };
}

async function dateTaken(file: File) {
	try {
		const { parse } = await import('exifr');
		const tags = await parse(file, ['DateTimeOriginal', 'CreateDate']);
		const date: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
		return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
	} catch {
		return null; // no EXIF, or a format exifr can't read
	}
}

type Decoded = Omit<Prepared, 'takenAt'>;

async function decodeImage(file: File): Promise<Decoded> {
	let bitmap: ImageBitmap | undefined;
	try {
		// Applies the EXIF orientation, so width/height and the thumbnail are as the photo is shown.
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const thumb = await encodeThumb(bitmap, bitmap.width, bitmap.height);
		return { width: bitmap.width, height: bitmap.height, duration: null, thumb };
	} catch {
		// The browser can't decode this format: upload it without a thumbnail.
		return { width: null, height: null, duration: null, thumb: null };
	} finally {
		bitmap?.close();
	}
}

async function decodeVideo(file: File): Promise<Decoded> {
	const url = URL.createObjectURL(file);
	const video = document.createElement('video');
	const result: Decoded = { width: null, height: null, duration: null, thumb: null };
	try {
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.src = url;
		await once(video, 'loadeddata');

		result.duration = Number.isFinite(video.duration) ? video.duration : null;
		if (video.videoWidth && video.videoHeight) {
			result.width = video.videoWidth;
			result.height = video.videoHeight;
			// A frame from 1 s in skips fade-ins; clips shorter than 2 s use their middle instead.
			// Without a duration (browser-recorded WebM) the stream may not be seekable: take the first frame.
			const at = result.duration === null ? 0 : Math.min(1, result.duration / 2);
			if (at > 0) {
				video.currentTime = at;
				await once(video, 'seeked');
			}
			result.thumb = await encodeThumb(video, result.width, result.height);
		}
	} catch {
		// Undecodable or timed out: keep whatever was read before it failed.
	} finally {
		video.removeAttribute('src');
		video.load(); // releases the decoder
		URL.revokeObjectURL(url);
	}
	return result;
}

function once(video: HTMLVideoElement, event: string) {
	const signal = AbortSignal.timeout(DECODE_TIMEOUT_MS);
	return new Promise<void>((resolve, reject) => {
		video.addEventListener(event, () => resolve(), { once: true, signal });
		video.addEventListener('error', () => reject(new Error('The video could not be decoded')), {
			once: true,
			signal
		});
		signal.addEventListener('abort', () => reject(signal.reason), { once: true });
	});
}

async function encodeThumb(source: CanvasImageSource, width: number, height: number) {
	const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width * scale));
	canvas.height = Math.max(1, Math.round(height * scale));
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	// JPEG has no alpha channel: put the image on white rather than letting transparent pixels turn black.
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, THUMB_TYPE, THUMB_QUALITY));
}
