import { toast } from 'svelte-sonner';
import { prepare } from './prepare.js';
import type { Prepared } from './prepare.js';
import { checkMedia } from './types.js';
import type { MediaItem, MediaKind } from './types.js';
import { uploadMedia } from './upload.js';
import type { UploadStage } from './upload.js';

export type Row = {
	key: number;
	file: File;
	kind: MediaKind;
	/** The thumbnail and metadata; started when the file is picked, reused by the upload. */
	prepared: Promise<Prepared>;
	/** Object URL of the thumbnail or poster; null until it is made, or if the browser can't decode the file. */
	previewUrl: string | null;
	duration: number | null;
	stage: 'preview' | 'ready' | 'queued' | UploadStage | 'done' | 'error';
	/** 0..1, of the original's upload */
	progress: number;
	error: string;
	/** The album the file goes into, or null for the library alone. */
	album: { id: string; name: string } | null;
};

export const inFlight = (row: Row) =>
	row.stage === 'queued' ||
	row.stage === 'preparing' ||
	row.stage === 'uploading' ||
	row.stage === 'finishing';

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function release(row: Row) {
	if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
}

/**
 * The files being added to the gallery, for as long as the page lives rather than the dialog or the
 * tab that shows them, so an upload that is still running when the user leaves is announced once it ends.
 */
class Uploads {
	rows = $state<Row[]>([]);
	open = $state(false);
	uploading = $derived(this.rows.some(inFlight));
	/** What Submit would upload: everything chosen and not yet sent, plus uploads to retry. */
	pending = $derived(
		this.rows.filter((r) => r.stage === 'preview' || r.stage === 'ready' || r.stage === 'error')
	);

	#nextKey = 0;
	// How many uploads succeeded in this round, retries included, for the message at the end.
	#added = 0;
	// Previews are made one after another, so picking dozens of big photos doesn't decode them all at once.
	#previews: Promise<unknown> = Promise.resolve();
	// Set while the gallery is on screen: where finished items go, and the only time there is a dialog to review in.
	#onuploaded: ((item: MediaItem, albumId: string | null) => void) | undefined;

	/** For the gallery to call while it is on screen. Leaving drops what is only a selection; uploads in flight carry on. */
	attach(onuploaded: (item: MediaItem, albumId: string | null) => void) {
		this.#onuploaded = onuploaded;
		return () => {
			this.#onuploaded = undefined;
			this.open = false;
			if (!this.uploading) this.#reset();
		};
	}

	add(files: File[], album: { id: string; name: string } | null = null) {
		const rejected: { name: string; error: string }[] = [];
		for (const file of files) {
			const checked = checkMedia(file);
			if (!checked.ok) {
				rejected.push({ name: file.name, error: checked.error });
				continue;
			}
			const prepared = this.#previews.then(() => prepare(file, checked.kind));
			this.#previews = prepared.catch(() => {});
			this.rows.push({
				key: this.#nextKey++,
				file,
				kind: checked.kind,
				prepared,
				previewUrl: null,
				duration: null,
				stage: 'preview',
				progress: 0,
				error: '',
				album
			});
			// Through the array, so the row we mutate is the reactive one.
			const row = this.rows[this.rows.length - 1];
			void prepared.then((p) => {
				if (!this.rows.includes(row)) return; // removed while its preview was being made
				row.previewUrl = p.thumb ? URL.createObjectURL(p.thumb) : null;
				row.duration = p.duration;
				if (row.stage === 'preview') row.stage = 'ready';
			});
		}
		if (rejected.length) {
			toast.error(`${rejected[0].name}: ${rejected[0].error}`, {
				description: rejected.length > 1 ? `and ${rejected.length - 1} more skipped` : undefined
			});
		}
	}

	remove(row: Row) {
		release(row);
		this.rows = this.rows.filter((r) => r !== row);
	}

	/** Uploads one row, which is also how a failed one is retried. */
	async run(row: Row) {
		row.stage = 'queued';
		row.progress = 0;
		row.error = '';
		let item: MediaItem | undefined;
		try {
			item = await uploadMedia(
				row.file,
				row.prepared,
				(stage, fraction) => {
					row.stage = stage;
					row.progress = fraction;
				},
				row.album?.id ?? null
			);
		} catch (e) {
			row.error = e instanceof Error ? e.message : 'Upload failed';
		}
		if (item) {
			row.stage = 'done';
			this.#added++;
			this.#onuploaded?.(item, row.album?.id ?? null);
		} else {
			row.stage = 'error';
		}
		if (!this.uploading) this.#finish();
	}

	/** Everything that can be sent starts now; the last one to settle announces the outcome. */
	submit() {
		this.pending.forEach((row) => void this.run(row));
	}

	/** Closing while uploads run keeps them going; otherwise the selection is dropped. */
	close() {
		this.open = false;
		if (!this.uploading) this.#reset();
	}

	#reset() {
		this.rows.forEach(release);
		this.rows = [];
		this.#added = 0;
	}

	/** Called once nothing is in flight any more. */
	#finish() {
		const failed = this.rows.filter((r) => r.stage === 'error').length;
		const added = this.#added;
		if (failed === 0) {
			// A round that went into one album says so; a mixed round says it went to the library.
			// Read before close(), which drops the rows.
			const album = this.rows[0]?.album ?? null;
			const shared = album && this.rows.every((r) => r.album?.id === album.id) ? album : null;
			this.close();
			toast.success(
				shared
					? `Added ${plural(added, 'item')} to "${shared.name}"`
					: `Added ${plural(added, 'item')} to the gallery`
			);
			return;
		}
		// With the dialog open, its cards already show what failed.
		if (this.open) return;
		// The failed ones stay (with the finished ones ticked) so they can be retried or removed, unless
		// the user has left: then there is no dialog to review them in, and the toast is all there is.
		const mounted = this.#onuploaded !== undefined;
		toast.error(`${plural(failed, 'upload')} failed`, {
			description: added ? `${added} added to the gallery` : undefined,
			action: mounted
				? {
						label: 'Review',
						onClick: () => {
							if (this.#onuploaded) this.open = true;
						}
					}
				: undefined
		});
		if (!mounted) this.#reset();
	}
}

export const uploads = new Uploads();
