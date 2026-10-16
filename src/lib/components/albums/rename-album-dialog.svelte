<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { renameAlbum } from '#lib/albums/api.js';
	import { ALBUM_NAME_MAX, checkAlbumName } from '#lib/albums/types.js';
	import type { AlbumSummary } from '#lib/albums/types.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	let {
		open = $bindable(false),
		album,
		onrenamed
	}: {
		open?: boolean;
		/** The album being renamed; its name fills the field each time the dialog opens. */
		album: { id: string; name: string };
		onrenamed: (album: AlbumSummary) => void;
	} = $props();

	let name = $state('');
	let error = $state('');
	let pending = $state(false);

	// Starts from the current name each time the dialog opens, so a cancelled edit is forgotten.
	$effect(() => {
		if (open) {
			name = album.name;
			error = '';
		}
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (pending) return;
		const checked = checkAlbumName(name);
		if (!checked.ok) {
			error = checked.error;
			return;
		}
		error = '';
		pending = true;
		try {
			const renamed = await renameAlbum(album.id, checked.name);
			open = false;
			toast.success('Album renamed');
			onrenamed(renamed);
		} catch (e) {
			// The dialog stays open, so the name can be corrected or retried.
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			pending = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Rename album</Dialog.Title>
			<Dialog.Description>Choose a new name for this album.</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={submit} class="flex flex-col gap-4" novalidate>
			<Field.Field data-invalid={error ? true : undefined}>
				<Field.Label for="rename-album-name">Name</Field.Label>
				<Input
					id="rename-album-name"
					maxlength={ALBUM_NAME_MAX}
					autocomplete="off"
					bind:value={name}
					aria-invalid={!!error}
				/>
				{#if error}
					<Field.Error>{error}</Field.Error>
				{/if}
			</Field.Field>

			<Dialog.Footer>
				<Dialog.Close class={buttonVariants({ variant: 'outline' })}>Cancel</Dialog.Close>
				<Button type="submit" disabled={pending || !name.trim() || name.trim() === album.name}>
					{#if pending}
						<Spinner data-icon="inline-start" />
					{/if}
					Save
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
