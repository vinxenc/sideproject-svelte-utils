<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { ApiError, revealPassword } from '#lib/passwords/api.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Spinner } from '#lib/components/ui/spinner/index.js';
	import { cn } from '#lib/utils.js';

	let {
		id,
		name,
		wrap = false
	}: {
		id: string;
		/** For the button's accessible name. */
		name: string;
		/** true: show the whole password, breaking anywhere (detail sheet). false: one truncated line (row). */
		wrap?: boolean;
	} = $props();

	// The revealed password, or null when hidden. Lives only in this instance.
	let value = $state<string | null>(null);
	let pending = $state(false);

	async function toggle(): Promise<void> {
		if (pending) return;
		// Hiding forgets the value, so every reveal POSTs again (phase 2 gates that POST).
		if (value !== null) {
			value = null;
			return;
		}
		pending = true;
		try {
			value = await revealPassword(id);
		} catch (e) {
			toast.error("Couldn't show the password", {
				description: e instanceof Error ? e.message : 'Something went wrong'
			});
			// The entry is gone (deleted elsewhere): refresh the list so it leaves the page.
			if (e instanceof ApiError && e.status === 404) void invalidateAll();
		} finally {
			pending = false;
		}
	}
</script>

{#if value === null}
	<!-- Always eight dots, so the password's length never shows. -->
	<span aria-hidden="true">••••••••</span>
	<span class="sr-only">Hidden</span>
{:else}
	<span class={cn('font-mono', wrap ? 'break-all' : 'truncate')}>{value}</span>
{/if}
<Button
	variant="ghost"
	size="icon-sm"
	aria-label={`${value === null ? 'Show' : 'Hide'} password for ${name}`}
	disabled={pending}
	onclick={toggle}
>
	{#if pending}
		<Spinner />
	{:else if value === null}
		<EyeIcon />
	{:else}
		<EyeOffIcon />
	{/if}
</Button>
