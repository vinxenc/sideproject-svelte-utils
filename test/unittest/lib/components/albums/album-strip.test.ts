import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AlbumStrip from '#lib/components/albums/album-strip.svelte';
import { albumSummary } from '../../../helpers/albums.js';
import { deferred } from '../../../helpers/media.js';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Serves the albums page, one album per name. */
function serveAlbums(...names: string[]) {
	fetchMock.mockImplementation(async () =>
		json({ items: names.map((name, i) => albumSummary({ id: `a${i}`, name })), nextCursor: null })
	);
}

/** The scroller, with a scrollable width the fake layout can change. */
function scroller() {
	return document.querySelector<HTMLDivElement>('.snap-x') as HTMLDivElement;
}

/** Gives the scroller a layout: `scrollWidth` wider than `clientWidth` means there is more to scroll. */
function layout(el: HTMLElement, { scrollLeft = 0, clientWidth = 200, scrollWidth = 600 }) {
	Object.defineProperty(el, 'scrollLeft', {
		configurable: true,
		writable: true,
		value: scrollLeft
	});
	Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
	Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
}

/** A pointer event with the fields jsdom's events don't carry on their own. */
function pointer(
	el: Element,
	type: string,
	{ x = 0, pointerType = 'mouse', button = 0, buttons = 1 } = {}
) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { clientX: x, pointerType, button, buttons, pointerId: 1 });
	el.dispatchEvent(event);
}

/** A click, returning whether its default (following the link) was prevented. */
function click(el: Element) {
	const event = new MouseEvent('click', { bubbles: true, cancelable: true });
	el.dispatchEvent(event);
	return event.defaultPrevented;
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
	HTMLElement.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('AlbumStrip loading', () => {
	it('shows skeleton tiles until the first load arrives, then the albums and the show-all tile', async () => {
		const page = deferred<Response>();
		fetchMock.mockReturnValueOnce(page.promise);
		const { container } = render(AlbumStrip);

		expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
		page.resolve(json({ items: [albumSummary({ id: 'a1', name: 'Trip' })], nextCursor: null }));

		expect(await screen.findByText('Trip')).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledWith('/api/albums?limit=5', {});
		expect(screen.getByRole('link', { name: 'All albums' }).getAttribute('href')).toBe(
			'/photo-video/albums'
		);
	});

	it('shows at most five albums and always the show-all tile', async () => {
		serveAlbums('one', 'two', 'three', 'four', 'five');
		render(AlbumStrip);

		await screen.findByText('five');
		expect(screen.getByRole('link', { name: 'All albums' })).toBeTruthy();
	});

	it('shows a New album tile that opens the create dialog when there are no albums', async () => {
		serveAlbums();
		render(AlbumStrip);

		await fireEvent.click(await screen.findByRole('button', { name: 'New album' }));

		expect(await screen.findByRole('dialog')).toBeTruthy();
	});

	it('shows an error with a retry that loads the albums again', async () => {
		fetchMock.mockResolvedValueOnce(json({ message: 'down' }, 500));
		serveAlbums('Trip');
		render(AlbumStrip);

		expect(await screen.findByText("Couldn't load your albums.")).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

		expect(await screen.findByText('Trip')).toBeTruthy();
	});

	it('refetches exactly once when the refresh key changes', async () => {
		serveAlbums('Trip');
		const { rerender } = render(AlbumStrip, { props: { refreshKey: 0 } });
		await screen.findByText('Trip');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await rerender({ refreshKey: 1 });

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		await new Promise((r) => setTimeout(r, 0));
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('keeps the tiles on screen while a refresh is loading', async () => {
		serveAlbums('Trip');
		const { rerender } = render(AlbumStrip, { props: { refreshKey: 0 } });
		await screen.findByText('Trip');
		const pending = deferred<Response>();
		fetchMock.mockReturnValueOnce(pending.promise);

		await rerender({ refreshKey: 1 });

		expect(screen.getByText('Trip')).toBeTruthy();
		pending.resolve(json({ items: [], nextCursor: null }));
	});

	it('shows the error in place of the tiles when a refresh fails', async () => {
		serveAlbums('Trip');
		const { rerender } = render(AlbumStrip, { props: { refreshKey: 0 } });
		await screen.findByText('Trip');
		fetchMock.mockResolvedValueOnce(json({ message: 'down' }, 500));

		await rerender({ refreshKey: 1 });

		expect(await screen.findByText("Couldn't load your albums.")).toBeTruthy();
	});
});

describe('AlbumStrip dragging', () => {
	it('has no scroll buttons', async () => {
		serveAlbums('Trip');
		render(AlbumStrip);
		await screen.findByText('Trip');

		expect(screen.queryByRole('button', { name: 'Scroll albums left' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Scroll albums right' })).toBeNull();
	});

	it('scrolls with the mouse held down, and lets the snap back in on release', async () => {
		serveAlbums('Trip');
		render(AlbumStrip);
		await screen.findByText('Trip');
		layout(scroller(), { scrollLeft: 100 });

		pointer(scroller(), 'pointerdown', { x: 200 });
		pointer(scroller(), 'pointermove', { x: 150 });
		await tick();
		expect(scroller().scrollLeft).toBe(150);
		expect(scroller().style.scrollSnapType).toBe('none');
		expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledOnce();

		pointer(scroller(), 'pointermove', { x: 260 });
		expect(scroller().scrollLeft).toBe(40);

		pointer(scroller(), 'pointerup', { x: 260 });
		await tick();
		expect(scroller().style.scrollSnapType).toBe('');
	});

	it('does not scroll for touch or a non-primary button', async () => {
		serveAlbums('Trip');
		render(AlbumStrip);
		await screen.findByText('Trip');
		layout(scroller(), { scrollLeft: 100 });

		pointer(scroller(), 'pointerdown', { x: 200, pointerType: 'touch' });
		pointer(scroller(), 'pointermove', { x: 100, pointerType: 'touch' });
		pointer(scroller(), 'pointerdown', { x: 200, button: 2 });
		pointer(scroller(), 'pointermove', { x: 100 });

		expect(scroller().scrollLeft).toBe(100);
	});

	it('ignores a movement under the threshold, so a click still opens the album', async () => {
		serveAlbums('Trip');
		render(AlbumStrip);
		const link = (await screen.findByText('Trip')).closest('a') as HTMLAnchorElement;
		layout(scroller(), { scrollLeft: 100 });

		pointer(scroller(), 'pointerdown', { x: 200 });
		pointer(scroller(), 'pointermove', { x: 197 });
		pointer(scroller(), 'pointerup', { x: 197 });

		expect(scroller().scrollLeft).toBe(100);
		expect(click(link)).toBe(false);
	});

	it('swallows the click that ends a drag, and stops dragging when the button is up', async () => {
		serveAlbums('Trip');
		render(AlbumStrip);
		const link = (await screen.findByText('Trip')).closest('a') as HTMLAnchorElement;
		layout(scroller(), { scrollLeft: 100 });

		pointer(scroller(), 'pointerdown', { x: 200 });
		pointer(scroller(), 'pointermove', { x: 100 });
		pointer(scroller(), 'pointerup', { x: 100 });
		expect(click(link)).toBe(true);

		await new Promise((resolve) => setTimeout(resolve));
		expect(click(link)).toBe(false);

		pointer(scroller(), 'pointerdown', { x: 200 });
		pointer(scroller(), 'pointermove', { x: 150, buttons: 0 });
		expect(scroller().scrollLeft).toBe(200);
	});
});

describe('AlbumStrip creating', () => {
	it('navigates to the new album after it is created', async () => {
		serveAlbums();
		render(AlbumStrip);
		await fireEvent.click(await screen.findByRole('button', { name: 'New album' }));
		fetchMock.mockImplementation(async (_url, init) =>
			init?.method === 'POST'
				? json(albumSummary({ id: 'new1', name: 'Trip' }), 201)
				: json({ items: [], nextCursor: null })
		);
		const input = screen.getByLabelText('Name');
		await fireEvent.input(input, { target: { value: 'Trip' } });
		await fireEvent.submit(input.closest('form') as HTMLFormElement);

		await waitFor(() => expect(nav.goto).toHaveBeenCalledWith('/photo-video/albums/new1'));
	});
});
