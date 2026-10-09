<script lang="ts">
	import FolderPlusIcon from '@lucide/svelte/icons/folder-plus';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { addToAlbum, createAlbum } from '#lib/albums/api.js';
	import { AlbumList } from '#lib/albums/album-list.svelte.js';
	import { formatCount } from '#lib/albums/format.js';
	import { checkAlbumName, ALBUM_NAME_MAX } from '#lib/albums/types.js';
	import type { AlbumSummary } from '#lib/albums/types.js';
	import MediaImage from '#lib/components/media/media-image.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	let {
		open = $bindable(false),
		mediaIds,
		excludeAlbumId,
		onadded
	}: {
		open?: boolean;
		mediaIds: string[];
		/** The album being viewed, which can't be a target. */
		excludeAlbumId?: string;
		onadded?: (album: { id: string; name: string }, added: number) => void;
	} = $props();

	const list = new AlbumList(30);
	// The album being added to, or 'new' while the inline create runs.
	let busyId = $state<string | null>(null);
	let creating = $state(false);
	let newName = $state('');
	let newError = $state('');

	function start() {
		list.reset();
		void list.load();
		creating = false;
		newName = '';
		newError = '';
	}

	// Runs on every open, however it was opened (the prop is bound by the caller). It is the only place the
	// list is loaded: a plain effect that also reads the list would reload it forever.
	$effect(() => {
		if (open) untrack(start);
	});

	async function addTo(album: { id: string; name: string }) {
		busyId = album.id;
		try {
			const added = await addToAlbum(album.id, mediaIds);
			toast.success(
				added === 0
					? `Already in "${album.name}"`
					: `Added ${formatCount(added)} to "${album.name}"`
			);
			open = false;
			onadded?.({ id: album.id, name: album.name }, added);
		} catch (e) {
			toast.error("Couldn't add to the album", {
				description: e instanceof Error ? e.message : 'Something went wrong'
			});
		} finally {
			busyId = null;
		}
	}

	async function createAndAdd(event: SubmitEvent) {
		event.preventDefault();
		const checked = checkAlbumName(newName);
		if (!checked.ok) {
			newError = checked.error;
			return;
		}
		newError = '';
		busyId = 'new';
		let album: AlbumSummary;
		try {
			album = await createAlbum(checked.name);
		} catch (e) {
			newError = e instanceof Error ? e.message : 'Something went wrong';
			busyId = null;
			return;
		}
		await addTo(album);
	}

	const title = $derived(`Add ${formatCount(mediaIds.length)} to an album`);
	const targets = $derived(list.items.filter((a) => a.id !== excludeAlbumId));
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>Pick an album, or create one for these.</Dialog.Description>
		</Dialog.Header>

		<div class="flex max-h-[min(24rem,60svh)] flex-col gap-1 overflow-y-auto">
			<Button
				variant="ghost"
				class="justify-start"
				disabled={busyId !== null}
				onclick={() => (creating = !creating)}
			>
				<PlusIcon data-icon="inline-start" />
				New album
			</Button>

			{#if creating}
				<form onsubmit={createAndAdd} class="flex flex-col gap-2 p-1" novalidate>
					<Field.Field data-invalid={newError ? true : undefined}>
						<Field.Label for="new-album-name">Name</Field.Label>
						<Input
							id="new-album-name"
							maxlength={ALBUM_NAME_MAX}
							autocomplete="off"
							bind:value={newName}
							aria-invalid={!!newError}
						/>
						{#if newError}
							<Field.Error>{newError}</Field.Error>
						{/if}
					</Field.Field>
					<Button type="submit" disabled={busyId !== null || !newName.trim()}>
						{#if busyId === 'new'}
							<Spinner data-icon="inline-start" />
						{/if}
						Create and add
					</Button>
				</form>
			{/if}

			{#if list.loading && !list.loaded}
				{#each Array.from({ length: 3 }, (_, i) => i) as i (i)}
					<div class="flex items-center gap-3 p-2">
						<Skeleton class="size-10 shrink-0 rounded-md" />
						<Skeleton class="h-4 flex-1" />
					</div>
				{/each}
			{:else if list.error && !list.loaded}
				<div class="flex items-center gap-2 p-2">
					<p class="text-sm text-muted-foreground">Couldn't load your albums.</p>
					<Button variant="link" size="sm" onclick={() => list.load()}>Try again</Button>
				</div>
			{:else if list.loaded && targets.length === 0 && !creating}
				<Empty.Root>
					<Empty.Header>
						<Empty.Media variant="icon"><ImagesIcon /></Empty.Media>
						<Empty.Title>No albums yet</Empty.Title>
						<Empty.Description>Create one above to add these to it.</Empty.Description>
					</Empty.Header>
				</Empty.Root>
			{:else}
				{#each targets as album (album.id)}
					<button
						type="button"
						class="flex items-center gap-3 rounded-md p-2 text-start hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
						disabled={busyId !== null}
						onclick={() => addTo(album)}
					>
						<span class="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
							{#if album.previews[0]?.hasThumb}
								<MediaImage
									src="/api/media/{album.previews[0].id}/thumb"
									alt=""
									lazy
									class="absolute inset-0"
								>
									{#snippet fallback()}
										<ImagesIcon class="absolute inset-0 m-auto text-muted-foreground" />
									{/snippet}
								</MediaImage>
							{:else}
								<ImagesIcon class="absolute inset-0 m-auto text-muted-foreground" />
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium" title={album.name}>{album.name}</span
							>
							<span class="block truncate text-xs text-muted-foreground">
								{formatCount(album.count)}
							</span>
						</span>
						{#if busyId === album.id}
							<Spinner />
						{:else}
							<FolderPlusIcon class="text-muted-foreground" />
						{/if}
					</button>
				{/each}

				{#if list.loading && list.loaded}
					<Skeleton class="h-14 w-full" />
				{:else if list.error}
					<div class="flex items-center gap-2 p-2">
						<p class="text-sm text-muted-foreground">Couldn't load more albums.</p>
						<Button variant="link" size="sm" onclick={() => list.load()}>Try again</Button>
					</div>
				{:else if !list.done && list.loaded}
					<Button variant="ghost" onclick={() => list.load()}>Load more</Button>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
