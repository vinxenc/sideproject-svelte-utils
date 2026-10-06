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

	// A mosaic. Wide containers have 4 columns and every block of 4 tiles is a 2x2 hero, two 1x1 tiles
	// and a 2x1 wide tile; narrow ones have 2 columns and blocks of 3: a 2x2 hero and two 1x1 tiles.
	// The page size (60) is a multiple of both, so a page never ends in the middle of a block.
	const position =
		'@xl:nth-[4n+1]:col-span-2 @xl:nth-[4n+1]:row-span-2 @xl:nth-[4n]:col-span-2 @max-xl:nth-[3n+1]:col-span-2 @max-xl:nth-[3n+1]:row-span-2';

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

<!-- Rows are sized from the container's width (7:6 tiles), so the 2x2 and 2x1 tiles line up exactly. -->
<div class="@container">
	<div
		class="grid auto-rows-(--row) grid-cols-2 gap-(--gap) [--gap:0.5rem] [--row:calc((100cqw_-_var(--gap))_/_2_*_6_/_7)] @xl:grid-cols-4 @xl:[--gap:0.75rem] @xl:[--row:calc((100cqw_-_3_*_var(--gap))_/_4_*_6_/_7)]"
	>
		{#each items as item (item.id)}
			<button
				type="button"
				class={cn(
					'relative block size-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
					position
				)}
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
			<!-- One block of tiles: pulsing while a page is on its way, standing still when there is nothing
			     to show (an empty gallery, or the first page didn't load). -->
			{#each { length: 4 }, i (i)}
				<Skeleton class={cn('size-full rounded-xl', position, !loading && 'animate-none')} />
			{/each}
		{/if}
	</div>
	{#if !loading && items.length === 0}
		<p class="sr-only">No photos or videos to show</p>
	{/if}
</div>

{#if hasMore && !loading}
	<div {@attach nearEnd} class="h-px" aria-hidden="true"></div>
{/if}
