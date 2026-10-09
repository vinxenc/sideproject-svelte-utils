<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import PlayIcon from '@lucide/svelte/icons/play';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { albumSubtitle } from '#lib/albums/format.js';
	import type { AlbumPreview, AlbumSummary } from '#lib/albums/types.js';
	import MediaImage from '#lib/components/media/media-image.svelte';
	import { cn } from '#lib/utils.js';

	let { album, class: className }: { album: AlbumSummary; class?: string } = $props();

	// Touch: the first tap fans the stack, the second tap follows the link.
	let fanned = $state(false);
	let lastPointer = '';

	function onclick(event: MouseEvent) {
		if (lastPointer === 'touch' && !fanned && album.previews.length > 1) {
			event.preventDefault();
			fanned = true;
		}
	}

	const SLOTS = ['front', 'left', 'right'] as const;
	// The back frames come first in the DOM, so the front one is on top without relying on z-index alone.
	const frames = $derived(
		album.previews.map((preview, i) => ({ preview, slot: SLOTS[i] })).reverse()
	);
</script>

{#snippet placeholder(preview: AlbumPreview)}
	<span class="absolute inset-0 flex items-center justify-center text-muted-foreground">
		{#if preview.kind === 'VIDEO'}
			<VideoIcon />
		{:else}
			<ImageIcon />
		{/if}
	</span>
{/snippet}

<a
	href="/photo-video/albums/{album.id}"
	class={cn(
		'card group/card block min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
		className
	)}
	data-fanned={fanned}
	onpointerdown={(event) => (lastPointer = event.pointerType)}
	{onclick}
	onblur={() => (fanned = false)}
>
	<div class="stack relative aspect-[4/3] w-full">
		{#if frames.length === 0}
			<div
				class="frame dashed flex items-center justify-center rounded-lg border-2 border-dashed border-border bg-transparent text-muted-foreground"
				data-slot="front"
			>
				<ImagesIcon />
			</div>
		{/if}
		{#each frames as { preview, slot } (slot)}
			<div
				class="frame overflow-hidden rounded-lg bg-muted shadow-md ring-1 ring-border"
				data-slot={slot}
			>
				{#if preview.hasThumb}
					<MediaImage src="/api/media/{preview.id}/thumb" alt="" lazy class="absolute inset-0">
						{#snippet fallback()}
							{@render placeholder(preview)}
						{/snippet}
					</MediaImage>
				{:else}
					{@render placeholder(preview)}
				{/if}
				{#if preview.kind === 'VIDEO'}
					<span class="absolute top-1.5 right-1.5 rounded-full bg-background/80 p-1">
						<PlayIcon class="size-3" />
					</span>
				{/if}
			</div>
		{/each}
	</div>
	<p class="mt-2 truncate text-sm font-medium" title={album.name}>{album.name}</p>
	<p class="truncate text-xs text-muted-foreground">{albumSubtitle(album)}</p>
</a>

<style>
	.frame {
		position: absolute;
		left: 22%;
		top: 12.5%;
		width: 56%;
		aspect-ratio: 1;
		transform-origin: 50% 100%;
		transition: transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.frame[data-slot='front'] {
		z-index: 2;
		transform: none;
	}
	.frame[data-slot='left'] {
		transform: translateX(-10%) rotate(-6deg);
	}
	.frame[data-slot='right'] {
		transform: translateX(10%) rotate(6deg);
	}

	/* Fanned: keyboard focus, the touch first tap, and a real hover (hover-capable devices only).
	   The dashed frame of an empty album never fans. */
	.card:focus-visible .frame[data-slot='front']:not(.dashed),
	.card[data-fanned='true'] .frame[data-slot='front']:not(.dashed) {
		transform: translateY(-4%) scale(1.06);
	}
	.card:focus-visible .frame[data-slot='left'],
	.card[data-fanned='true'] .frame[data-slot='left'] {
		transform: translateX(-36%) rotate(-12deg) scale(0.95);
	}
	.card:focus-visible .frame[data-slot='right'],
	.card[data-fanned='true'] .frame[data-slot='right'] {
		transform: translateX(36%) rotate(12deg) scale(0.95);
	}
	@media (hover: hover) {
		.card:hover .frame[data-slot='front']:not(.dashed) {
			transform: translateY(-4%) scale(1.06);
		}
		.card:hover .frame[data-slot='left'] {
			transform: translateX(-36%) rotate(-12deg) scale(0.95);
		}
		.card:hover .frame[data-slot='right'] {
			transform: translateX(36%) rotate(12deg) scale(0.95);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.frame {
			transition: none;
		}
	}
</style>
