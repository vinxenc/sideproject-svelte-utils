<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ImageIcon from '@lucide/svelte/icons/image';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import VideoIcon from '@lucide/svelte/icons/video';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Attachment from '#lib/components/ui/attachment/index.js';
	import type { AttachmentState } from '#lib/components/ui/attachment/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Progress } from '#lib/components/ui/progress/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { formatBytes, formatDuration } from '#lib/media/format.js';
	import { inFlight, uploads } from '#lib/media/uploads.svelte.js';
	import type { Row } from '#lib/media/uploads.svelte.js';

	let { row }: { row: Row } = $props();

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
</script>

<!-- One attachment card per picked file: its thumbnail or poster, name, and where it is in the upload. -->
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
