import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddToAlbumDialog from '#lib/components/albums/add-to-album-dialog.svelte';
import { albumSummary } from '../../../helpers/albums.js';
import { deferred } from '../../../helpers/media.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Albums come back for the list; the other calls get the given replies. */
function serve(
	albums: ReturnType<typeof albumSummary>[],
	replies: Record<string, () => Response> = {}
) {
	fetchMock.mockImplementation(async (url, init) => {
		const key = `${init?.method ?? 'GET'} ${url.split('?')[0]}`;
		if (replies[key]) return replies[key]();
		return json({ items: albums, nextCursor: null });
	});
}

const listCalls = () => fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/albums?'));

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const trip = albumSummary({ id: 'a1', name: 'Trip', count: 3 });
const home = albumSummary({ id: 'a2', name: 'Home', count: 0 });

describe('AddToAlbumDialog listing', () => {
	it('loads the album list once per open, however the dialog was opened', async () => {
		serve([trip]);
		const { rerender } = render(AddToAlbumDialog, {
			props: { open: true, mediaIds: ['m1'], onadded: vi.fn() }
		});
		await screen.findByText('Trip');
		await new Promise((r) => setTimeout(r, 0));

		expect(listCalls()).toHaveLength(1);
		expect(listCalls()[0][0]).toBe('/api/albums?limit=30');

		await rerender({ open: false, mediaIds: ['m1'] });
		await rerender({ open: true, mediaIds: ['m1'] });
		await waitFor(() => expect(listCalls()).toHaveLength(2));
	});

	it('titles itself by how many items it adds', async () => {
		serve([]);
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1', 'm2'], onadded: vi.fn() } });

		expect(await screen.findByText('Add 2 items to an album')).toBeTruthy();
	});

	it('leaves out the album being viewed', async () => {
		serve([trip, home]);
		render(AddToAlbumDialog, {
			props: { open: true, mediaIds: ['m1'], excludeAlbumId: 'a2', onadded: vi.fn() }
		});

		expect(await screen.findByText('Trip')).toBeTruthy();
		expect(screen.queryByText('Home')).toBeNull();
	});

	it('says there are no albums yet, and still offers New album', async () => {
		serve([]);
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded: vi.fn() } });

		expect(await screen.findByText('No albums yet')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'New album' })).toBeTruthy();
	});

	it('loads the next page on demand', async () => {
		fetchMock.mockImplementation(async (url) =>
			url.includes('cursor=')
				? json({ items: [home], nextCursor: null })
				: json({ items: [trip], nextCursor: 'c1' })
		);
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded: vi.fn() } });

		await fireEvent.click(await screen.findByRole('button', { name: 'Load more' }));

		expect(await screen.findByText('Home')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
	});

	it('offers to retry when the list fails to load', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 'down' }, 500));
		serve([trip]);
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded: vi.fn() } });

		await fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

		expect(await screen.findByText('Trip')).toBeTruthy();
	});
});

describe('AddToAlbumDialog adding', () => {
	it('adds the items to the chosen album, toasts the count, closes and reports it', async () => {
		serve([trip], { 'POST /api/albums/a1/items': () => json({ added: 2 }) });
		const onadded = vi.fn();
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1', 'm2'], onadded } });

		await fireEvent.click(await screen.findByRole('button', { name: /Trip/ }));

		await waitFor(() => expect(onadded).toHaveBeenCalledWith({ id: 'a1', name: 'Trip' }, 2));
		expect(toast.success).toHaveBeenCalledWith('Added 2 items to "Trip"');
		const post = fetchMock.mock.calls.find(([url]) => url === '/api/albums/a1/items');
		expect(JSON.parse(post?.[1]?.body as string)).toEqual({ mediaIds: ['m1', 'm2'] });
	});

	it('says so when every item was already in the album', async () => {
		serve([trip], { 'POST /api/albums/a1/items': () => json({ added: 0 }) });
		const onadded = vi.fn();
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded } });

		await fireEvent.click(await screen.findByRole('button', { name: /Trip/ }));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Already in "Trip"'));
		expect(onadded).toHaveBeenCalledWith({ id: 'a1', name: 'Trip' }, 0);
	});

	it('toasts a failure and stays open', async () => {
		serve([trip], {
			'POST /api/albums/a1/items': () => json({ status: 404, message: 'Not found' }, 404)
		});
		const onadded = vi.fn();
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded } });

		await fireEvent.click(await screen.findByRole('button', { name: /Trip/ }));

		await waitFor(() =>
			expect(toast.error).toHaveBeenCalledWith("Couldn't add to the album", {
				description: 'Not found'
			})
		);
		expect(onadded).not.toHaveBeenCalled();
	});

	it('disables the other albums while one is being added to', async () => {
		const pending = deferred<Response>();
		serve([trip, home], { 'POST /api/albums/a1/items': () => new Response(null) });
		fetchMock.mockImplementation(async (url, init) => {
			if (init?.method === 'POST') return pending.promise;
			return json({ items: [trip, home], nextCursor: null });
		});
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded: vi.fn() } });

		await fireEvent.click(await screen.findByRole('button', { name: /Trip/ }));

		expect((screen.getByRole('button', { name: /Home/ }) as HTMLButtonElement).disabled).toBe(true);
		pending.resolve(json({ added: 1 }));
	});

	it('creates an album and adds the items to it', async () => {
		const created = albumSummary({ id: 'n1', name: 'Summer' });
		serve([], {
			'POST /api/albums': () => json(created, 201),
			'POST /api/albums/n1/items': () => json({ added: 2 })
		});
		const onadded = vi.fn();
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1', 'm2'], onadded } });

		await fireEvent.click(await screen.findByRole('button', { name: 'New album' }));
		const input = screen.getByLabelText('Name');
		await fireEvent.input(input, { target: { value: '  Summer ' } });
		await fireEvent.submit(input.closest('form') as HTMLFormElement);

		await waitFor(() => expect(onadded).toHaveBeenCalledWith({ id: 'n1', name: 'Summer' }, 2));
		const create = fetchMock.mock.calls.find(
			([url, init]) => url === '/api/albums' && init?.method === 'POST'
		);
		expect(JSON.parse(create?.[1]?.body as string)).toEqual({ name: 'Summer' });
		expect(toast.success).toHaveBeenCalledWith('Added 2 items to "Summer"');
	});

	it('refuses a blank new album name without a request', async () => {
		serve([]);
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded: vi.fn() } });

		await fireEvent.click(await screen.findByRole('button', { name: 'New album' }));
		const input = screen.getByLabelText('Name');
		await fireEvent.input(input, { target: { value: '   ' } });
		await fireEvent.submit(input.closest('form') as HTMLFormElement);

		expect(await screen.findByText('Enter an album name')).toBeTruthy();
		expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
	});

	it('shows the server message when creating the album fails', async () => {
		serve([], {
			'POST /api/albums': () =>
				json({ status: 400, message: 'Album names can be up to 100 characters' }, 400)
		});
		render(AddToAlbumDialog, { props: { open: true, mediaIds: ['m1'], onadded: vi.fn() } });

		await fireEvent.click(await screen.findByRole('button', { name: 'New album' }));
		const input = screen.getByLabelText('Name');
		await fireEvent.input(input, { target: { value: 'Trip' } });
		await fireEvent.submit(input.closest('form') as HTMLFormElement);

		expect(await screen.findByText('Album names can be up to 100 characters')).toBeTruthy();
	});
});
