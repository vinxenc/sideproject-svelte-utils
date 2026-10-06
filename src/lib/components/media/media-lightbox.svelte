<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import type { MediaItem } from '#lib/media/types.js';
	import MediaImage from './media-image.svelte';

	let {
		items,
		openId = $bindable(null),
		hasMore,
		onloadmore
	}: {
		items: MediaItem[];
		/** The item being viewed, or null when closed. Tracked by id so an upload or delete can't shift it. */
		openId?: string | null;
		hasMore: boolean;
		onloadmore: () => void;
	} = $props();

	const index = $derived(openId === null ? -1 : items.findIndex((i) => i.id === openId));
	const item = $derived(items[index]);

	function go(step: -1 | 1) {
		const next = items[index + step];
		if (!next) return;
		openId = next.id;
		// Keeps pages coming for someone paging through the lightbox without touching the grid.
		if (hasMore && index + step >= items.length - 4) onloadmore();
	}

	function onkeydown(event: KeyboardEvent) {
		// Arrow keys seek inside a focused video, and with a modifier they belong to the browser (Alt+Left is Back).
		if (openId === null || event.target instanceof HTMLVideoElement) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.key === 'ArrowLeft') go(-1);
		else if (event.key === 'ArrowRight') go(1);
	}

	let swipeFrom: { x: number; y: number } | null = null;

	function onpointerdown(event: PointerEvent) {
		// Dragging on a video would fight its seek bar.
		swipeFrom =
			event.target instanceof HTMLVideoElement ? null : { x: event.clientX, y: event.clientY };
	}

	function onpointerup(event: PointerEvent) {
		if (!swipeFrom) return;
		const dx = event.clientX - swipeFrom.x;
		const dy = event.clientY - swipeFrom.y;
		swipeFrom = null;
		if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
	}
</script>

<svelte:window {onkeydown} />

<Dialog.Root
	open={openId !== null}
	onOpenChange={(open) => {
		if (!open) openId = null;
	}}
>
	<Dialog.Content
		class="top-0 left-0 flex h-svh w-svw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none"
	>
		{#if item}
			<Dialog.Title class="sr-only">{item.name}</Dialog.Title>
			<Dialog.Description class="sr-only">
				Use the left and right arrow keys to move between photos and videos.
			</Dialog.Description>

			<!-- Swiping is a pointer-only shortcut; the arrow keys and the buttons do the same. -->
			<div
				role="presentation"
				class="relative min-h-0 flex-1 touch-pan-y"
				{onpointerdown}
				{onpointerup}
				onpointercancel={() => (swipeFrom = null)}
			>
				{#key item.id}
					{#if item.kind === 'VIDEO'}
						<!-- User uploads come without caption tracks. -->
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							class="absolute inset-0 size-full object-contain"
							controls
							playsinline
							preload="metadata"
							poster={item.hasThumb ? `/api/media/${item.id}/thumb` : undefined}
							src="/api/media/{item.id}/original"
						></video>
					{:else}
						<!-- The small thumbnail stands in, under a loading overlay, until the much larger original
						     has arrived. -->
						<MediaImage
							src="/api/media/{item.id}/original"
							alt={item.name}
							placeholder={item.hasThumb ? `/api/media/${item.id}/thumb` : undefined}
							fit="contain"
							class="absolute inset-0"
						>
							{#snippet fallback()}
								<Empty.Root class="absolute inset-0">
									<Empty.Header>
										<Empty.Media variant="icon"><ImageOffIcon /></Empty.Media>
										<Empty.Title>This browser can't show the original</Empty.Title>
										<Empty.Description>
											{item.name} is in a format this browser can't display, such as HEIC outside Safari.
										</Empty.Description>
									</Empty.Header>
									<Empty.Content>
										<Button
											variant="outline"
											href="/api/media/{item.id}/original"
											target="_blank"
											rel="noreferrer"
										>
											Open original
										</Button>
									</Empty.Content>
								</Empty.Root>
							{/snippet}
						</MediaImage>
					{/if}
				{/key}

				{#if index > 0}
					<Button
						variant="secondary"
						size="icon-lg"
						class="absolute inset-y-0 left-3 my-auto rounded-full"
						onclick={() => go(-1)}
					>
						<ChevronLeftIcon />
						<span class="sr-only">Previous</span>
					</Button>
				{/if}
				{#if index < items.length - 1}
					<Button
						variant="secondary"
						size="icon-lg"
						class="absolute inset-y-0 right-3 my-auto rounded-full"
						onclick={() => go(1)}
					>
						<ChevronRightIcon />
						<span class="sr-only">Next</span>
					</Button>
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-3 px-4 py-3 text-sm">
				<span class="min-w-0 flex-1 truncate font-medium">{item.name}</span>
				<span class="shrink-0 text-muted-foreground">
					{new Date(item.takenAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
				</span>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
