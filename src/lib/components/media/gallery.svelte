<script lang="ts">
	import FolderMinusIcon from '@lucide/svelte/icons/folder-minus';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { removeFromAlbum } from '#lib/albums/api.js';
	import { formatCount } from '#lib/albums/format.js';
	import AddToAlbumDialog from '#lib/components/albums/add-to-album-dialog.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { MediaItem, MediaPage } from '#lib/media/types.js';
	import MediaGrid from './media-grid.svelte';
	import MediaLightbox from './media-lightbox.svelte';
	import UploadDialog from './upload-dialog.svelte';

	let {
		album,
		heading,
		empty,
		onalbumschanged
	}: {
		/** Show only this album's items, and upload into it. */
		album?: { id: string; name: string };
		/** The row above the grid. */
		heading?: Snippet;
		/** Shown instead of the empty skeleton grid once the first page is loaded and there are no items. */
		empty?: Snippet;
		/** An add-to-album happened (for the strip to refresh). */
		onalbumschanged?: () => void;
	} = $props();

	let items = $state.raw<MediaItem[]>([]);
	let cursor = $state<string | null>(null);
	/** The first page has arrived. */
	let loaded = $state(false);
	/** Every page has arrived. */
	let done = $state(false);
	let loading = $state(false);
	let error = $state('');
	let openId = $state<string | null>(null);

	const endpoint = $derived(
		album ? `/api/albums/${encodeURIComponent(album.id)}/media` : '/api/media'
	);

	// Select mode is simply "something is selected": tiles toggle instead of opening, and a bar acts
	// on the selection. It starts from a tile's circle (hover) or a press and hold (touch).
	const selected = new SvelteSet<string>();
	const selecting = $derived(selected.size > 0);
	let pickerOpen = $state(false);
	let pickerIds = $state.raw<string[]>([]);
	let removing = $state(false);

	// One id, so repeated failures replace the toast instead of stacking up.
	const LOAD_ERROR_TOAST = 'gallery-load-error';

	async function load() {
		if (loading || done) return;
		loading = true;
		error = '';
		try {
			const res = await fetch(
				cursor ? `${endpoint}?cursor=${encodeURIComponent(cursor)}` : endpoint
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
		// Leaving the tab makes the retry pointless.
		return () => toast.dismiss(LOAD_ERROR_TOAST);
	});

	const newestFirst = (a: MediaItem, b: MediaItem) =>
		b.takenAt.localeCompare(a.takenAt) || b.id.localeCompare(a.id);

	// The loaded items are the start of the full list, so a new upload belongs in them only if it
	// sorts before the last one (or nothing more is left to load); otherwise a later page brings it.
	// In an album, only uploads that went into this album belong here.
	function insert(item: MediaItem, rowAlbumId: string | null) {
		if (album && rowAlbumId !== album.id) return;
		const last = items.at(-1);
		if (items.some((i) => i.id === item.id)) return;
		if (!done && last && newestFirst(item, last) > 0) return;
		items = [...items, item].sort(newestFirst);
	}

	function toggle(id: string) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}

	function openPicker(ids: string[]) {
		pickerIds = ids;
		pickerOpen = true;
	}

	/** Takes the removed items out of the list, and moves the open lightbox off them. */
	function dropLocal(ids: string[]) {
		const before = items;
		items = items.filter((i) => !ids.includes(i.id));
		if (openId !== null && ids.includes(openId)) {
			const index = before.findIndex((i) => i.id === openId);
			const keep = (i: MediaItem) => !ids.includes(i.id);
			openId =
				before.slice(index + 1).find(keep)?.id ?? before.slice(0, index).findLast(keep)?.id ?? null;
		}
	}

	async function remove(ids: string[]) {
		if (!album || removing) return;
		removing = true;
		try {
			const n = await removeFromAlbum(album.id, ids);
			dropLocal(ids);
			selected.clear();
			if (n > 0) {
				toast.success(`Removed ${formatCount(n)} from "${album.name}"`);
				// Removing moves the album to the front of the strip.
				onalbumschanged?.();
			}
		} catch (e) {
			toast.error("Couldn't remove from the album", {
				description: e instanceof Error ? e.message : 'Something went wrong'
			});
		} finally {
			removing = false;
		}
	}
</script>

<!-- Bottom padding keeps the last row clear of the round add button and the selection bar. -->
<div class="flex flex-col gap-4 pb-24">
	<div class="min-w-0">{@render heading?.()}</div>

	<!-- Never unmounted: unmounting would detach the upload store from this page. -->
	<UploadDialog onuploaded={insert} {album} hideTrigger={selecting} />

	{#if loaded && items.length === 0 && empty}
		{@render empty()}
	{:else}
		<MediaGrid
			{items}
			hasMore={loaded && !done && !error}
			{loading}
			onopen={(id) => (openId = id)}
			onloadmore={load}
			{selecting}
			{selected}
			ontoggle={toggle}
		/>
	{/if}
</div>

{#if selecting}
	<div
		class="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 mx-auto flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-lg"
	>
		<Button
			size="icon-sm"
			variant="ghost"
			aria-label="Clear selection"
			onclick={() => selected.clear()}
		>
			<XIcon />
		</Button>
		<span class="text-sm">{selected.size} selected</span>
		<Button size="sm" onclick={() => openPicker([...selected])}>
			<FolderPlusIcon data-icon="inline-start" />
			Add to album
		</Button>
		{#if album}
			<Button size="sm" variant="outline" disabled={removing} onclick={() => remove([...selected])}>
				<FolderMinusIcon data-icon="inline-start" />
				Remove
			</Button>
		{/if}
	</div>
{/if}

<MediaLightbox
	{items}
	bind:openId
	hasMore={!done}
	onloadmore={load}
	onaddtoalbum={(id) => openPicker([id])}
	onremovefromalbum={album ? (id) => remove([id]) : undefined}
/>

<!-- After the lightbox on purpose: portalled dialogs stack in template order (same z-index), so the picker opened from the lightbox menu must come later in the DOM. -->
<AddToAlbumDialog
	bind:open={pickerOpen}
	mediaIds={pickerIds}
	excludeAlbumId={album?.id}
	onadded={() => {
		selected.clear();
		onalbumschanged?.();
	}}
/>
