import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { toast } from 'svelte-sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Gallery from '#lib/components/media/gallery.svelte';
import { uploads } from '#lib/media/uploads.svelte.js';
import type { MediaItem, MediaPage } from '#lib/media/types.js';
import { FakeIntersectionObserver, intersect } from '../../../helpers/dom.js';
import { deferred, mediaItem } from '../../../helpers/media.js';

vi.mock('svelte-sonner', () => ({
	toast: { error: vi.fn(), dismiss: vi.fn(), success: vi.fn(), info: vi.fn() }
}));

const LOAD_ERROR = 'gallery-load-error';
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const a = mediaItem({ id: 'a', name: 'a.jpg', takenAt: '2024-05-03T10:00:00.000Z' });
const b = mediaItem({ id: 'b', name: 'b.jpg', takenAt: '2024-05-02T10:00:00.000Z' });
const c = mediaItem({ id: 'c', name: 'c.jpg', takenAt: '2024-05-01T10:00:00.000Z' });

const fetchMock = vi.fn<(url: string) => Promise<Response>>();

/** Serves each URL from `pages`, keyed by the cursor it was asked with ('' for the first page). */
function servePages(pages: Record<string, MediaPage | Response | Promise<Response>>) {
	fetchMock.mockImplementation(async (url: string) => {
		const cursor = new URL(url, 'http://localhost').searchParams.get('cursor') ?? '';
		const page = pages[cursor];
		if (!page) throw new Error(`no page for ${url}`);
		return page instanceof Response ? page : page instanceof Promise ? page : json(page);
	});
}

const tileNames = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLElement>('button[title]')].map((el) => el.title);

/** Lets the first page land, returning the component's `insert` for the upload hook. */
async function renderGallery(firstTitle = 'a.jpg') {
	const attach = vi.spyOn(uploads, 'attach');
	const result = render(Gallery);
	await screen.findByTitle(firstTitle);
	const insert = attach.mock.calls[0][0] as (item: MediaItem) => void;
	return { ...result, insert };
}

beforeEach(() => {
	FakeIntersectionObserver.instances = [];
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	uploads.close();
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('Gallery paging', () => {
	it('loads the first page and shows every tile', async () => {
		servePages({ '': { items: [a, b], nextCursor: 'c1' } });

		const { container } = await renderGallery();

		expect(fetchMock).toHaveBeenCalledWith('/api/media');
		expect(tileNames(container)).toEqual(['a.jpg', 'b.jpg']);
	});

	it('loads the next page when the end of the grid comes into view', async () => {
		servePages({
			'': { items: [a, b], nextCursor: 'c1' },
			c1: { items: [b, c], nextCursor: null }
		});
		const { container } = await renderGallery();

		intersect();

		await waitFor(() => expect(tileNames(container)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']));
		expect(fetchMock).toHaveBeenLastCalledWith('/api/media?cursor=c1');
		flushSync();
		intersect();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('asks for one page at a time, however often the end is reached', async () => {
		const next = deferred<Response>();
		servePages({ '': { items: [a], nextCursor: 'c1' }, c1: next.promise });
		await renderGallery();

		intersect();
		intersect();

		expect(fetchMock).toHaveBeenCalledTimes(2);
		next.resolve(json({ items: [], nextCursor: null }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	});
});

describe('Gallery load errors', () => {
	it('reports a failed page as a sticky toast with a retry action', async () => {
		fetchMock.mockResolvedValueOnce(json({}, 500));

		render(Gallery);

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(toast.error).toHaveBeenCalledWith("Couldn't load your photos and videos", {
			id: LOAD_ERROR,
			description: 'The server answered 500',
			duration: Infinity,
			action: { label: 'Try again', onClick: expect.any(Function) }
		});
	});

	it('retries from the toast, and clears the toast once a page arrives', async () => {
		fetchMock.mockResolvedValueOnce(json({}, 500));
		render(Gallery);
		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		servePages({ '': { items: [a], nextCursor: null } });
		const { action } = vi.mocked(toast.error).mock.calls[0][1] as unknown as {
			action: { onClick: () => void };
		};

		action.onClick();

		await screen.findByTitle('a.jpg');
		expect(toast.dismiss).toHaveBeenCalledWith(LOAD_ERROR);
	});

	it('describes a network failure with a generic message', async () => {
		fetchMock.mockRejectedValueOnce('offline');

		render(Gallery);

		await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
		expect(vi.mocked(toast.error).mock.calls[0][1]).toMatchObject({
			description: 'Something went wrong'
		});
	});

	it('clears the load error toast when the gallery is left', async () => {
		servePages({ '': { items: [], nextCursor: null } });
		const { unmount } = render(Gallery);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());

		unmount();

		expect(toast.dismiss).toHaveBeenCalledWith(LOAD_ERROR);
	});
});

describe('Gallery inserting uploads', () => {
	it('ignores an upload that is already in the list', async () => {
		servePages({ '': { items: [a, b], nextCursor: 'c1' } });
		const { container, insert } = await renderGallery();

		insert(a);
		flushSync();

		expect(tileNames(container)).toEqual(['a.jpg', 'b.jpg']);
	});

	it('holds back an upload older than the last loaded item while more pages remain', async () => {
		servePages({ '': { items: [a, b], nextCursor: 'c1' } });
		const { container, insert } = await renderGallery();

		insert(c);
		flushSync();

		expect(tileNames(container)).toEqual(['a.jpg', 'b.jpg']);
	});

	it('shows an upload newer than the last loaded item, in its place', async () => {
		servePages({ '': { items: [a, b], nextCursor: 'c1' } });
		const { container, insert } = await renderGallery();
		const fresh = mediaItem({ id: 'z', name: 'z.jpg', takenAt: '2024-06-01T10:00:00.000Z' });

		insert(fresh);
		flushSync();

		expect(tileNames(container)).toEqual(['z.jpg', 'a.jpg', 'b.jpg']);
	});

	it('shows an older upload once every page has loaded', async () => {
		servePages({ '': { items: [a, b], nextCursor: null } });
		const { container, insert } = await renderGallery();

		insert(c);
		flushSync();

		expect(tileNames(container)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
	});

	it('orders uploads taken at the same moment by id, newest id first', async () => {
		const same = '2024-05-03T10:00:00.000Z';
		servePages({
			'': { items: [mediaItem({ id: 'm5', name: 'm5.jpg', takenAt: same })], nextCursor: null }
		});
		const { container, insert } = await renderGallery('m5.jpg');

		insert(mediaItem({ id: 'm9', name: 'm9.jpg', takenAt: same }));
		insert(mediaItem({ id: 'm1', name: 'm1.jpg', takenAt: same }));
		flushSync();

		expect(tileNames(container)).toEqual(['m9.jpg', 'm5.jpg', 'm1.jpg']);
	});
});

describe('Gallery lightbox', () => {
	it('opens the lightbox on the tile that was clicked', async () => {
		servePages({ '': { items: [a, b], nextCursor: null } });
		await renderGallery();

		await fireEvent.click(screen.getByTitle('b.jpg'));

		expect(await screen.findByRole('heading', { name: 'b.jpg' })).toBeTruthy();
	});
});

describe('Gallery paging from the lightbox', () => {
	it('asks for the next page when the viewer pages near the end of the loaded items', async () => {
		const six = Array.from({ length: 6 }, (_, i) =>
			mediaItem({ id: `s${i}`, name: `s${i}.jpg`, takenAt: `2024-05-0${6 - i}T10:00:00.000Z` })
		);
		servePages({
			'': { items: six, nextCursor: 'c1' },
			c1: { items: [], nextCursor: null }
		});
		await renderGallery('s0.jpg');
		await fireEvent.click(screen.getByTitle('s0.jpg'));
		await screen.findByRole('heading', { name: 's0.jpg' });

		await fireEvent.keyDown(window, { key: 'ArrowRight' });

		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/media?cursor=c1'));
	});
});
