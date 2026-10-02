<script lang="ts">
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { toggleMode } from 'mode-watcher';
	import { Button } from '#lib/components/ui/button/index.js';
</script>

<header
	class="sticky top-0 z-10 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-2 border-b bg-background px-4 pt-[env(safe-area-inset-top)] md:px-6"
>
	<a href="/sign-in" class="flex items-center gap-2 font-medium">
		<div
			class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
		>
			<GalleryVerticalEndIcon class="size-4" />
		</div>
		Utilities
	</a>
	<Button onclick={toggleMode} variant="ghost" size="icon">
		<SunIcon class="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
		<MoonIcon class="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
		<span class="sr-only">Toggle theme</span>
	</Button>
</header>

<style>
	/* Installed desktop app with the title bar hidden: fill the title bar between the window buttons and the browser's own buttons. */
	@media (display-mode: window-controls-overlay) {
		header {
			height: env(titlebar-area-height, 2.25rem);
			padding: 0 calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)) 0
				calc(env(titlebar-area-x, 0px) + 0.25rem);
			-webkit-app-region: drag;
		}
		header :global(a),
		header :global(button) {
			-webkit-app-region: no-drag;
		}
		header :global(button) {
			width: 1.75rem;
			height: 1.75rem;
		}
	}
</style>
