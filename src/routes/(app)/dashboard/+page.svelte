<script lang="ts">
	import BellIcon from '@lucide/svelte/icons/bell';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import HouseIcon from '@lucide/svelte/icons/house';
	import KeyboardIcon from '@lucide/svelte/icons/keyboard';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LockIcon from '@lucide/svelte/icons/lock';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle';
	import PaintbrushIcon from '@lucide/svelte/icons/paintbrush';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import VideoIcon from '@lucide/svelte/icons/video';
	import * as Breadcrumb from '#lib/components/ui/breadcrumb/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { authClient } from '#lib/auth-client.js';
	import { goto } from '$app/navigation';

	let { data } = $props();

	// sidebar-13's settings nav, laid out full page instead of in a dialog.
	const nav = [
		{ name: 'Home', icon: HouseIcon },
		{ name: 'Photo & video', icon: VideoIcon },
		{ name: 'Notifications', icon: BellIcon },
		{ name: 'Navigation', icon: MenuIcon },
		{ name: 'Appearance', icon: PaintbrushIcon },
		{ name: 'Messages & media', icon: MessageCircleIcon },
		{ name: 'Language & region', icon: GlobeIcon },
		{ name: 'Accessibility', icon: KeyboardIcon },
		{ name: 'Mark as read', icon: CheckIcon },
		{ name: 'Connected accounts', icon: LinkIcon },
		{ name: 'Privacy & visibility', icon: LockIcon },
		{ name: 'Advanced', icon: SettingsIcon }
	];
	let active = $state('Home');

	async function signOut() {
		await authClient.signOut();
		await goto('/sign-in', { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>{active} · Utilities</title>
</svelte:head>

<!-- Start below the desktop app's title bar instead of under it. -->
<Sidebar.Provider class="min-h-[calc(100svh-var(--titlebar-height))]">
	<Sidebar.Root class="top-(--titlebar-height) h-[calc(100svh-var(--titlebar-height))]">
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each nav as item (item.name)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={item.name === active}
									onclick={() => (active = item.name)}
								>
									<item.icon />
									<span>{item.name}</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
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
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 px-4">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-vertical:h-4 data-vertical:self-auto" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					<Breadcrumb.Item class="hidden md:block">Settings</Breadcrumb.Item>
					<Breadcrumb.Separator class="hidden md:block" />
					<Breadcrumb.Item>
						<Breadcrumb.Page>{active}</Breadcrumb.Page>
					</Breadcrumb.Item>
				</Breadcrumb.List>
			</Breadcrumb.Root>
		</header>
		<div class="flex flex-1 flex-col gap-4 p-4 pt-0">
			{#each Array.from({ length: 10 }, (_, i) => i) as i (i)}
				<div class="aspect-video max-w-3xl rounded-xl bg-muted/50"></div>
			{/each}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
