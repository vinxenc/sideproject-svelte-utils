<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleIcon from '@lucide/svelte/icons/circle';
	import ImageIcon from '@lucide/svelte/icons/image';
	import PlayIcon from '@lucide/svelte/icons/play';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { SvelteSet } from 'svelte/reactivity';
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
		onloadmore,
		selecting = false,
		selected = new SvelteSet<string>(),
		ontoggle
	}: {
		items: MediaItem[];
		/** Whether to keep requesting pages as the end of the grid scrolls into view. */
		hasMore: boolean;
		loading: boolean;
		onopen: (id: string) => void;
		onloadmore: () => void;
		/** Select mode: a tap toggles the tile instead of opening it, and every tile shows its circle. */
		selecting?: boolean;
		selected?: ReadonlySet<string>;
		/** The circle in a tile's top-left corner (on hover, or always in select mode) or a press and hold. */
		ontoggle?: (id: string) => void;
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

	// Touch and pen: press and hold a tile to start selecting. A mouse uses the circle in the corner.
	const LONG_PRESS_MS = 500;
	const MOVE_TOLERANCE = 10;
	let press: { x: number; y: number; timer: ReturnType<typeof setTimeout> } | undefined;
	let pressType = 'mouse';
	// Set when a hold fired, so the click that ends it doesn't also open or toggle the tile.
	let longPressed = false;

	function cancelPress() {
		if (!press) return;
		clearTimeout(press.timer);
		press = undefined;
	}

	function pressStart(event: PointerEvent, id: string) {
		pressType = event.pointerType;
		longPressed = false;
		cancelPress();
		if (event.pointerType === 'mouse') return;
		press = {
			x: event.clientX,
			y: event.clientY,
			timer: setTimeout(() => {
				press = undefined;
				longPressed = true;
				ontoggle?.(id);
			}, LONG_PRESS_MS)
		};
	}

	// Scrolling the grid moves the finger (and the browser then cancels the pointer): not a hold.
	function pressMove(event: PointerEvent) {
		if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) {
			cancelPress();
		}
	}

	function tileClick(id: string) {
		if (longPressed) {
			longPressed = false;
			return;
		}
		if (selecting) ontoggle?.(id);
		else onopen(id);
	}

	$effect(() => cancelPress);

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
			<!-- Box-less, so the tile and its circle stay positioned against the grid; it is the hover group. -->
			<div class="group/tile contents">
				<button
					type="button"
					class="absolute block overflow-hidden rounded-xl bg-muted outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring/50"
					style:left="{tile.left}px"
					style:top="{tile.top}px"
					style:width="{layout.colWidth}px"
					style:height="{tile.height}px"
					title={item.name}
					aria-pressed={selecting ? selected.has(item.id) : undefined}
					class:ring-3={selecting && selected.has(item.id)}
					class:ring-primary={selecting && selected.has(item.id)}
					onclick={() => tileClick(item.id)}
					onpointerdown={(event) => pressStart(event, item.id)}
					onpointermove={pressMove}
					onpointerup={cancelPress}
					onpointercancel={cancelPress}
					oncontextmenu={(event) => pressType !== 'mouse' && event.preventDefault()}
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
				<!-- A sibling of the tile (a button can't hold a button), placed over its top-left corner and
			     revealed with it: on hover, on keyboard focus, and always while selecting. Touch has no
			     hover, so it stays out of the way (and out of reach of taps) until something is selected. -->
				<button
					type="button"
					class={cn(
						'absolute flex size-7 items-center justify-center rounded-full transition duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none',
						selecting
							? 'scale-100 opacity-100'
							: 'pointer-events-none scale-75 opacity-0 group-hover/tile:pointer-events-auto group-hover/tile:scale-100 group-hover/tile:opacity-100 group-has-[:focus-visible]/tile:scale-100 group-has-[:focus-visible]/tile:opacity-100'
					)}
					style:left="{tile.left + 8}px"
					style:top="{tile.top + 8}px"
					aria-label="Select {item.name}"
					aria-pressed={selected.has(item.id)}
					onclick={() => ontoggle?.(item.id)}
				>
					{#if selected.has(item.id)}
						<CircleCheckIcon class="text-white drop-shadow-md" />
					{:else}
						<CircleIcon class="text-white drop-shadow-md" />
					{/if}
				</button>
			</div>
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
