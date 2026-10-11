<script lang="ts">
	import TrashIcon from '@lucide/svelte/icons/trash';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import PasswordAvatar from '#lib/components/passwords/password-avatar.svelte';
	import PasswordReveal from '#lib/components/passwords/password-reveal.svelte';
	import { TYPE_LABELS, type PasswordItem } from '#lib/passwords/types.js';

	let {
		item,
		deleting = false,
		onopen,
		ondelete
	}: {
		item: PasswordItem;
		/** A delete for this item is in flight. */
		deleting?: boolean;
		onopen: (item: PasswordItem) => void;
		ondelete: (item: PasswordItem) => void;
	} = $props();
</script>

<!-- A native snap scroller: swiping left reveals the trash tile. overscroll-x-contain keeps the swipe on the row. -->
<div
	data-slot="password-row"
	class="flex snap-x snap-mandatory [scrollbar-width:none] gap-2 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
>
	<!-- 90px = 1.5x the phase 1 row (60px: py-2 + a 44px two-line text column). hover: only applies on hover-capable pointers (Tailwind v4). -->
	<div
		data-slot="password-card"
		class="flex min-h-[90px] w-full shrink-0 snap-start items-center gap-3 rounded-xl bg-muted px-3 py-2 transition-colors hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]"
	>
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-3 rounded-md text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
			onclick={() => onopen(item)}
		>
			<PasswordAvatar name={item.name} />
			<span class="flex min-w-0 flex-col">
				<span class="truncate font-medium">{item.name}</span>
				<span class="truncate text-sm text-muted-foreground"
					>{item.username ?? TYPE_LABELS[item.type]}</span
				>
			</span>
		</button>
		<div class="flex max-w-[45%] shrink-0 items-center gap-1 text-sm text-muted-foreground">
			<PasswordReveal id={item.id} name={item.name} />
		</div>
	</div>
	<Button
		variant="destructive"
		class="h-auto w-20 shrink-0 snap-end rounded-xl"
		aria-label={`Delete ${item.name}`}
		disabled={deleting}
		onclick={() => ondelete(item)}
	>
		{#if deleting}
			<Spinner />
		{:else}
			<TrashIcon class="size-5" />
		{/if}
	</Button>
</div>
