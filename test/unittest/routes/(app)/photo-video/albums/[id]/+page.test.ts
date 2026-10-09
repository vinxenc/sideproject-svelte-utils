import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../../../src/routes/(app)/photo-video/albums/[id]/+page.svelte';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const data = {
	album: { id: 'a1', name: 'Trip', count: 0, createdAt: '', updatedAt: '', previews: [] },
	user: { id: 'u1', name: 'Ann', email: 'ann@example.com' }
} as never;

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockImplementation(async (url, init) =>
		init?.method === 'DELETE'
			? new Response(null, { status: 204 })
			: json({ items: [], nextCursor: null })
	);
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/** Opens the ⋯ menu and chooses Delete album, the way a mouse user does. */
async function chooseDelete() {
	const trigger = screen.getByRole('button', { name: 'Album options' });
	await fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
	const item = await screen.findByRole('menuitem', { name: 'Delete album' });
	await fireEvent.click(item);
}

describe('Album page', () => {
	it('shows the album name as the title and loads its media', async () => {
		render(Page, { props: { data } });

		expect(screen.getByRole('heading', { name: 'Trip' })).toBeTruthy();
		await waitFor(() =>
			expect(fetchMock.mock.calls.map(([url]) => url)).toContain('/api/albums/a1/media')
		);
	});

	it('says the album is empty once its first page has loaded with nothing in it', async () => {
		render(Page, { props: { data } });

		expect(await screen.findByText('This album is empty')).toBeTruthy();
	});

	it('asks before deleting, and says the photos are kept', async () => {
		render(Page, { props: { data } });

		await chooseDelete();

		expect(await screen.findByText('Delete "Trip"?')).toBeTruthy();
		expect(
			screen.getByText('The album is deleted. Its photos and videos are kept in your library.')
		).toBeTruthy();
	});

	it('deletes the album, toasts that the photos are still there, and goes to the album list', async () => {
		render(Page, { props: { data } });
		await chooseDelete();

		await fireEvent.click(await screen.findByRole('button', { name: 'Delete album' }));

		await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/photo-video/albums'));
		expect(fetchMock).toHaveBeenCalledWith('/api/albums/a1', { method: 'DELETE' });
		expect(toast.success).toHaveBeenCalledWith('Album deleted', {
			description: 'Its photos and videos are still in your library.'
		});
	});

	it('toasts a failed delete and stays where it is', async () => {
		fetchMock.mockImplementation(async (_url, init) =>
			init?.method === 'DELETE'
				? json({ status: 404, message: 'Not found' }, 404)
				: json({ items: [], nextCursor: null })
		);
		render(Page, { props: { data } });
		await chooseDelete();

		await fireEvent.click(await screen.findByRole('button', { name: 'Delete album' }));

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Couldn't delete the album", {
				description: 'Not found'
			})
		);
		expect(nav.goto).not.toHaveBeenCalled();
	});
});
