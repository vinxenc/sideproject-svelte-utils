import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploads } from '#lib/media/uploads.svelte.js';
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

/** Opens the ⋯ menu and chooses an item, the way a mouse user does. */
async function chooseFromMenu(name: string) {
	const trigger = screen.getByRole('button', { name: 'Album options' });
	await fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
	const item = await screen.findByRole('menuitem', { name });
	await fireEvent.click(item);
}

const chooseDelete = () => chooseFromMenu('Delete');

describe('Album page', () => {
	it('lists New file and Download above Delete in the menu', async () => {
		render(Page, { props: { data } });
		const trigger = screen.getByRole('button', { name: 'Album options' });
		await fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });

		const items = (await screen.findAllByRole('menuitem')).map((el) => el.textContent?.trim());

		expect(items).toEqual(['New file', 'Download', 'Delete']);
		expect(screen.getByText('File')).toBeTruthy();
	});

	it('downloads the album as a ZIP from Download', async () => {
		const links: HTMLAnchorElement[] = [];
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
			this: HTMLAnchorElement
		) {
			links.push(this);
		});
		render(Page, { props: { data } });

		await chooseFromMenu('Download');

		expect(links).toHaveLength(1);
		expect(links[0].getAttribute('href')).toBe('/api/albums/a1/download');
		expect(links[0].hasAttribute('download')).toBe(true);
		click.mockRestore();
	});

	it('opens the upload dialog from New file', async () => {
		render(Page, { props: { data } });
		expect(uploads.open).toBe(false);

		await chooseFromMenu('New file');

		expect(uploads.open).toBe(true);
		uploads.close();
	});

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
