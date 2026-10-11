<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import * as InputGroup from '#lib/components/ui/input-group/index.js';

	let {
		value = $bindable(''),
		ref = $bindable(null)
	}: {
		/** The query. Filtering happens in the page; this component never sends it anywhere. */
		value?: string;
		ref?: HTMLInputElement | null;
	} = $props();
</script>

<InputGroup.Root class="h-10 rounded-xl border-transparent bg-muted dark:bg-muted">
	<InputGroup.Input
		bind:ref
		bind:value
		type="search"
		placeholder="Search"
		aria-label="Search passwords"
		autocomplete="off"
		autocapitalize="off"
		spellcheck="false"
		enterkeyhint="search"
	/>
	<InputGroup.Addon align="inline-start">
		<SearchIcon />
	</InputGroup.Addon>
</InputGroup.Root>
