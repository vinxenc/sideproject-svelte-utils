<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CameraIcon from '@lucide/svelte/icons/camera';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import VideoIcon from '@lucide/svelte/icons/video';
	import XIcon from '@lucide/svelte/icons/x';
	import CameraCapture from './camera-capture.svelte';
	import * as Attachment from '#lib/components/ui/attachment/index.js';
	import type { AttachmentState } from '#lib/components/ui/attachment/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { formatBytes, formatDuration } from '#lib/media/format.js';
	import type { MediaItem } from '#lib/media/types.js';
	import { inFlight, uploads } from '#lib/media/uploads.svelte.js';
	import type { Row } from '#lib/media/uploads.svelte.js';

	let { onuploaded }: { onuploaded: (item: MediaItem) => void } = $props();

	// Where files can come from. The row of buttons is built from this, so a new source is one more entry.
	let cameraOpen = $state(false);
	let library: HTMLInputElement | undefined;
	const sources = [
		{ label: 'Library', icon: ImagesIcon, pick: () => library?.click() },
		{ label: 'Camera', icon: CameraIcon, pick: () => (cameraOpen = true) }
	];

	// The files and their uploads live in the store, which outlives this component.
	$effect(() => uploads.attach(onuploaded));

	const STATE: Record<Row['stage'], AttachmentState> = {
		preview: 'idle',
		ready: 'idle',
		queued: 'uploading',
		preparing: 'uploading',
		uploading: 'uploading',
		finishing: 'processing',
		done: 'done',
		error: 'error'
	};

	function describe(row: Row) {
		switch (row.stage) {
			case 'preview':
				return 'Preparing preview';
			case 'ready':
				return formatBytes(row.file.size);
			case 'queued':
				return 'Waiting';
			case 'preparing':
				return 'Preparing';
			case 'uploading':
				return `Uploading ${Math.round(row.progress * 100)}%`;
			case 'finishing':
				return 'Finishing';
			case 'done':
				return `Added · ${formatBytes(row.file.size)}`;
			case 'error':
				return row.error;
		}
	}

	function onpick(event: Event & { currentTarget: HTMLInputElement }) {
		const files = [...(event.currentTarget.files ?? [])];
		event.currentTarget.value = ''; // so choosing the same file again fires change
		uploads.add(files);
	}

	// Dropping files is a pointer-only shortcut, but the drop must be handled either way: otherwise the
	// browser opens the dropped file in place of the page, and an upload in progress with it.
	function ondragover(event: DragEvent) {
		event.preventDefault();
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		if (!uploads.uploading) uploads.add([...(event.dataTransfer?.files ?? [])]);
	}
</script>

<!-- One attachment card per picked file: its thumbnail or poster, name, and where it is in the upload. -->
{#snippet tile(row: Row)}
	<li class="min-w-0">
		<!-- The preview fills the whole card, with the name and status laid over it. A card is 120px wide
		     and padded by default; each reset repeats the component's own `has-…:` prefix, which a plain
		     class would lose to. -->
		<Attachment.Root
			orientation="vertical"
			state={STATE[row.stage]}
			class="aspect-square w-full overflow-hidden p-0 has-data-[slot=attachment-content]:w-full has-data-[slot=attachment-content]:px-0 has-data-[slot=attachment-content]:py-0 has-data-[slot=attachment-media]:p-0"
		>
			<Attachment.Media
				variant={row.previewUrl ? 'image' : 'icon'}
				class="absolute inset-0 size-full rounded-none"
			>
				{#if row.previewUrl}
					<img src={row.previewUrl} alt="" draggable="false" />
				{:else if row.stage === 'preview'}
					<Skeleton class="size-full rounded-none" />
				{:else if row.kind === 'VIDEO'}
					<VideoIcon />
				{:else}
					<ImageIcon />
				{/if}

				{#if row.kind === 'VIDEO'}
					<Badge variant="secondary" class="absolute top-2 left-2">
						<PlayIcon data-icon="inline-start" />
						{#if row.duration !== null}{formatDuration(row.duration)}{/if}
					</Badge>
				{/if}
				{#if inFlight(row)}
					<span class="absolute inset-0 flex items-center justify-center"><Spinner /></span>
				{:else if row.stage === 'done'}
					<span class="absolute inset-0 flex items-center justify-center bg-background/50">
						<CheckIcon />
					</span>
				{/if}
			</Attachment.Media>

			<Attachment.Content
				class="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/95 via-background/70 to-transparent pt-8 pb-2 group-data-[orientation=vertical]/attachment:px-2.5"
			>
				<Attachment.Title title={row.file.name}>{row.file.name}</Attachment.Title>
				<Attachment.Description title={row.stage === 'error' ? row.error : undefined}>
					{describe(row)}
				</Attachment.Description>
				{#if row.stage === 'uploading'}
					<Progress
						value={row.progress * 100}
						class="mt-1.5"
						aria-label="Uploading {row.file.name}"
					/>
				{/if}
			</Attachment.Content>

			{#if !inFlight(row) && row.stage !== 'done'}
				<Attachment.Actions>
					{#if row.stage === 'error'}
						<Attachment.Action
							variant="secondary"
							class="rounded-full"
							aria-label="Retry {row.file.name}"
							onclick={() => void uploads.run(row)}
						>
							<RotateCwIcon />
						</Attachment.Action>
					{/if}
					<Attachment.Action
						variant="secondary"
						class="rounded-full"
						aria-label="Remove {row.file.name}"
						onclick={() => uploads.remove(row)}
					>
						<XIcon />
					</Attachment.Action>
				</Attachment.Actions>
			{/if}
		</Attachment.Root>
	</li>
{/snippet}

<Dialog.Root
	bind:open={uploads.open}
	onOpenChange={(isOpen) => {
		if (!isOpen) uploads.close();
	}}
>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				size="icon-lg"
				class="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 size-14 rounded-full shadow-lg sm:right-6 sm:bottom-6 [&_svg]:size-6!"
			>
				{#if uploads.uploading}
					<Spinner />
				{:else}
					<PlusIcon />
				{/if}
				<span class="sr-only"
					>{uploads.uploading ? 'Uploading photos and videos' : 'Add photos and videos'}</span
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
			<Dialog.Title>Add to gallery</Dialog.Title>
			<Dialog.Description>
				Choose photos and videos from your library, check the previews, then submit.
			</Dialog.Description>
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
						{@render tile(row)}
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

		<Dialog.Footer>
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
				oncapture={(file) => uploads.add([file])}
				onclose={() => (cameraOpen = false)}
			/>
		{/if}
	</Dialog.Content>
</Dialog.Root>
