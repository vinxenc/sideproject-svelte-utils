<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import { createAlbum } from '#lib/albums/api.js';
	import { ALBUM_NAME_MAX, checkAlbumName } from '#lib/albums/types.js';
	import type { AlbumSummary } from '#lib/albums/types.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Field from '#lib/components/ui/field/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';

	let {
		open = $bindable(false),
		showTrigger = true,
		oncreated
	}: {
		open?: boolean;
		showTrigger?: boolean;
		oncreated: (album: AlbumSummary) => void;
	} = $props();

	let name = $state('');
	let error = $state('');
	let pending = $state(false);

	function reset() {
		name = '';
		error = '';
	}

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
			const album = await createAlbum(checked.name);
			open = false;
			reset();
			toast.success('Album created');
			oncreated(album);
		} catch (e) {
			// The dialog stays open, so the name can be corrected or retried.
			error = e instanceof Error ? e.message : 'Something went wrong';
		} finally {
			pending = false;
		}
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(isOpen) => {
		if (!isOpen) reset();
	}}
>
	{#if showTrigger}
		<Dialog.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="icon-sm" aria-label="New album">
					<PlusIcon />
				</Button>
			{/snippet}
		</Dialog.Trigger>
	{/if}

	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>New album</Dialog.Title>
			<Dialog.Description>Give it a name. You can add photos and videos next.</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={submit} class="flex flex-col gap-4" novalidate>
			<Field.Field data-invalid={error ? true : undefined}>
				<Field.Label for="album-name">Name</Field.Label>
				<Input
					id="album-name"
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
				<Button type="submit" disabled={pending || !name.trim()}>
					{#if pending}
						<Spinner data-icon="inline-start" />
					{/if}
					Create
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
