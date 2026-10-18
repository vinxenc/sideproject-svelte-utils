import { fetchAlbums } from './api.js';
import type { AlbumSummary } from './types.js';

/** Paged album state, shared by `/albums` and the add-to-album picker. */
export class AlbumList {
	items = $state.raw<AlbumSummary[]>([]);
	loading = $state(false);
	/** The first page has arrived. */
	loaded = $state(false);
	done = $state(false);
	error = $state('');

	#limit: number | undefined;
	#cursor: string | null = null;
	// Bumped by reset(), so a page requested before the reset can't land in the new list.
	#generation = 0;

	/** @param limit passed to fetchAlbums; undefined = the server's default (30) */
	constructor(limit?: number) {
		this.#limit = limit;
	}

	/** Next page; no-op while loading or done. Pages can't overlap: albums sort by createdAt, which never changes, and a page from before a reset is dropped. */
	async load(): Promise<void> {
		if (this.loading || this.done) return;
		const generation = this.#generation;
		this.loading = true;
		this.error = '';
		try {
			const page = await fetchAlbums({ limit: this.#limit, cursor: this.#cursor });
			if (generation !== this.#generation) return;
			this.items = [...this.items, ...page.items];
			this.#cursor = page.nextCursor;
			this.done = page.nextCursor === null;
			this.loaded = true;
		} catch (e) {
			if (generation !== this.#generation) return;
			this.error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			if (generation === this.#generation) this.loading = false;
		}
	}

	reset(): void {
		this.#generation++;
		this.items = [];
		this.loading = false;
		this.loaded = false;
		this.done = false;
		this.error = '';
		this.#cursor = null;
	}
}
