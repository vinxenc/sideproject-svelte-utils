<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import SiteHeader from '#lib/components/site-header.svelte';

	let { children } = $props();
</script>

<ModeWatcher themeColors={{ light: '#ffffff', dark: '#0a0a0a' }} />
<div class="flex min-h-svh flex-col">
	<SiteHeader />
	{@render children()}
</div>
