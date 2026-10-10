<script lang="ts">
	import ImagesIcon from '@lucide/svelte/icons/images';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { AlbumList } from '#lib/albums/album-list.svelte.js';
	import AlbumCard from '#lib/components/albums/album-card.svelte';
	import CreateAlbumDialog from '#lib/components/albums/create-album-dialog.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	const list = new AlbumList(30);
	let createOpen = $state(false);

	// One id, so repeated failures replace the toast; it stays until used or cleared.
	const ERROR_TOAST = 'albums-load-error';

	$effect(() => {
		if (list.error) {
			toast.error("Couldn't load your albums", {
				id: ERROR_TOAST,
				description: list.error,
				duration: Infinity,
				action: { label: 'Try again', onClick: () => void list.load() }
			});
		} else {
			toast.dismiss(ERROR_TOAST);
		}
	});

	onMount(() => {
		void list.load();
		// Leaving the page makes the retry pointless.
		return () => toast.dismiss(ERROR_TOAST);
	});

	// Loads the next page when the end of the list scrolls into view.
	function nearEnd(node: HTMLElement) {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) void list.load();
			},
			{ rootMargin: '800px 0px' }
		);
		observer.observe(node);
		return () => observer.disconnect();
	}
</script>

<svelte:head>
	<title>Albums · Utilities</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex items-center gap-1">
		<h1 class="text-xl font-semibold">Albums</h1>
		<div class="ms-auto">
			<CreateAlbumDialog oncreated={(a) => goto(`/photo-video/albums/${a.id}`)} />
		</div>
	</div>

	{#if !list.loaded}
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-16 sm:gap-y-24 lg:grid-cols-4 xl:grid-cols-5"
		>
			{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
				<div>
					<Skeleton class="aspect-[100/131] w-full rounded-xl" />
					<Skeleton class="mt-2 h-4 w-3/4" />
				</div>
			{/each}
		</div>
	{:else if list.items.length === 0}
		<Empty.Root>
			<Empty.Header>
				<Empty.Media variant="icon"><ImagesIcon /></Empty.Media>
				<Empty.Title>No albums yet</Empty.Title>
				<Empty.Description>Create one, then add photos from Photo & video.</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button onclick={() => (createOpen = true)}>New album</Button>
			</Empty.Content>
		</Empty.Root>
		<CreateAlbumDialog
			showTrigger={false}
			bind:open={createOpen}
			oncreated={(a) => goto(`/photo-video/albums/${a.id}`)}
		/>
	{:else}
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-16 sm:gap-y-24 lg:grid-cols-4 xl:grid-cols-5"
		>
			{#each list.items as album (album.id)}
				<AlbumCard {album} />
			{/each}
		</div>
	{/if}

	{#if list.loaded && !list.done && !list.error && !list.loading}
		<div {@attach nearEnd} class="h-px" aria-hidden="true"></div>
	{/if}
</div>
