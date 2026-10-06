<script lang="ts">
	import './layout.css';
	import { ModeWatcher } from 'mode-watcher';
	import SiteHeader from '#lib/components/site-header.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';

	let { children } = $props();
</script>

<ModeWatcher themeColors={{ light: '#ffffff', dark: '#0a0a0a' }} />
<Toaster />
<div class="flex min-h-svh flex-col">
	<SiteHeader />
	{@render children()}
</div>
