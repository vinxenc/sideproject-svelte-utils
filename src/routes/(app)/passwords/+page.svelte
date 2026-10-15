<script lang="ts">
	import KeyRoundIcon from '@lucide/svelte/icons/key-round';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import AddPasswordSheet from '#lib/components/passwords/add-password-sheet.svelte';
	import PasswordDetailSheet from '#lib/components/passwords/password-detail-sheet.svelte';
	import PasswordRow from '#lib/components/passwords/password-row.svelte';
	import PasswordSearch from '#lib/components/passwords/password-search.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { ApiError, deletePassword } from '#lib/passwords/api.js';
	import { revealScrollLeft } from '#lib/passwords/tab-strip.js';
	import {
		filterByTab,
		matchesQuery,
		PASSWORD_TABS,
		searchItems,
		type PasswordItem,
		type PasswordTab,
		type PasswordType
	} from '#lib/passwords/types.js';

	let { data } = $props();

	let active = $state<PasswordTab>('ALL');
	let query = $state('');
	let strip = $state<HTMLElement | null>(null); // the Tabs.List element
	let searchInput = $state<HTMLInputElement | null>(null);
	let addOpen = $state(false);
	let detail = $state<PasswordItem | null>(null);
	let detailOpen = $state(false);
	const deleting = new SvelteSet<string>();

	const activeIndex = $derived(PASSWORD_TABS.findIndex((t) => t.value === active));
	const tabItems = $derived(filterByTab(data.passwords, active));
	const items = $derived(searchItems(tabItems, query));
	const addType = $derived<PasswordType>(active === 'ALL' ? 'APP' : active);

	// Every tab change goes through here: triggers and arrow keys both call it.
	function selectTab(tab: PasswordTab): void {
		active = tab;
	}

	function clearSearch(): void {
		query = '';
		searchInput?.focus();
	}

	function openDetail(item: PasswordItem): void {
		detail = item;
		detailOpen = true;
	}

	/** Resolves true when the entry is gone. The detail sheet closes itself once the list refreshes. */
	async function remove(item: PasswordItem): Promise<boolean> {
		if (deleting.has(item.id)) return false;
		deleting.add(item.id);
		try {
			await deletePassword(item.id);
		} catch (e) {
			// Already gone counts as deleted.
			if (!(e instanceof ApiError && e.status === 404)) {
				toast.error("Couldn't delete the password", {
					description: e instanceof Error ? e.message : 'Something went wrong'
				});
				deleting.delete(item.id);
				return false;
			}
		}
		toast.success('Password deleted');
		try {
			await invalidateAll();
		} finally {
			// Stays disabled until the list has refreshed, so the trash can't be tapped twice.
			deleting.delete(item.id);
		}
		return true;
	}

	async function created(item: PasswordItem): Promise<void> {
		// Show the new entry: switch to its type's tab when another tab is open.
		if (active !== 'ALL' && active !== item.type) selectTab(item.type);
		// A query that would hide the new entry is cleared, so it never vanishes behind a stale search.
		if (!matchesQuery(item, query)) query = '';
		await invalidateAll();
	}

	// Keeps the selected label fully visible in the strip. A computed scrollTo, not scrollIntoView, so the window never scrolls.
	let stripMeasured = false; // plain variable: the first run only measures, so no scrollTo on mount
	$effect(() => {
		const i = activeIndex;
		if (!strip) return;
		const label = strip.querySelectorAll<HTMLElement>('[role="tab"]')[i];
		const start =
			label.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
		const left = revealScrollLeft(
			start,
			label.getBoundingClientRect().width,
			strip.scrollLeft,
			strip.clientWidth
		);
		// Always scrollTo after the first run: it aborts a smooth scroll still heading to an earlier tab,
		// even when `left` equals the current scrollLeft (the label is momentarily visible).
		if (stripMeasured || Math.abs(left - strip.scrollLeft) >= 1)
			strip.scrollTo({ left, behavior: 'smooth' });
		stripMeasured = true;
	});

	// Keeps the detail in step with the list: a delete, or a reveal that found the entry gone, closes it.
	$effect(() => {
		const shown = detail;
		if (shown && !data.passwords.some((p) => p.id === shown.id)) detailOpen = false;
	});
</script>

<div class="flex flex-col gap-4">
	<div class="flex items-center gap-2">
		<h1 class="text-xl font-semibold">Passwords</h1>
		<Button size="sm" class="ms-auto" onclick={() => (addOpen = true)}>
			<PlusIcon data-icon="inline-start" />
			Add
		</Button>
	</div>

	<PasswordSearch bind:value={query} bind:ref={searchInput} />

	<Tabs.Root bind:value={() => active, (v) => selectTab(v as PasswordTab)} class="gap-4">
		<Tabs.List
			bind:ref={strip}
			variant="line"
			class="w-full [scrollbar-width:none] justify-start gap-4 overflow-x-auto overscroll-x-contain px-1.5 [&::-webkit-scrollbar]:hidden"
		>
			{#each PASSWORD_TABS as tab (tab.value)}
				<Tabs.Trigger
					value={tab.value}
					class="flex-none text-base text-muted-foreground after:hidden data-[state=active]:font-semibold"
				>
					{tab.label}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
		<!-- One panel: only the active tab's list is mounted. -->
		<Tabs.Content value={active} tabindex={-1} class="text-base">
			{#key active}
				{#if items.length > 0}
					<ul class="flex flex-col gap-2">
						{#each items as item (item.id)}
							<li>
								<PasswordRow
									{item}
									deleting={deleting.has(item.id)}
									onopen={openDetail}
									ondelete={(i) => void remove(i)}
								/>
							</li>
						{/each}
					</ul>
				{:else if tabItems.length > 0}
					<Empty.Root>
						<Empty.Header>
							<Empty.Media variant="icon">
								<SearchXIcon />
							</Empty.Media>
							<Empty.Title>No results</Empty.Title>
							<Empty.Description class="wrap-anywhere"
								>No names or usernames match "{query.trim()}".</Empty.Description
							>
						</Empty.Header>
						<Empty.Content>
							<Button variant="outline" onclick={clearSearch}>Clear search</Button>
						</Empty.Content>
					</Empty.Root>
				{:else}
					<Empty.Root>
						<Empty.Header>
							<Empty.Media variant="icon">
								<KeyRoundIcon />
							</Empty.Media>
							<Empty.Title>{active === 'ALL' ? 'No passwords yet' : 'Nothing here yet'}</Empty.Title
							>
							<Empty.Description>
								{active === 'ALL'
									? 'Add your first one with the Add button.'
									: `Add a password and choose ${PASSWORD_TABS[activeIndex].label} as its type.`}
							</Empty.Description>
						</Empty.Header>
						<Empty.Content>
							<Button onclick={() => (addOpen = true)}>Add password</Button>
						</Empty.Content>
					</Empty.Root>
				{/if}
			{/key}
		</Tabs.Content>
	</Tabs.Root>
</div>

<AddPasswordSheet bind:open={addOpen} defaultType={addType} oncreated={(i) => void created(i)} />
<PasswordDetailSheet item={detail} bind:open={detailOpen} ondelete={remove} />
