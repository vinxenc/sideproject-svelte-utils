<script lang="ts">
	import type HouseIcon from '@lucide/svelte/icons/house';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';

	let {
		items,
		active = $bindable()
	}: {
		items: { name: string; icon: typeof HouseIcon }[];
		/** The page being shown. */
		active: string;
	} = $props();

	// Must be a child of Sidebar.Provider to reach its state, which is why this isn't inline in the page.
	const sidebar = Sidebar.useSidebar();

	function select(name: string) {
		active = name;
		// On a phone the menu is a sheet laid over the page: put it away once a page is chosen.
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}
</script>

<Sidebar.Menu>
	{#each items as item (item.name)}
		<Sidebar.MenuItem>
			<Sidebar.MenuButton isActive={item.name === active} onclick={() => select(item.name)}>
				<item.icon />
				<span>{item.name}</span>
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	{/each}
</Sidebar.Menu>
