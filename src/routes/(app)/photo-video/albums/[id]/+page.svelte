<script lang="ts">
	import DownloadIcon from '@lucide/svelte/icons/download';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import FileIcon from '@lucide/svelte/icons/file';
	import ImagesIcon from '@lucide/svelte/icons/images';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { deleteAlbum } from '#lib/albums/api.js';
	import Gallery from '#lib/components/media/gallery.svelte';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { uploads } from '#lib/media/uploads.svelte.js';

	let { data } = $props();

	let confirmOpen = $state(false);
	let deleting = $state(false);
	const album = $derived({ id: data.album.id, name: data.album.name });

	// An anchor with `download`, so a failure shows up as a failed download and the page stays put.
	function download() {
		const link = document.createElement('a');
		link.href = `/api/albums/${encodeURIComponent(data.album.id)}/download`;
		link.download = '';
		link.click();
	}

	async function confirmDelete(event: MouseEvent) {
		// The dialog stays open until the request has finished.
		event.preventDefault();
		deleting = true;
		try {
			await deleteAlbum(data.album.id);
			confirmOpen = false;
			toast.success('Album deleted', {
				description: 'Its photos and videos are still in your library.'
			});
			await goto('/photo-video/albums');
		} catch (e) {
			toast.error("Couldn't delete the album", {
				description: e instanceof Error ? e.message : 'Something went wrong'
			});
		} finally {
			deleting = false;
		}
	}
</script>

{#snippet title()}
	<div class="flex min-w-0 items-center justify-between gap-2">
		<h1 class="truncate text-xl font-semibold" title={data.album.name}>{data.album.name}</h1>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
				aria-label="Album options"
			>
				<EllipsisIcon />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-44" align="end">
				<!-- Delete is the last group: put any new actions above it, before a separator. -->
				<DropdownMenu.Group>
					<DropdownMenu.Label>File</DropdownMenu.Label>
					<!-- The gallery's upload dialog (uploading into this album) is bound to the store. -->
					<DropdownMenu.Item onSelect={() => (uploads.open = true)}>
						<FileIcon />
						New file
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={download}>
						<DownloadIcon />
						Download
					</DropdownMenu.Item>
				</DropdownMenu.Group>
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.Item variant="destructive" onSelect={() => (confirmOpen = true)}>
						<Trash2Icon />
						Delete
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
{/snippet}

{#snippet emptyAlbum()}
	<Empty.Root>
		<Empty.Header>
			<Empty.Media variant="icon"><ImagesIcon /></Empty.Media>
			<Empty.Title>This album is empty</Empty.Title>
			<Empty.Description>
				Upload with the + button, or add photos from Photo & video: select them, then Add to album.
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{/snippet}

<!-- Keyed so that moving to another album starts a fresh gallery. -->
{#key data.album.id}
	<Gallery {album} heading={title} empty={emptyAlbum} />
{/key}

<AlertDialog.Root bind:open={confirmOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="line-clamp-2 wrap-anywhere">
				Delete "{data.album.name}"?
			</AlertDialog.Title>
			<AlertDialog.Description>
				The album is deleted. Its photos and videos are kept in your library.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" disabled={deleting} onclick={confirmDelete}>
				{#if deleting}
					<Spinner data-icon="inline-start" />
				{/if}
				Delete album
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
