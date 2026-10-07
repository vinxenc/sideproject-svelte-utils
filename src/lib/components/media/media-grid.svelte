<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import PlayIcon from '@lucide/svelte/icons/play';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { formatDuration } from '#lib/media/format.js';
	import type { MediaItem } from '#lib/media/types.js';
	import { cn } from '#lib/utils.js';
	import { Masonry } from '#lib/media/masonry.js';
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

	let width = $state(0);
	// 2 columns on a phone, 3 on a tablet, 4 on a wide screen; the width is the grid's own, not the window's.
	const columnCount = $derived(width >= 900 ? 4 : width >= 480 ? 3 : 2);
	// The gap between tiles, in px: wider from 576 px of grid width.
	const gap = $derived(width >= 576 ? 12 : 8);

	// The tiles are one flat list in newest-first order (that is the order Tab and screen readers
	// follow) and are positioned in pixels, so a new tile never rebuilds the ones already on screen.
	const masonry = new Masonry();
	const layout = $derived(
		masonry.layout(items, columnCount, width, gap, loading || items.length === 0)
	);

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
