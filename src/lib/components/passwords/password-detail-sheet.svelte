<script lang="ts">
	import TrashIcon from '@lucide/svelte/icons/trash';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import PasswordAvatar from '#lib/components/passwords/password-avatar.svelte';
	import PasswordReveal from '#lib/components/passwords/password-reveal.svelte';
	import { TYPE_LABELS, type PasswordItem } from '#lib/passwords/types.js';

	let {
		item,
		open = $bindable(false),
		ondelete
	}: {
		/** The entry shown; kept by the page while the sheet animates closed. */
		item: PasswordItem | null;
		open?: boolean;
		/** Resolves true when the entry is gone (deleted, or already missing). */
		ondelete: (item: PasswordItem) => Promise<boolean>;
	} = $props();

	let confirmOpen = $state(false);
	let pending = $state(false);

	async function confirmDelete(event: MouseEvent): Promise<void> {
		// Keeps the dialog open with its spinner until the request finishes.
		event.preventDefault();
		if (!item || pending) return;
		pending = true;
		try {
			if (await ondelete(item)) confirmOpen = false;
		} finally {
			pending = false;
		}
	}
</script>

<Sheet.Root bind:open>
	{#if item}
		<Sheet.Content side="right" class="data-[side=right]:w-full data-[side=right]:sm:max-w-sm">
			<Sheet.Header class="flex-row items-center gap-3">
				<PasswordAvatar name={item.name} />
				<div class="flex min-w-0 flex-col gap-1">
					<Sheet.Title class="truncate">{item.name}</Sheet.Title>
					<Sheet.Description>
						<Badge variant="secondary">{TYPE_LABELS[item.type]}</Badge>
					</Sheet.Description>
				</div>
			</Sheet.Header>

			<dl class="flex flex-col gap-4 px-4 text-sm">
				<div class="flex flex-col gap-1">
					<dt class="text-muted-foreground">Username or email</dt>
					<dd class="break-all">{item.username ?? '—'}</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-muted-foreground">Password</dt>
					<dd class="flex items-center gap-1">
						<PasswordReveal id={item.id} name={item.name} wrap />
					</dd>
				</div>
				<div class="flex flex-col gap-1">
					<dt class="text-muted-foreground">Added</dt>
					<dd>{new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</dd>
				</div>
			</dl>

			<Sheet.Footer>
				<Button variant="destructive" onclick={() => (confirmOpen = true)}>
					<TrashIcon data-icon="inline-start" />
					Delete
				</Button>
			</Sheet.Footer>

			<!-- Closes before the sheet does: the page closes the sheet only after the list has refreshed. -->
			<AlertDialog.Root bind:open={confirmOpen}>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title class="line-clamp-2 wrap-anywhere"
							>Delete "{item.name}"?</AlertDialog.Title
						>
						<AlertDialog.Description>It leaves your vault.</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel disabled={pending}>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action variant="destructive" disabled={pending} onclick={confirmDelete}>
							{#if pending}
								<Spinner data-icon="inline-start" />
							{/if}
							Delete password
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		</Sheet.Content>
	{/if}
</Sheet.Root>
