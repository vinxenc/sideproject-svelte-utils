// Shared by the browser (checks before uploading) and the server (enforcement), so both agree on
// what an acceptable photo or video is.

export type MediaKind = 'IMAGE' | 'VIDEO';

const MB = 1024 * 1024;
const MAX_BYTES: Record<MediaKind, number> = { IMAGE: 50 * MB, VIDEO: 1024 * MB };

// Canonical MIME type, its kind, and the extensions that identify it when the browser reports no type.
const TYPES: [type: string, kind: MediaKind, extensions: string[]][] = [
	['image/jpeg', 'IMAGE', ['jpg', 'jpeg']],
	['image/png', 'IMAGE', ['png']],
	['image/webp', 'IMAGE', ['webp']],
	['image/gif', 'IMAGE', ['gif']],
	['image/heic', 'IMAGE', ['heic']],
	['image/heif', 'IMAGE', ['heif']],
	['image/avif', 'IMAGE', ['avif']],
	['video/mp4', 'VIDEO', ['mp4']],
	['video/webm', 'VIDEO', ['webm']],
	['video/quicktime', 'VIDEO', ['mov']]
];

const KIND_BY_TYPE = new Map<string, MediaKind>(TYPES.map(([type, kind]) => [type, kind] as const));
const TYPE_BY_EXTENSION = new Map<string, string>(
	TYPES.flatMap(([type, , extensions]) => extensions.map((ext) => [ext, type] as const))
);

/** Thumbnails and video posters are always JPEG, the one format every browser can encode. */
export const THUMB_TYPE = 'image/jpeg';

type MediaCheck = { ok: true; contentType: string; kind: MediaKind } | { ok: false; error: string };

/** Whether a file is an allowed photo or video, and its canonical content type. */
export function checkMedia(file: { name: string; type: string; size: number }): MediaCheck {
	const reported = file.type.split(';')[0].trim().toLowerCase();
	// Browsers report an empty type for some formats (HEIC on Chrome, MOV on Windows): go by extension.
	const dot = file.name.lastIndexOf('.');
	const byExtension =
		dot > 0 ? TYPE_BY_EXTENSION.get(file.name.slice(dot + 1).toLowerCase()) : undefined;
	const contentType = reported || byExtension;
	const kind = contentType ? KIND_BY_TYPE.get(contentType) : undefined;
	if (!contentType || !kind) return { ok: false, error: 'Unsupported file type' };

	if (!(file.size > 0)) return { ok: false, error: 'The file is empty' };
	if (file.size > MAX_BYTES[kind]) {
		return {
			ok: false,
			error: kind === 'IMAGE' ? 'Photos can be up to 50 MB' : 'Videos can be up to 1 GB'
		};
	}
	return { ok: true, contentType, kind };
}

/** A READY item as the API returns it. */
export type MediaItem = {
	id: string;
	kind: MediaKind;
	name: string;
	/** Pixels as shown (EXIF rotation applied); null when the browser couldn't decode the file. */
	width: number | null;
	height: number | null;
	/** Seconds, videos only. */
	duration: number | null;
	/** ISO 8601 */
	takenAt: string;
	hasThumb: boolean;
};

export type MediaPage = { items: MediaItem[]; nextCursor: string | null };

/** What `POST /api/media` returns: where to PUT the bytes. Each URL signs the Content-Type and the byte length it must be sent with. */
export type UploadTicket = {
	id: string;
	/** Content-Type for the original (the canonical type, not whatever the browser reported). */
	contentType: string;
	original: string;
	/** Only present when the request announced the thumbnail's size in `thumb`; PUT exactly that many bytes with `THUMB_TYPE`. */
	thumb: string | null;
};
