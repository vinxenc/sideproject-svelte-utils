<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { goto } from '$app/navigation';
	import { tick, untrack } from 'svelte';
	import { fetchAlbums } from '#lib/albums/api.js';
	import type { AlbumSummary } from '#lib/albums/types.js';
	import AlbumCard from '#lib/components/albums/album-card.svelte';
	import CreateAlbumDialog from '#lib/components/albums/create-album-dialog.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	let { refreshKey = 0 }: { refreshKey?: number } = $props();

	let albums = $state.raw<AlbumSummary[]>([]);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let createOpen = $state(false);
	let scroller: HTMLDivElement | undefined = $state();
	let width = $state(0);
	let canLeft = $state(false);
	let canRight = $state(false);
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

	function updateArrows() {
		if (!scroller) return;
		canLeft = scroller.scrollLeft > 0;
		canRight = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1;
	}

	// The tiles change the scroll range, so the arrows are re-checked after they render, and on resize.
	$effect(() => {
		void albums;
		void width;
		void tick().then(updateArrows);
	});

	function scrollByPage(direction: -1 | 1) {
		if (!scroller) return;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		scroller.scrollBy({
			left: direction * scroller.clientWidth * 0.8,
			behavior: reduced ? 'auto' : 'smooth'
		});
	}
</script>

<section aria-labelledby="albums-heading" class="flex flex-col gap-2">
	<div class="flex items-center gap-1">
		<h2 id="albums-heading" class="text-lg font-semibold">Albums</h2>
		<CreateAlbumDialog
			bind:open={createOpen}
			oncreated={(a) => goto(`/photo-video/albums/${a.id}`)}
		/>
		<div class="ms-auto hidden gap-1 pointer-fine:flex">
			<Button
				variant="outline"
				size="icon-sm"
				aria-label="Scroll albums left"
				disabled={!canLeft}
				onclick={() => scrollByPage(-1)}
			>
				<ChevronLeftIcon />
			</Button>
			<Button
				variant="outline"
				size="icon-sm"
				aria-label="Scroll albums right"
				disabled={!canRight}
				onclick={() => scrollByPage(1)}
			>
				<ChevronRightIcon />
			</Button>
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
		<div
			bind:this={scroller}
			bind:clientWidth={width}
			onscroll={updateArrows}
			class="-mx-4 -my-3 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 py-3 [&::-webkit-scrollbar]:hidden"
		>
			{#if status === 'loading'}
				{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}
					<div class="w-36 shrink-0 snap-start sm:w-44">
						<Skeleton class="aspect-[4/3] w-full rounded-xl" />
						<Skeleton class="mt-2 h-4 w-3/4" />
						<Skeleton class="mt-1 h-3 w-1/2" />
					</div>
				{/each}
			{:else if albums.length === 0}
				<button
					type="button"
					class="flex aspect-[4/3] w-36 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-sm font-medium sm:w-44"
					onclick={() => (createOpen = true)}
				>
					<PlusIcon class="size-8 text-muted-foreground" />
					New album
				</button>
			{:else}
				{#each albums as album (album.id)}
					<AlbumCard {album} class="w-36 shrink-0 snap-start sm:w-44" />
				{/each}
				<a href="/photo-video/albums" class="block w-36 shrink-0 snap-start sm:w-44">
					<span
						class="flex aspect-[4/3] items-center justify-center rounded-xl border-2 border-dashed border-border"
					>
						<LayoutGridIcon class="size-8 text-muted-foreground" />
					</span>
					<span class="mt-2 block truncate text-sm font-medium">All albums</span>
				</a>
			{/if}
		</div>
	{/if}
</section>
