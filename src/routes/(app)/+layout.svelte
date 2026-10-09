<script lang="ts">
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DashboardNav from '#lib/components/dashboard-nav.svelte';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { authClient } from '#lib/auth-client.js';
	import { activeSlug, crumbsFor, NAV } from '#lib/nav.js';

	let { data, children } = $props();

	const crumbs = $derived(crumbsFor(page.route.id, page.url, page.data));
	const active = $derived(activeSlug(page.route.id, page.url));

	async function signOut() {
		const { error } = await authClient.signOut();
		if (error) return;
		await goto('/sign-in', { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>{crumbs.at(-1)!.label} · Utilities</title>
</svelte:head>

<!-- Start below the desktop app's title bar instead of under it. -->
<Sidebar.Provider class="min-h-[calc(100svh-var(--titlebar-height))]">
	<Sidebar.Root class="top-(--titlebar-height) h-[calc(100svh-var(--titlebar-height))]">
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<DashboardNav items={NAV} {active} />
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<div class="flex flex-col px-2 py-1.5 text-sm">
						<span class="truncate font-medium">{data.user.name}</span>
						<span class="truncate text-xs text-muted-foreground">{data.user.email}</span>
					</div>
				</Sidebar.MenuItem>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton onclick={signOut}>
						<LogOutIcon />
						<span>Sign out</span>
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Footer>
	</Sidebar.Root>
	<Sidebar.Inset class="min-w-0">
		<header class="flex h-16 shrink-0 items-center gap-2 px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-vertical:h-4 data-vertical:self-auto" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each crumbs as crumb, i (i)}
						<!-- On a phone only the last two crumbs fit. -->
						{@const hiddenOnPhone = i < crumbs.length - 2}
						<Breadcrumb.Item class={hiddenOnPhone ? 'hidden md:block' : undefined}>
							{#if crumb.href && i < crumbs.length - 1}
								<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
							{:else}
								<Breadcrumb.Page class="max-w-[50vw] truncate" title={crumb.label}>
									{crumb.label}
								</Breadcrumb.Page>
							{/if}
						</Breadcrumb.Item>
						{#if i < crumbs.length - 1}
							<Breadcrumb.Separator class={hiddenOnPhone ? 'hidden md:block' : undefined} />
						{/if}
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
