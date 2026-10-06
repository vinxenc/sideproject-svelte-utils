<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { MediaItem, MediaPage } from '#lib/media/types.js';
	import MediaGrid from './media-grid.svelte';
	import MediaLightbox from './media-lightbox.svelte';
	import UploadDialog from './upload-dialog.svelte';

	let items = $state<MediaItem[]>([]);
	let cursor = $state<string | null>(null);
	/** The first page has arrived. */
	let loaded = $state(false);
	/** Every page has arrived. */
	let done = $state(false);
	let loading = $state(false);
	let error = $state('');
	let openId = $state<string | null>(null);

	// One id, so repeated failures replace the toast instead of stacking up.
	const LOAD_ERROR_TOAST = 'gallery-load-error';

	async function load() {
		if (loading || done) return;
		loading = true;
		error = '';
		try {
			const res = await fetch(
				cursor ? `/api/media?cursor=${encodeURIComponent(cursor)}` : '/api/media'
			);
			if (!res.ok) throw new Error(`The server answered ${res.status}`);
			const page: MediaPage = await res.json();
			// An upload can land in the list before the page that also contains it.
			const known = new Set(items.map((i) => i.id));
			items = [...items, ...page.items.filter((i) => !known.has(i.id))];
			cursor = page.nextCursor;
			done = page.nextCursor === null;
			loaded = true;
			toast.dismiss(LOAD_ERROR_TOAST);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			// The grid has no room for a retry button, so the toast carries it, and stays until it is
			// used or dismissed. Loading stops until then, so a failing page isn't requested in a loop.
			toast.error("Couldn't load your photos and videos", {
				id: LOAD_ERROR_TOAST,
				description: error,
				duration: Infinity,
				action: { label: 'Try again', onClick: () => void load() }
			});
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load();
	});

	// Leaving the tab makes the retry pointless.
	onDestroy(() => toast.dismiss(LOAD_ERROR_TOAST));

	const newestFirst = (a: MediaItem, b: MediaItem) =>
		b.takenAt.localeCompare(a.takenAt) || b.id.localeCompare(a.id);

	// The loaded items are the start of the full list, so a new upload belongs in them only if it
	// sorts before the last one (or nothing more is left to load); otherwise a later page brings it.
	function insert(item: MediaItem) {
		const last = items.at(-1);
		if (items.some((i) => i.id === item.id)) return;
		if (!done && last && newestFirst(item, last) > 0) return;
		items = [...items, item].sort(newestFirst);
	}
</script>

<!-- Bottom padding keeps the last row clear of the round add button. -->
<div class="flex flex-col gap-4 pb-24">
	<UploadDialog onuploaded={insert} />

	<MediaGrid
		{items}
		hasMore={loaded && !done && !error}
		{loading}
		onopen={(id) => (openId = id)}
		onloadmore={load}
	/>
</div>

<MediaLightbox {items} bind:openId hasMore={!done} onloadmore={load} />
