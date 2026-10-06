<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { cn } from '#lib/utils.js';

	let {
		src,
		alt,
		placeholder,
		fit = 'cover',
		lazy = false,
		class: className,
		fallback
	}: {
		src: string;
		alt: string;
		/** Shown under the loading overlay instead of the skeleton, e.g. the thumbnail while the original loads. */
		placeholder?: string;
		fit?: 'cover' | 'contain';
		lazy?: boolean;
		class?: string;
		/** Replaces the image when it can't be loaded or decoded. */
		fallback?: Snippet;
	} = $props();

	let status = $state<'loading' | 'loaded' | 'failed'>('loading');

	const objectFit = $derived(fit === 'cover' ? 'object-cover' : 'object-contain');
</script>

<div class={cn('relative overflow-hidden', className)} aria-busy={status === 'loading'}>
	{#if status === 'failed'}
		{@render fallback?.()}
	{:else}
		{#if placeholder && status === 'loading'}
			<img
				src={placeholder}
				alt=""
				aria-hidden="true"
				draggable="false"
				class={cn('absolute inset-0 size-full', objectFit)}
			/>
		{/if}
		<img
			{src}
			{alt}
			loading={lazy ? 'lazy' : 'eager'}
			decoding="async"
			draggable="false"
			class={cn(
				'absolute inset-0 size-full transition-opacity duration-300',
				objectFit,
				status === 'loaded' ? 'opacity-100' : 'opacity-0'
			)}
			onload={() => (status = 'loaded')}
			onerror={() => (status = 'failed')}
		/>
		{#if status === 'loading'}
			<!-- Loading overlay: a skeleton (unless a placeholder is already showing) with a spinner on top. -->
			<div
				out:fade={{ duration: 200 }}
				aria-hidden="true"
				class={cn(
					'absolute inset-0 flex items-center justify-center',
					placeholder && 'bg-background/40'
				)}
			>
				{#if !placeholder}
					<Skeleton class="absolute inset-0 rounded-none" />
				{/if}
				<Spinner class="relative text-muted-foreground" />
			</div>
		{/if}
	{/if}
</div>
