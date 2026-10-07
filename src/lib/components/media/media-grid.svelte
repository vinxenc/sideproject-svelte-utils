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
	// Columns are filled in JS rather than with CSS columns, so loading another page only appends
	// to the columns and never moves a tile that is already on screen.
	let width = $state(0);
	// 2 columns on a phone, 3 on a tablet, 4 on a wide screen; the width is the grid's own, not the window's.
	const columnCount = $derived(width >= 900 ? 4 : width >= 480 ? 3 : 2);
	// Unknown size (the browser couldn't decode the file): a square. Extremes are clamped so a
	// panorama or a screenshot doesn't make a sliver or a tower.
	const ratioOf = (item: MediaItem) =>
		item.width && item.height ? Math.min(2, Math.max(0.5, item.width / item.height)) : 1;

	const columns = $derived.by(() => {
		const cols: MediaItem[][] = Array.from({ length: columnCount }, () => []);
		const heights = Array.from({ length: columnCount }, () => 0);
		for (const item of items) {
			const shortest = heights.indexOf(Math.min(...heights));
			cols[shortest].push(item);
			heights[shortest] += 1 / ratioOf(item);
		}
		return cols;
	});

	// Loading placeholders: two per column, alternating tall and wide so the columns look uneven.
	const skeletonRatios = (column: number) => (column % 2 ? [1.25, 0.75] : [0.75, 1.25]);

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

<div class="@container" bind:clientWidth={width}>
	<div class="flex gap-2 @xl:gap-3">
		{#each columns as column, c (c)}
			<div class="flex min-w-0 flex-1 flex-col gap-2 @xl:gap-3">
				{#each column as item (item.id)}
					<button
						type="button"
						class="relative block w-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						style:aspect-ratio={ratioOf(item)}
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

				{#if loading || items.length === 0}
					<!-- Pulsing while a page is on its way, standing still when there is nothing to show
					     (an empty gallery, or the first page didn't load). -->
					{#each skeletonRatios(c) as ratio (ratio)}
						<Skeleton
							class={cn('w-full rounded-xl', !loading && 'animate-none')}
							style="aspect-ratio: {ratio}"
						/>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
	{#if !loading && items.length === 0}
		<p class="sr-only">No photos or videos to show</p>
	{/if}
</div>

{#if hasMore && !loading}
	<div {@attach nearEnd} class="h-px" aria-hidden="true"></div>
{/if}
