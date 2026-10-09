<script lang="ts">
	import CameraIcon from '@lucide/svelte/icons/camera';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import CameraCapture from './camera-capture.svelte';
	import UploadTile from './upload-tile.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import type { MediaItem } from '#lib/media/types.js';
	import { uploads } from '#lib/media/uploads.svelte.js';
	import { cn } from '#lib/utils.js';

	let {
		onuploaded,
		album,
		hideTrigger = false
	}: {
		onuploaded: (item: MediaItem, albumId: string | null) => void;
		/** Uploads go straight into this album as well as the library. */
		album?: { id: string; name: string };
		/** Hides the round button, e.g. while the gallery is selecting items. The dialog stays mounted. */
		hideTrigger?: boolean;
	} = $props();

	// Where files can come from. The row of buttons is built from this, so a new source is one more entry.
	let cameraOpen = $state(false);
	let library: HTMLInputElement | undefined;
	const sources = [
		{ label: 'Library', icon: ImagesIcon, pick: () => library?.click() },
		{ label: 'Camera', icon: CameraIcon, pick: () => (cameraOpen = true) }
	];

	// The files and their uploads live in the store, which outlives this component.
	$effect(() => uploads.attach(onuploaded));

	function onpick(event: Event & { currentTarget: HTMLInputElement }) {
		const files = [...(event.currentTarget.files ?? [])];
		event.currentTarget.value = ''; // so choosing the same file again fires change
		uploads.add(files, album ?? null);
	}

	// Dropping files is a pointer-only shortcut, but the drop must be handled either way: otherwise the
	// browser opens the dropped file in place of the page, and an upload in progress with it.
	function ondragover(event: DragEvent) {
		event.preventDefault();
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		if (!uploads.uploading) uploads.add([...(event.dataTransfer?.files ?? [])], album ?? null);
	}
</script>

<Dialog.Root
	bind:open={uploads.open}
	onOpenChange={(isOpen) => {
		if (!isOpen) {
			cameraOpen = false; // every way out of the dialog also leaves the camera
			uploads.close();
		}
	}}
>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="icon-lg"
				class={cn(
					'fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 size-14 rounded-full shadow-lg sm:right-6 sm:bottom-6 [&_svg]:size-6!',
					hideTrigger && 'hidden'
				)}
			>
				{#if uploads.uploading}
					<Spinner />
				{:else}
					<PlusIcon />
				{/if}
				<span class="sr-only"
					>{uploads.uploading
						? 'Uploading photos and videos'
						: album
							? `Add photos and videos to ${album.name}`
							: 'Add photos and videos'}</span
				>
			</Button>
		{/snippet}
	</Dialog.Trigger>

	<!-- A phone gets the whole screen: the previews take the room between the header and the buttons. -->
	<Dialog.Content
		onEscapeKeydown={(event) => {
			// Escape leaves the camera first, not the whole dialog.
			if (cameraOpen) {
				event.preventDefault();
				cameraOpen = false;
			}
		}}
		class="max-sm:top-0 max-sm:left-0 max-sm:flex max-sm:h-svh max-sm:w-svw max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:flex-col max-sm:rounded-none max-sm:pt-[max(1rem,env(safe-area-inset-top))] max-sm:pb-[max(1rem,env(safe-area-inset-bottom))] max-sm:ring-0 sm:max-w-lg"
	>
		<Dialog.Header>
			{#if album}
				<Dialog.Title class="truncate" title={album.name}>Add to "{album.name}"</Dialog.Title>
				<Dialog.Description>
					New photos and videos go into this album and your library.
				</Dialog.Description>
			{:else}
				<Dialog.Title>Add to gallery</Dialog.Title>
				<Dialog.Description>
					Choose photos and videos from your library, check the previews, then submit.
				</Dialog.Description>
			{/if}
		</Dialog.Header>

		<!-- On a wide screen the area is tall enough for two rows of previews (6 files) even when empty, so
		     the dialog doesn't jump in height as files are added (less on a short window); on a phone it
		     fills the free space instead. -->
		<div
			role="presentation"
			class="flex min-h-0 flex-col gap-3 max-sm:flex-1 sm:h-[min(20rem,45svh)]"
			{ondragover}
			{ondrop}
		>
			{#if uploads.rows.length}
				<!-- The padding and negative margin leave room for the cards' focus rings inside the scroller. -->
				<ul
					class="-m-1 grid min-h-0 grid-cols-2 content-start gap-2 overflow-y-auto p-1 max-sm:flex-1 sm:grid-cols-3"
				>
					{#each uploads.rows as row (row.key)}
						<UploadTile {row} />
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Square buttons in a row that swipes sideways, so more sources fit later. The negative margin lets the
		     row scroll edge to edge while its first button lines up with the content. -->
		<div
			class="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden"
		>
			{#each sources as source (source.label)}
				<Button
					variant="outline"
					class="size-20 shrink-0 snap-start flex-col gap-1.5"
					disabled={uploads.uploading}
					onclick={source.pick}
				>
					<source.icon class="size-6" />
					{source.label}
				</Button>
			{/each}
			<input
				bind:this={library}
				type="file"
				multiple
				accept="image/*,video/*"
				class="hidden"
				onchange={onpick}
			/>
		</div>

		<!-- Both buttons share one row on a phone, each taking half of it. -->
		<Dialog.Footer class="max-sm:flex-row max-sm:*:flex-1">
			<Button variant="outline" onclick={() => uploads.close()}>
				{uploads.uploading ? 'Hide' : 'Cancel'}
			</Button>
			<Button
				disabled={uploads.uploading || uploads.pending.length === 0}
				onclick={() => uploads.submit()}
			>
				{#if uploads.uploading}
					<Spinner data-icon="inline-start" />
					Uploading
				{:else}
					Submit{uploads.pending.length ? ` (${uploads.pending.length})` : ''}
				{/if}
			</Button>
		</Dialog.Footer>

		{#if cameraOpen}
			<CameraCapture
				oncapture={(file) => uploads.add([file], album ?? null)}
				onclose={() => (cameraOpen = false)}
			/>
		{/if}
	</Dialog.Content>
</Dialog.Root>
