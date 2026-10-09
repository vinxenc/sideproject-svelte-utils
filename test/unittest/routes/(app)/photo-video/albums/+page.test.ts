import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../../src/routes/(app)/photo-video/albums/+page.svelte';
import { FakeIntersectionObserver, intersect } from '../../../../helpers/dom.js';
import { albumSummary } from '../../../../helpers/albums.js';
import { deferred } from '../../../../helpers/media.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), dismiss: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
	FakeIntersectionObserver.instances = [];
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('Albums page', () => {
	it('loads the first page of albums, 30 at a time, and shows each as a card', async () => {
		fetchMock.mockResolvedValue(
			json({
				items: [albumSummary({ id: 'a1', name: 'Trip' }), albumSummary({ id: 'a2', name: 'Home' })],
				nextCursor: null
			})
		);
		render(Page);

		expect(await screen.findByText('Trip')).toBeTruthy();
		expect(screen.getByText('Home')).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith('/api/albums?limit=30', {});
	});

	it('shows skeleton cards while the first page loads', () => {
		fetchMock.mockReturnValue(deferred<Response>().promise);
		const { container } = render(Page);

		expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(10);
	});

	it('shows an empty state whose New album button opens the create dialog', async () => {
		fetchMock.mockResolvedValue(json({ items: [], nextCursor: null }));
		render(Page);

		expect(await screen.findByText('No albums yet')).toBeTruthy();
		const buttons = screen.getAllByRole('button', { name: 'New album' });
		await fireEvent.click(buttons[buttons.length - 1]);

		expect(await screen.findByRole('dialog')).toBeTruthy();
	});

	it('reports a failed page as a sticky toast whose Try again loads it again', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 'down' }, 500));
		fetchMock.mockResolvedValueOnce(
			json({ items: [albumSummary({ name: 'Trip' })], nextCursor: null })
		);
		render(Page);

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Couldn't load your albums", {
			id: 'albums-load-error',
			description: 'down',
			duration: Infinity,
			action: expect.objectContaining({ label: 'Try again' })
		});
		const action = toast.error.mock.calls[0][1].action as { onClick: () => void };
		action.onClick();

		expect(await screen.findByText('Trip')).toBeTruthy();
		expect(toast.dismiss).toHaveBeenCalledWith('albums-load-error');
	});

	it('loads the next page when the end of the list scrolls into view', async () => {
		fetchMock.mockImplementation(async (url) =>
			url.includes('cursor=')
				? json({ items: [albumSummary({ id: 'a2', name: 'Home' })], nextCursor: null })
				: json({ items: [albumSummary({ id: 'a1', name: 'Trip' })], nextCursor: 'c1' })
		);
		render(Page);
		await screen.findByText('Trip');

		intersect();

		expect(await screen.findByText('Home')).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith('/api/albums?limit=30&cursor=c1', {});
	});

	it('opens the new album after creating it from the header', async () => {
		fetchMock.mockImplementation(async (_url, init) =>
			init?.method === 'POST'
				? json(albumSummary({ id: 'n1', name: 'Summer' }), 201)
				: json({ items: [], nextCursor: null })
		);
		render(Page);
		await screen.findByText('No albums yet');
		// The header's icon button comes first; it opens the same dialog.
		await fireEvent.click(screen.getAllByRole('button', { name: 'New album' })[0]);
		const input = await screen.findByLabelText('Name');
		await fireEvent.input(input, { target: { value: 'Summer' } });
		await fireEvent.submit(input.closest('form') as HTMLFormElement);

		await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/photo-video/albums/n1'));
	});

	it('clears the error toast when the page is left', async () => {
		fetchMock.mockResolvedValue(json({ message: 'down' }, 500));
		const { unmount } = render(Page);
		await waitFor(() => expect(toast.error).toHaveBeenCalled());

		unmount();

		expect(toast.dismiss).toHaveBeenCalledWith('albums-load-error');
	});
});
