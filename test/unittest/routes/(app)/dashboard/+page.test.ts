import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../src/routes/(app)/dashboard/+page.svelte';
import { matchingQueries } from '../../../helpers/dom.js';

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('#lib/auth-client.js', () => ({ authClient: auth }));
vi.mock('$app/navigation', () => nav);

const fetchMock = vi.fn(
	async () =>
		new Response(JSON.stringify({ items: [], nextCursor: null }), {
			headers: { 'content-type': 'application/json' }
		})
);
const data = { user: { id: 'u1', name: 'Ann', email: 'ann@example.com' } } as never;

beforeEach(() => {
	vi.clearAllMocks();
	fetchMock.mockClear();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	matchingQueries.clear();
	vi.unstubAllGlobals();
});

describe('dashboard on desktop', () => {
	it('greets the user with their name and email, under the home title', async () => {
		render(Page, { data });

		expect(screen.getByText('Ann')).toBeTruthy();
		expect(screen.getByText('ann@example.com')).toBeTruthy();
		await waitFor(() => expect(document.title).toBe('Home · Utilities'));
	});

	it('shows the chosen page in the breadcrumb, title and active menu item', async () => {
		render(Page, { data });

		await fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

		await waitFor(() => expect(document.title).toBe('Notifications · Utilities'));
		expect(screen.getByRole('button', { name: 'Notifications' }).getAttribute('data-active')).toBe(
			'true'
		);
		expect(screen.getByRole('button', { name: 'Home' }).getAttribute('data-active')).toBe('false');
	});

	it('loads the photo gallery when its page is chosen', async () => {
		render(Page, { data });

		await fireEvent.click(screen.getByRole('button', { name: 'Photo & video' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/media'));
		expect(await screen.findByText('No photos or videos to show')).toBeTruthy();
	});

	it('signs out and returns to sign-in', async () => {
		auth.signOut.mockResolvedValue({ error: null });
		render(Page, { data });

		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

		await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/sign-in', { invalidateAll: true }));
	});

	it('stays signed in when sign-out fails', async () => {
		auth.signOut.mockResolvedValue({ error: { message: 'x' } });
		render(Page, { data });

		await fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

		await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
		expect(nav.goto).not.toHaveBeenCalled();
	});
});

describe('dashboard on a phone', () => {
	it('closes the menu sheet after a page is chosen', async () => {
		matchingQueries.add('(max-width: 767px)');
		render(Page, { data });

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

		await waitFor(() => expect(screen.queryByRole('button', { name: 'Notifications' })).toBeNull());
		expect(document.title).toBe('Notifications · Utilities');
	});
});
