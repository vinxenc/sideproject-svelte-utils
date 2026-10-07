<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import PlayIcon from '@lucide/svelte/icons/play';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { formatDuration } from '#lib/media/format.js';
	import type { MediaItem } from '#lib/media/types.js';
	import { cn } from '#lib/utils.js';
	import MediaImage from './media-image.svelte';

	let {
		items,
		hasMore,
		loading,
		onopen,
		onloadmore
	}: {
		items: MediaItem[];
		/** Whether to keep requesting pages as the end of the grid scrolls into view. */
		hasMore: boolean;
		loading: boolean;
		onopen: (id: string) => void;
		onloadmore: () => void;
	} = $props();

	// Masonry: each tile keeps its photo's aspect ratio and goes to the currently shortest column.
	// The tiles are one flat list in newest-first order (that is the order Tab and screen readers
	// follow) and are positioned in pixels, so a new tile never rebuilds the ones already on screen.
	let width = $state(0);
	// 2 columns on a phone, 3 on a tablet, 4 on a wide screen; the width is the grid's own, not the window's.
	const columnCount = $derived(width >= 900 ? 4 : width >= 480 ? 3 : 2);
	// The gap between tiles, in px: wider from 576 px of grid width.
	const gap = $derived(width >= 576 ? 12 : 8);
	// Unknown size (the browser couldn't decode the file): a square. Extremes are clamped so a
	// panorama or a screenshot doesn't make a sliver or a tower.
	const ratioOf = (item: MediaItem) =>
		item.width && item.height ? Math.min(2, Math.max(0.5, item.width / item.height)) : 1;

	// The column each tile is in. A tile never changes column while the column count stays the same, so
	// an upload that lands at the top doesn't make every other tile jump; only tiles that are new are
	// placed, each in the shortest column.
	let placed: Record<string, number> = {};
	let placedFor = 0;

	const layout = $derived.by(() => {
		if (placedFor !== columnCount) {
			placed = {};
			placedFor = columnCount;
		}
		const colWidth = Math.max(0, (width - gap * (columnCount - 1)) / columnCount);
		const heightOf = (item: MediaItem) => colWidth / ratioOf(item);
		const heights = Array.from({ length: columnCount }, () => 0);
		for (const item of items) {
			if (item.id in placed) heights[placed[item.id]] += heightOf(item) + gap;
		}
		for (const item of items) {
			if (item.id in placed) continue;
			const shortest = heights.indexOf(Math.min(...heights));
			placed[item.id] = shortest;
			heights[shortest] += heightOf(item) + gap;
		}
		// Top of the next tile in each column, filled in item order.
		const tops = Array.from({ length: columnCount }, () => 0);
		const tiles = items.map((item) => {
			const column = placed[item.id];
			const tile = {
				item,
				left: column * (colWidth + gap),
				top: tops[column],
				height: heightOf(item)
			};
			tops[column] += tile.height + gap;
			return tile;
		});
		// Loading placeholders: two squares at the end of every column.
		const skeletons: { key: string; left: number; top: number }[] = [];
		if (loading || items.length === 0) {
			for (let column = 0; column < columnCount; column++) {
				for (let n = 0; n < 2; n++) {
					skeletons.push({
						key: `${column}-${n}`,
						left: column * (colWidth + gap),
						top: tops[column]
					});
					tops[column] += colWidth + gap;
				}
			}
		}
		return { colWidth, tiles, skeletons, height: Math.max(0, Math.max(...tops) - gap) };
	});

	// The sentinel sits below the grid. It is removed while a page loads and rendered again
	// afterwards, so a sentinel that is still on screen once the page has arrived triggers the next.
	function nearEnd(node: HTMLElement) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) onloadmore();
			},
			{ rootMargin: '800px 0px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}
</script>

{#snippet placeholderIcon(item: MediaItem)}
	<span class="absolute inset-0 flex items-center justify-center text-muted-foreground">
		{#if item.kind === 'VIDEO'}
			<VideoIcon />
		{:else}
			<ImageIcon />
		{/if}
		<span class="sr-only">{item.name}</span>
	</span>
{/snippet}

<div bind:clientWidth={width}>
	<div class="relative" style:height="{layout.height}px">
		{#each layout.tiles as tile (tile.item.id)}
			{@const item = tile.item}
			<button
				type="button"
				class="absolute block overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				style:left="{tile.left}px"
				style:top="{tile.top}px"
				style:width="{layout.colWidth}px"
				style:height="{tile.height}px"
				title={item.name}
				onclick={() => onopen(item.id)}
			>
				{#if item.hasThumb}
					<MediaImage
						src="/api/media/{item.id}/thumb"
						alt={item.name}
						lazy
						class="absolute inset-0"
					>
						{#snippet fallback()}
							{@render placeholderIcon(item)}
						{/snippet}
					</MediaImage>
				{:else}
					{@render placeholderIcon(item)}
				{/if}
				{#if item.kind === 'VIDEO'}
					<Badge variant="secondary" class="absolute bottom-2 left-2">
						<PlayIcon data-icon="inline-start" />
						{#if item.duration !== null}{formatDuration(item.duration)}{/if}
					</Badge>
				{/if}
			</button>
		{/each}

		<!-- Pulsing while a page is on its way, standing still when there is nothing to show (an empty
		     gallery, or the first page didn't load). -->
		{#each layout.skeletons as skeleton (skeleton.key)}
			<Skeleton
				class={cn('absolute rounded-xl', !loading && 'animate-none')}
				style="left: {skeleton.left}px; top: {skeleton.top}px; width: {layout.colWidth}px; height: {layout.colWidth}px"
			/>
		{/each}
	</div>
	{#if !loading && items.length === 0}
		<p class="sr-only">No photos or videos to show</p>
	{/if}
</div>

{#if hasMore && !loading}
	<div {@attach nearEnd} class="h-px" aria-hidden="true"></div>
{/if}
