<script lang="ts">
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { fetchAlbums } from '#lib/albums/api.js';
	import type { AlbumSummary } from '#lib/albums/types.js';
	import AlbumActionTile from '#lib/components/albums/album-action-tile.svelte';
	import AlbumCard from '#lib/components/albums/album-card.svelte';
	import CreateAlbumDialog from '#lib/components/albums/create-album-dialog.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	let { refreshKey = 0 }: { refreshKey?: number } = $props();

	let albums = $state.raw<AlbumSummary[]>([]);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let createOpen = $state(false);
	let dragging = $state(false);
	const STRIP_LIMIT = 5;

	// Refetches when refreshKey changes. The load reads state before its first await, so it runs
	// untracked: otherwise the effect would depend on the very state the load writes, and loop.
	$effect(() => {
		void refreshKey;
		untrack(() => void load());
	});

	async function load() {
		// The first load shows skeletons; later loads keep the tiles on screen until the new ones arrive.
		if (status !== 'ready') status = 'loading';
		try {
			const page = await fetchAlbums({ limit: STRIP_LIMIT });
			albums = page.items;
			status = 'ready';
		} catch {
			status = 'error';
		}
	}

	// Mouse drag-to-scroll: hold an album and drag left or right. Touch and trackpads already scroll
	// the strip natively, and the wheel keeps working.
	const DRAG_THRESHOLD = 5;
	let drag: { x: number; left: number; moved: boolean } | undefined;

	function onpointerdown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
		if (event.pointerType !== 'mouse' || event.button !== 0) return;
		drag = { x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
	}

	function onpointermove(event: PointerEvent & { currentTarget: HTMLDivElement }) {
		if (!drag) return;
		if (event.buttons !== 1) return endDrag();
		const dx = event.clientX - drag.x;
		if (!drag.moved) {
			if (Math.abs(dx) < DRAG_THRESHOLD) return;
			drag.moved = true;
			dragging = true;
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		event.currentTarget.scrollLeft = drag.left - dx;
	}

	function endDrag() {
		dragging = false;
		// The click that ends a drag fires right after pointerup, so `drag` is cleared a task later.
		setTimeout(() => (drag = undefined));
	}

	// A drag must not open the album it started on.
	function onclickcapture(event: MouseEvent) {
		if (!drag?.moved) return;
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<section aria-labelledby="albums-heading" class="flex flex-col gap-2">
	<div class="flex items-center gap-1">
		<h2 id="albums-heading" class="text-lg font-semibold">Albums</h2>
		<div class="ms-auto">
			<CreateAlbumDialog
				bind:open={createOpen}
				oncreated={(a) => goto(`/photo-video/albums/${a.id}`)}
			/>
		</div>
	</div>

	{#if status === 'error'}
		<div class="flex items-center gap-2">
			<p class="text-sm text-muted-foreground">Couldn't load your albums.</p>
			<Button variant="link" size="sm" onclick={load}>Try again</Button>
		</div>
	{:else}
		<!-- The negative margin and padding leave room for the fanned frames' rotation and shadow, which
		     the overflow would otherwise clip. -->
		<!-- Dragging is a mouse-only extra: the albums stay focusable links and the strip scrolls
		     natively with touch, wheel and keyboard. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			{onpointerdown}
			{onpointermove}
			onpointerup={endDrag}
			onpointercancel={endDrag}
			{onclickcapture}
			ondragstart={(event) => event.preventDefault()}
			style:scroll-snap-type={dragging ? 'none' : undefined}
			class:select-none={dragging}
			class="-mx-6 -my-3 flex snap-x snap-mandatory scroll-px-6 [scrollbar-width:none] gap-3 overflow-x-auto px-6 py-3 sm:gap-12 pointer-fine:cursor-grab [&::-webkit-scrollbar]:hidden"
		>
			{#if status === 'loading'}
				{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
					<div class="w-36 shrink-0 snap-start sm:w-66">
						<Skeleton class="aspect-[100/131] w-full rounded-xl" />
						<Skeleton class="mt-2 h-4 w-3/4" />
						<Skeleton class="mt-1 h-3 w-1/2" />
					</div>
				{/each}
			{:else if albums.length === 0}
				<AlbumActionTile
					label="New album"
					class="w-36 shrink-0 snap-start sm:w-66"
					onclick={() => (createOpen = true)}
				>
					<PlusIcon />
				</AlbumActionTile>
			{:else}
				{#each albums as album (album.id)}
					<AlbumCard {album} class="w-36 shrink-0 snap-start sm:w-66" />
				{/each}
				<AlbumActionTile
					label="All albums"
					href="/photo-video/albums"
					class="w-36 shrink-0 snap-start sm:w-66"
				>
					<LayoutGridIcon />
				</AlbumActionTile>
			{/if}
		</div>
	{/if}
</section>
