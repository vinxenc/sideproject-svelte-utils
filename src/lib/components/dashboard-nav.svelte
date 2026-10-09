<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { sectionHref, type NavItem } from '#lib/nav.js';

	let {
		items,
		active
	}: {
		items: NavItem[];
		/** The slug of the page being shown. */
		active: string;
	} = $props();

	// Must be a child of Sidebar.Provider to reach its state, which is why this isn't inline in the layout.
	const sidebar = Sidebar.useSidebar();

	function close() {
		// On a phone the menu is a sheet laid over the page: put it away once a page is chosen.
		if (sidebar.isMobile) sidebar.setOpenMobile(false);
	}
</script>

<Sidebar.Menu>
	{#each items as item (item.slug)}
		<Sidebar.MenuItem>
			<Sidebar.MenuButton isActive={item.slug === active}>
				{#snippet child({ props })}
					<a href={sectionHref(item.slug)} {...props} onclick={close}>
						<item.icon />
						<span>{item.name}</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
		</Sidebar.MenuItem>
	{/each}
</Sidebar.Menu>
