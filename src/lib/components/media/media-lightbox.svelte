<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import FolderMinusIcon from '@lucide/svelte/icons/folder-minus';
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import ImageOffIcon from '@lucide/svelte/icons/image-off';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import type { MediaItem } from '#lib/media/types.js';
	import MediaImage from './media-image.svelte';

	let {
		items,
		openId = $bindable(null),
		hasMore,
		onloadmore,
		onaddtoalbum,
		onremovefromalbum,
		ondelete
	}: {
		items: MediaItem[];
		/** The item being viewed, or null when closed. Tracked by id so an upload or delete can't shift it. */
		openId?: string | null;
		hasMore: boolean;
		onloadmore: () => void;
		/** Given to show the ⋯ menu with "Add to album". */
		onaddtoalbum?: (id: string) => void;
		/** Given (in an album) to add "Remove from album" to the ⋯ menu. */
		onremovefromalbum?: (id: string) => void;
		/** Given to add "Delete" to the ⋯ menu, behind a confirmation. Settles once done; reports its own errors. */
		ondelete?: (id: string) => Promise<void>;
	} = $props();

	let contentRef: HTMLElement | null = $state(null);
	let confirmOpen = $state(false);
	let deleting = $state(false);

	const index = $derived(openId === null ? -1 : items.findIndex((i) => i.id === openId));
	const item = $derived(items[index]);

	function go(step: -1 | 1) {
		const next = items[index + step];
		if (!next) return;
		openId = next.id;
		// Keeps pages coming for someone paging through the lightbox without touching the grid.
		if (hasMore && index + step >= items.length - 4) onloadmore();
	}

	async function confirmDelete(event: MouseEvent) {
		// The dialog stays open until the request has finished.
		event.preventDefault();
		if (!ondelete || !item) return;
		deleting = true;
		try {
			await ondelete(item.id);
		} finally {
			deleting = false;
			confirmOpen = false;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		// Arrow keys seek inside a focused video, and with a modifier they belong to the browser (Alt+Left is Back).
		if (openId === null || event.target instanceof HTMLVideoElement) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		// Typing, a menu, or another dialog on top (e.g. the album picker) owns the arrow keys.
		if (event.target instanceof HTMLElement) {
			const target = event.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target.isContentEditable ||
				target.closest('[role="menu"]')
			)
				return;
			const dialog = target.closest('[role="dialog"], [role="alertdialog"]');
			if (dialog && !contentRef?.contains(target)) return;
		}
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
		bind:ref={contentRef}
		class="top-0 left-0 flex h-svh w-svw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none"
		showCloseButton={false}
	>
		<!-- Only a way back and a menu; the name and date sit below the picture. Outside the {#if}, so there is
		 always a way out, even when the open id no longer matches an item. -->
		<div class="flex shrink-0 items-center justify-between px-2 py-2">
			<Button variant="ghost" size="icon-lg" aria-label="Back" onclick={() => (openId = null)}>
				<ArrowLeftIcon />
			</Button>
			{#if item && (onaddtoalbum || onremovefromalbum || ondelete)}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon-lg" aria-label="More options">
								<EllipsisVerticalIcon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="w-52 whitespace-nowrap" align="end">
						{#if onaddtoalbum || onremovefromalbum}
							<DropdownMenu.Group>
								<DropdownMenu.Label>Album</DropdownMenu.Label>
								{#if onaddtoalbum}
									<DropdownMenu.Item onSelect={() => onaddtoalbum(item.id)}>
										<FolderPlusIcon />
										Add to album
									</DropdownMenu.Item>
								{/if}
								{#if onremovefromalbum}
									<DropdownMenu.Item onSelect={() => onremovefromalbum(item.id)}>
										<FolderMinusIcon />
										Remove from album
									</DropdownMenu.Item>
								{/if}
							</DropdownMenu.Group>
						{/if}
						{#if ondelete}
							{#if onaddtoalbum || onremovefromalbum}
								<DropdownMenu.Separator />
							{/if}
							<DropdownMenu.Group>
								<DropdownMenu.Item variant="destructive" onSelect={() => (confirmOpen = true)}>
									<TrashIcon />
									Delete
								</DropdownMenu.Item>
							</DropdownMenu.Group>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		</div>

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

			<!-- Not dismissable mid-request: closing it would invite a second Delete for an item that is already gone. -->
			<AlertDialog.Root
				bind:open={
					() => confirmOpen,
					(open) => {
						if (!deleting) confirmOpen = open;
					}
				}
			>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title class="line-clamp-2 wrap-anywhere">
							Delete "{item.name}"?
						</AlertDialog.Title>
						<AlertDialog.Description>
							It is removed from your library and from every album, and can't be recovered.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action variant="destructive" disabled={deleting} onclick={confirmDelete}>
							{#if deleting}
								<Spinner data-icon="inline-start" />
							{/if}
							Delete
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}
	</Dialog.Content>
</Dialog.Root>
