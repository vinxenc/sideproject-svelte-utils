<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	// A dashed-frame tile for an album row: the "All albums" and "New album" actions, and an album
	// with no photos yet. A link when `href` is set, a button otherwise.
	// The frame box (84% of the tile width, 3:4) is the same one album-card.svelte puts its photos in.
	let {
		label,
		subtitle,
		href,
		onclick,
		class: className,
		children
	}: {
		label: string;
		subtitle?: string;
		href?: string;
		onclick?: () => void;
		class?: string;
		children: Snippet;
	} = $props();

	const tile =
		'block min-w-0 rounded-xl text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/50';
</script>

{#snippet body()}
	<span class="block py-[9.4%]">
		<span
			class="mx-auto flex aspect-[3/4] w-[84%] items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground"
		>
			{@render children()}
		</span>
	</span>
	<span class="mt-2 block truncate text-sm font-medium" title={label}>{label}</span>
	{#if subtitle}
		<span class="block truncate text-xs text-muted-foreground">{subtitle}</span>
	{/if}
{/snippet}

{#if href}
	<a {href} class={cn(tile, className)}>{@render body()}</a>
{:else}
	<button type="button" {onclick} class={cn(tile, className)}>
		{@render body()}
	</button>
{/if}
