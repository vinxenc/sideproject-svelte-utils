import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../src/routes/(app)/passwords/+page.svelte';
import { deferred } from '../../../helpers/media.js';
import { passwordItem } from '../../../helpers/passwords.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const nav = vi.hoisted(() => ({ invalidateAll: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const github = passwordItem({ id: 'p1', name: 'GitHub', username: 'ada@example.com', type: 'APP' });
const visa = passwordItem({ id: 'p2', name: 'Visa', username: null, type: 'CREDIT_CARD' });
const stripe = passwordItem({ id: 'p3', name: 'Stripe', username: null, type: 'API_KEY' });
const vault = [github, visa, stripe];

/** The one tab panel: only the active tab's list is mounted. */
const panel = () => screen.getByRole('tabpanel');
const tab = (label: string) => screen.getByRole('tab', { name: label });
const strip = () => screen.getByRole('tablist');
const search = () => screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search passwords' });
const selected = () =>
	screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true');

const scrollTo = vi.fn();

beforeEach(() => {
	fetchMock.mockReset();
	scrollTo.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof HTMLElement.prototype.scrollTo;
	nav.invalidateAll.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

function renderPage(passwords = vault) {
	return render(Page, { props: { data: { passwords } as never } });
}

describe('password tabs and panel', () => {
	it('shows All first, then the four types, and one panel named after the active tab', () => {
		renderPage();

		expect(screen.getAllByRole('tab').map((t) => t.textContent?.trim())).toEqual([
			'All',
			'App',
			'Credit card',
			'API key',
			'PIN platform'
		]);
		expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
		expect(screen.getByRole('tabpanel', { name: 'All' })).toBe(panel());
		expect(within(panel()).getAllByRole('listitem')).toHaveLength(3);
		expect(selected()?.textContent?.trim()).toBe('All');
	});

	it('stacks the tabs root on a horizontal orientation, so the panel sits below the strip', () => {
		const { container } = renderPage();
		const root = container.querySelector('[data-slot=tabs]');

		expect(root?.getAttribute('data-orientation')).toBe('horizontal');
		expect(root?.className).toContain('data-horizontal:flex-col');
	});

	it('lists only the active type when a type tab is clicked', async () => {
		renderPage();

		await fireEvent.click(tab('App'));
		expect(tab('App').getAttribute('aria-selected')).toBe('true');
		expect(within(panel()).getAllByRole('listitem')).toHaveLength(1);
		expect(within(panel()).getByText('GitHub')).toBeTruthy();

		await fireEvent.click(tab('Credit card'));
		expect(within(panel()).getAllByRole('listitem')).toHaveLength(1);
		expect(within(panel()).getByText('Visa')).toBeTruthy();
	});

	it('shows the empty state of the vault on All', () => {
		renderPage([]);

		expect(within(panel()).getByText('No passwords yet')).toBeTruthy();
		expect(within(panel()).getByText('Add your first one with the Add button.')).toBeTruthy();
	});

	it('shows the empty state of a type tab with its type named', async () => {
		renderPage([github]);

		await fireEvent.click(tab('Credit card'));

		expect(within(panel()).getByText('Nothing here yet')).toBeTruthy();
		expect(
			within(panel()).getByText('Add a password and choose Credit card as its type.')
		).toBeTruthy();
	});

	it("opens the add sheet from the empty state with that tab's type preselected", async () => {
		renderPage([github]);
		await fireEvent.click(tab('API key'));

		await fireEvent.click(within(panel()).getByRole('button', { name: 'Add password' }));

		expect(await screen.findByText('Saved to your vault. Only you can see it.')).toBeTruthy();
		expect(screen.getByRole('radio', { name: 'API key' }).getAttribute('aria-checked')).toBe(
			'true'
		);
	});

	it("opens the add sheet from the header with the active tab's type", async () => {
		renderPage();
		await fireEvent.click(tab('App'));

		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

		expect(await screen.findByText('Saved to your vault. Only you can see it.')).toBeTruthy();
		expect(screen.getByRole('radio', { name: 'App' }).getAttribute('aria-checked')).toBe('true');
	});

	it('selects the next tab with ArrowRight and the panel follows', async () => {
		renderPage();

		tab('All').focus();
		await fireEvent.keyDown(tab('All'), { key: 'ArrowRight' });

		expect(tab('App').getAttribute('aria-selected')).toBe('true');
		expect(within(panel()).getByText('GitHub')).toBeTruthy();
		expect(within(panel()).getAllByRole('listitem')).toHaveLength(1);
	});

	it('scrolls the selected label into view inside the strip, not the window', async () => {
		renderPage();
		const list = strip();
		Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 });
		Object.defineProperty(list, 'scrollLeft', { configurable: true, writable: true, value: 0 });
		const stripScrollTo = vi.fn();
		Object.defineProperty(list, 'scrollTo', { configurable: true, value: stripScrollTo });
		vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ left: 0 } as DOMRect);
		vi.spyOn(tab('PIN platform'), 'getBoundingClientRect').mockReturnValue({
			left: 280,
			width: 100
		} as DOMRect);

		await fireEvent.click(tab('PIN platform'));
		expect(stripScrollTo).toHaveBeenCalledWith({ left: 104, behavior: 'smooth' });

		// The strip has now scrolled to 104; All sits off the left edge.
		list.scrollLeft = 104;
		vi.spyOn(tab('All'), 'getBoundingClientRect').mockReturnValue({
			left: -104,
			width: 30
		} as DOMRect);
		await fireEvent.click(tab('All'));
		expect(stripScrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
	});

	it('re-issues the strip scroll for a label that is already visible, so a pending smooth scroll is replaced', async () => {
		renderPage();
		const list = strip();
		Object.defineProperty(list, 'clientWidth', { configurable: true, value: 300 });
		Object.defineProperty(list, 'scrollLeft', { configurable: true, writable: true, value: 30 });
		const stripScrollTo = vi.fn();
		Object.defineProperty(list, 'scrollTo', { configurable: true, value: stripScrollTo });
		vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ left: 0 } as DOMRect);
		vi.spyOn(tab('App'), 'getBoundingClientRect').mockReturnValue({
			left: 54,
			width: 40
		} as DOMRect);

		await fireEvent.click(tab('App'));

		expect(stripScrollTo).toHaveBeenCalledWith({ left: 30, behavior: 'smooth' });
	});

	it('does not scroll the strip on mount when every rect is zero', () => {
		renderPage();

		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('does not change tab for a horizontal swipe on the strip', async () => {
		renderPage();

		await fireEvent.pointerDown(strip(), { pointerType: 'touch', clientX: 300, clientY: 10 });
		await fireEvent.pointerUp(strip(), { pointerType: 'touch', clientX: 200, clientY: 10 });

		expect(tab('All').getAttribute('aria-selected')).toBe('true');
	});

	it('does not change tab for a horizontal swipe on the list', async () => {
		renderPage();

		await fireEvent.pointerDown(panel(), { pointerType: 'touch', clientX: 300, clientY: 10 });
		await fireEvent.pointerUp(panel(), { pointerType: 'touch', clientX: 200, clientY: 10 });
		await fireEvent.scroll(document.querySelector('[data-slot=password-row]') as HTMLElement);

		expect(tab('All').getAttribute('aria-selected')).toBe('true');
	});

	it('still selects a tab on a mouse click after a touch swipe on the strip', async () => {
		renderPage();

		await fireEvent.pointerDown(strip(), { pointerType: 'touch', clientX: 300, clientY: 10 });
		await fireEvent.pointerUp(strip(), { pointerType: 'touch', clientX: 200, clientY: 10 });
		await fireEvent.pointerDown(tab('Credit card'), { pointerType: 'mouse' });
		await fireEvent.click(tab('Credit card'));

		expect(tab('Credit card').getAttribute('aria-selected')).toBe('true');
	});
});

describe('search', () => {
	it('lists only the matching names when a query is typed', async () => {
		renderPage();

		await fireEvent.input(search(), { target: { value: 'git' } });

		expect(within(panel()).getAllByRole('listitem')).toHaveLength(1);
		expect(within(panel()).getByText('GitHub')).toBeTruthy();
	});

	it('matches the username case-insensitively', async () => {
		renderPage();

		await fireEvent.input(search(), { target: { value: 'ADA@' } });

		expect(within(panel()).getByText('GitHub')).toBeTruthy();
		expect(within(panel()).queryByText('Visa')).toBeNull();
	});

	it('lists everything for a whitespace-only query', async () => {
		renderPage();

		await fireEvent.input(search(), { target: { value: '   ' } });

		expect(within(panel()).getAllByRole('listitem')).toHaveLength(3);
	});

	it('never calls the server while searching', async () => {
		renderPage();

		await fireEvent.input(search(), { target: { value: 'git' } });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('shows No results with Clear search on a tab that has entries', async () => {
		renderPage();
		await fireEvent.input(search(), { target: { value: 'git' } });

		await fireEvent.click(tab('API key'));

		expect(within(panel()).getByText('No results')).toBeTruthy();
		expect(within(panel()).getByText('No names or usernames match "git".')).toBeTruthy();
		expect(within(panel()).getByRole('button', { name: 'Clear search' })).toBeTruthy();
	});

	it('clears the query, lists the tab again and focuses the search box', async () => {
		renderPage();
		await fireEvent.input(search(), { target: { value: 'git' } });
		await fireEvent.click(tab('API key'));

		await fireEvent.click(within(panel()).getByRole('button', { name: 'Clear search' }));

		expect(search().value).toBe('');
		expect(within(panel()).getByText('Stripe')).toBeTruthy();
		expect(document.activeElement).toBe(search());
	});

	it('shows the empty tab state, not No results, when the tab itself is empty', async () => {
		renderPage([github]);
		await fireEvent.input(search(), { target: { value: 'zzz' } });

		await fireEvent.click(tab('Credit card'));

		expect(within(panel()).getByText('Nothing here yet')).toBeTruthy();
		expect(within(panel()).queryByText('No results')).toBeNull();
	});

	it('clears a query that would hide a newly created entry', async () => {
		fetchMock.mockImplementation(async () => json(passwordItem({ id: 'p9', name: 'Bank' }), 201));
		renderPage();
		await fireEvent.input(search(), { target: { value: 'zzz' } });

		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		await screen.findByText('Saved to your vault. Only you can see it.');
		await fireEvent.input(document.getElementById('password-name') as HTMLInputElement, {
			target: { value: 'Bank' }
		});
		await fireEvent.input(document.getElementById('password-value') as HTMLInputElement, {
			target: { value: 'pw' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(nav.invalidateAll).toHaveBeenCalledTimes(1));
		expect(search().value).toBe('');
	});
});

describe('reveal resets with the tab', () => {
	it('hides a revealed password when the tab changes', async () => {
		fetchMock.mockImplementation(async () => json({ password: 'hunter2' }));
		renderPage();

		await fireEvent.click(screen.getByRole('button', { name: 'Show password for GitHub' }));
		expect(await screen.findByText('hunter2')).toBeTruthy();

		await fireEvent.click(tab('App'));

		expect(screen.queryByText('hunter2')).toBeNull();
		expect(screen.getByRole('button', { name: 'Show password for GitHub' })).toBeTruthy();
	});
});

describe('detail sheet', () => {
	it('opens the entry from its row and closes once it has left the list', async () => {
		const { rerender } = renderPage();

		await fireEvent.click(within(panel()).getByRole('button', { name: 'GitHub ada@example.com' }));
		expect(await screen.findByRole('heading', { name: 'GitHub' })).toBeTruthy();

		await rerender({ data: { passwords: [visa, stripe] } as never });

		await waitFor(() => expect(screen.queryByRole('heading', { name: 'GitHub' })).toBeNull());
	});
});

describe('delete flow', () => {
	it('deletes from the row trash, refreshes the list and toasts', async () => {
		fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
		renderPage();

		await fireEvent.click(within(panel()).getByRole('button', { name: 'Delete GitHub' }));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Password deleted'));
		expect(fetchMock).toHaveBeenCalledWith('/api/passwords/p1', { method: 'DELETE' });
		expect(nav.invalidateAll).toHaveBeenCalledTimes(1);
	});

	it('sends one DELETE for a double tap on the trash', async () => {
		const reply = deferred<Response>();
		fetchMock.mockReturnValue(reply.promise);
		renderPage();

		const trash = within(panel()).getByRole('button', { name: 'Delete GitHub' });
		await fireEvent.click(trash);
		await fireEvent.click(trash);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		reply.resolve(new Response(null, { status: 204 }));
		await waitFor(() => expect(toast.success).toHaveBeenCalled());
	});

	it('treats an entry that is already gone (404) as deleted', async () => {
		fetchMock.mockImplementation(async () => json({ message: 'Not found' }, 404));
		renderPage();

		await fireEvent.click(within(panel()).getByRole('button', { name: 'Delete GitHub' }));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Password deleted'));
		expect(toast.error).not.toHaveBeenCalled();
		expect(nav.invalidateAll).toHaveBeenCalledTimes(1);
	});

	it('keeps the row and re-enables the trash when the delete fails', async () => {
		fetchMock.mockImplementation(async () => json({ message: 'Server said no' }, 500));
		renderPage();

		await fireEvent.click(within(panel()).getByRole('button', { name: 'Delete GitHub' }));

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Couldn't delete the password", {
				description: 'Server said no'
			})
		);
		expect(nav.invalidateAll).not.toHaveBeenCalled();
		const trash = within(panel()).getByRole('button', { name: 'Delete GitHub' });
		expect(trash).toHaveProperty('disabled', false);
	});

	it('uses the generic description when the delete never reaches the server', async () => {
		fetchMock.mockRejectedValue('offline');
		renderPage();

		await fireEvent.click(within(panel()).getByRole('button', { name: 'Delete GitHub' }));

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Couldn't delete the password", {
				description: 'Something went wrong'
			})
		);
	});

	it('closes the detail sheet after deleting its entry from the sheet', async () => {
		fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
		const { rerender } = renderPage();
		await fireEvent.click(within(panel()).getByRole('button', { name: 'GitHub ada@example.com' }));
		await screen.findByRole('heading', { name: 'GitHub' });

		await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
		await fireEvent.click(await screen.findByRole('button', { name: /Delete password/ }));

		await rerender({ data: { passwords: [visa, stripe] } as never });
		await waitFor(() => expect(screen.queryByRole('heading', { name: 'GitHub' })).toBeNull());
		expect(toast.success).toHaveBeenCalledWith('Password deleted');
	});
});

describe('create', () => {
	it("switches to the new entry's tab after saving from another tab", async () => {
		fetchMock.mockImplementation(async () =>
			json(passwordItem({ id: 'p9', name: 'Bank', type: 'CREDIT_CARD' }), 201)
		);
		renderPage();
		await fireEvent.click(tab('App'));

		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		await screen.findByText('Saved to your vault. Only you can see it.');
		await fireEvent.input(document.getElementById('password-name') as HTMLInputElement, {
			target: { value: 'Bank' }
		});
		await fireEvent.input(document.getElementById('password-value') as HTMLInputElement, {
			target: { value: 'pw' }
		});
		await fireEvent.click(screen.getByRole('radio', { name: 'Credit card' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(tab('Credit card').getAttribute('aria-selected')).toBe('true'));
		expect(toast.success).toHaveBeenCalledWith('Password saved');
		expect(nav.invalidateAll).toHaveBeenCalledTimes(1);
	});

	it('keeps the tab when the new entry belongs to it', async () => {
		fetchMock.mockImplementation(async () => json(passwordItem({ id: 'p9', name: 'Bank' }), 201));
		renderPage();
		await fireEvent.click(tab('App'));

		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		await screen.findByText('Saved to your vault. Only you can see it.');
		await fireEvent.input(document.getElementById('password-name') as HTMLInputElement, {
			target: { value: 'Bank' }
		});
		await fireEvent.input(document.getElementById('password-value') as HTMLInputElement, {
			target: { value: 'pw' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		await waitFor(() => expect(nav.invalidateAll).toHaveBeenCalledTimes(1));
		expect(tab('App').getAttribute('aria-selected')).toBe('true');
	});
});
