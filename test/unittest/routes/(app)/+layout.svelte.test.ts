import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from '../../../../src/routes/(app)/+layout.svelte';
import { matchingQueries } from '../../helpers/dom.js';

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
// A plain object: each test sets the page before rendering, so no reactive updates are needed.
const app = vi.hoisted(() => ({
	page: {
		route: { id: '/(app)/dashboard' } as { id: string | null },
		url: new URL('http://localhost/dashboard'),
		data: {} as Record<string, unknown>
	}
}));
vi.mock('#lib/auth-client.js', () => ({ authClient: auth }));
vi.mock('$app/navigation', () => nav);
vi.mock('$app/state', () => app);

const user = { id: 'u1', name: 'Ann', email: 'ann@example.com' };
const data = { user } as never;
const children = createRawSnippet(() => ({ render: () => '<p>child content</p>' }));

function at(routeId: string | null, href: string, data: Record<string, unknown> = {}) {
	app.page.route.id = routeId;
	app.page.url = new URL(`http://localhost${href}`);
	app.page.data = data;
}

/** The sidebar's link to a section, by its visible name. (Breadcrumb pages also have role link, so not by role.) */
function navLink(name: string) {
	return [...document.querySelectorAll<HTMLAnchorElement>('[data-sidebar="menu-button"]')].find(
		(a) => a.textContent?.trim() === name
	);
}

/** The breadcrumb crumb with this text: a link, or the current page. */
function crumb(name: string) {
	return [
		...document.querySelectorAll<HTMLElement>(
			'[data-slot="breadcrumb-link"], [data-slot="breadcrumb-page"]'
		)
	].find((el) => el.textContent?.trim() === name);
}

beforeEach(() => {
	vi.clearAllMocks();
	at('/(app)/dashboard', '/dashboard');
});

afterEach(() => {
	cleanup();
	matchingQueries.clear();
});

describe('app layout on desktop', () => {
	it('greets the user with their name and email and shows the page it wraps', async () => {
		render(Layout, { props: { data, children } });

		expect(screen.getByText('Ann')).toBeTruthy();
		expect(screen.getByText('ann@example.com')).toBeTruthy();
		expect(screen.getByText('child content')).toBeTruthy();
		await waitFor(() => expect(document.title).toBe('Home · Utilities'));
	});

	it('titles the page by its section and marks that section as active', async () => {
		at('/(app)/dashboard', '/dashboard?section=notifications');
		render(Layout, { props: { data, children } });

		await waitFor(() => expect(document.title).toBe('Notifications · Utilities'));
		expect(navLink('Notifications')?.getAttribute('data-active')).toBe('true');
		expect(navLink('Home')?.getAttribute('data-active')).toBe('false');
	});

	it('links each section to its page, Photo & video to its own', () => {
		render(Layout, { props: { data, children } });

		expect(navLink('Home')?.getAttribute('href')).toBe('/dashboard');
		expect(navLink('Photo & video')?.getAttribute('href')).toBe('/photo-video');
		expect(navLink('Advanced')?.getAttribute('href')).toBe('/dashboard?section=advanced');
	});

	it('highlights Photo & video on its pages and titles them, with no Settings crumb', async () => {
		at('/(app)/photo-video', '/photo-video');
		render(Layout, { props: { data, children } });

		await waitFor(() => expect(document.title).toBe('Photo & video · Utilities'));
		expect(navLink('Photo & video')?.getAttribute('data-active')).toBe('true');
		expect(crumb('Photo & video')?.getAttribute('data-slot')).toBe('breadcrumb-page');
		expect(screen.queryByText('Settings')).toBeNull();
	});

	it('shows the album list breadcrumb, with Photo & video linking back', async () => {
		at('/(app)/photo-video/albums', '/photo-video/albums');
		render(Layout, { props: { data, children } });

		await waitFor(() => expect(document.title).toBe('Album · Utilities'));
		expect(crumb('Photo & video')?.getAttribute('href')).toBe('/photo-video');
		expect(crumb('Album')?.getAttribute('data-slot')).toBe('breadcrumb-page');
	});

	it('shows the album name last, with Album linking to the list', async () => {
		at('/(app)/photo-video/albums/[id]', '/photo-video/albums/a1', { album: { name: 'Trip' } });
		render(Layout, { props: { data, children } });

		await waitFor(() => expect(document.title).toBe('Trip · Utilities'));
		expect(crumb('Album')?.getAttribute('href')).toBe('/photo-video/albums');
		expect(crumb('Trip')?.getAttribute('data-slot')).toBe('breadcrumb-page');
	});

	it('falls back to Album before the album data is known', async () => {
		at('/(app)/photo-video/albums/[id]', '/photo-video/albums/a1');
		render(Layout, { props: { data, children } });

		await waitFor(() => expect(document.title).toBe('Album · Utilities'));
	});

	it('signs out and returns to sign-in', async () => {
		auth.signOut.mockResolvedValue({ error: null });
		render(Layout, { props: { data, children } });

		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

		await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/sign-in', { invalidateAll: true }));
	});

	it('stays signed in when sign-out fails', async () => {
		auth.signOut.mockResolvedValue({ error: { message: 'x' } });
		render(Layout, { props: { data, children } });

		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

		await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
		expect(nav.goto).not.toHaveBeenCalled();
	});
});

describe('app layout on a phone', () => {
	it('closes the menu sheet after a section is chosen', async () => {
		matchingQueries.add('(max-width: 767px)');
		render(Layout, { props: { data, children } });

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
		await fireEvent.click(await waitFor(() => navLink('Notifications') as HTMLElement));

		await waitFor(() => expect(navLink('Notifications')).toBeUndefined());
		expect(document.title).toBe('Home · Utilities');
	});

	it('hides all but the last two crumbs on a phone', () => {
		matchingQueries.add('(max-width: 767px)');
		at('/(app)/photo-video/albums/[id]', '/photo-video/albums/a1', { album: { name: 'Trip' } });
		render(Layout, { props: { data, children } });

		expect(crumb('Photo & video')?.closest('li')?.className).toContain('hidden');
		expect(crumb('Album')?.closest('li')?.className).not.toContain('hidden');
	});
});
