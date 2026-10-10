import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MediaGrid from '#lib/components/media/media-grid.svelte';
import type { MediaItem } from '#lib/media/types.js';
import { FakeIntersectionObserver, intersect, resize } from '../../../helpers/dom.js';
import { mediaItem } from '../../../helpers/media.js';

afterEach(cleanup);

beforeEach(() => {
	FakeIntersectionObserver.instances = [];
});

const two = (): MediaItem[] => [
	mediaItem({ id: 'a', name: 'a.jpg' }),
	mediaItem({ id: 'b', name: 'b.jpg' })
];

/** Renders the grid at a given width, and returns the element that receives that width. */
function setup(props: Partial<Parameters<typeof render<typeof MediaGrid>>[1]> = {}, width = 1000) {
	const onopen = vi.fn();
	const onloadmore = vi.fn();
	const result = render(MediaGrid, {
		items: two(),
		hasMore: false,
		loading: false,
		onopen,
		onloadmore,
		...props
	} as never);
	const root = result.container.firstElementChild as HTMLElement;
	resize(root, width);
	return { ...result, root, onopen, onloadmore };
}

const tiles = (container: HTMLElement) => [
	...container.querySelectorAll<HTMLElement>('button[title]')
];

describe('MediaGrid columns', () => {
	it('lays tiles out in four columns with 12px gaps when wide', () => {
		const { container } = setup({}, 1000);

		const second = tiles(container)[1];
		expect(second.style.left).toBe(`${(1000 - 36) / 4 + 12}px`);
	});

	it('uses three columns with 12px gaps at 600px', () => {
		const { container } = setup({}, 600);

		expect(tiles(container)[1].style.left).toBe(`${(600 - 24) / 3 + 12}px`);
	});

	it('uses three columns with 8px gaps at 500px', () => {
		const { container } = setup({}, 500);

		expect(tiles(container)[1].style.left).toBe(`${(500 - 16) / 3 + 8}px`);
	});

	it('uses two columns with 8px gaps at 300px', () => {
		const { container } = setup({}, 300);

		expect(tiles(container)[1].style.left).toBe(`${(300 - 8) / 2 + 8}px`);
	});
});

describe('MediaGrid placeholders', () => {
	it('says there is nothing to show, with idle skeletons, once an empty gallery has settled', () => {
		const { container } = setup({ items: [] }, 1000);

		expect(screen.getByText('No photos or videos to show')).toBeTruthy();
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons).toHaveLength(8);
		for (const skeleton of skeletons) expect(skeleton.classList).toContain('animate-none');
	});

	it('pulses its skeletons and hides the empty text while loading', () => {
		const { container } = setup({ items: [], loading: true }, 1000);

		expect(screen.queryByText('No photos or videos to show')).toBeNull();
		const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
		expect(skeletons.length).toBeGreaterThan(0);
		for (const skeleton of skeletons) expect(skeleton.classList).not.toContain('animate-none');
		expect(container.querySelector('[aria-hidden="true"].h-px')).toBeNull();
	});
});

describe('MediaGrid infinite scroll', () => {
	it('watches a sentinel below the grid and asks for more when it appears', () => {
		const { container, onloadmore } = setup({ hasMore: true });

		expect(container.querySelector('[aria-hidden="true"].h-px')).not.toBeNull();
		intersect(true);
		expect(onloadmore).toHaveBeenCalledTimes(1);
	});

	it('ignores the sentinel leaving the screen', () => {
		const { onloadmore } = setup({ hasMore: true });

		intersect(false);

		expect(onloadmore).not.toHaveBeenCalled();
	});

	it('stops observing when unmounted', () => {
		const { unmount } = setup({ hasMore: true });
		const observer = FakeIntersectionObserver.instances.at(-1);

		unmount();

		expect(observer?.disconnected).toBe(true);
	});

	it('starts loading 800px before the sentinel reaches the screen', () => {
		setup({ hasMore: true });

		expect(FakeIntersectionObserver.instances.at(-1)?.options?.rootMargin).toBe('800px 0px');
	});
});

describe('MediaGrid tiles', () => {
	it('shows a thumbnail for an item that has one, lazily', () => {
		const { container } = setup({ items: [mediaItem({ id: 'm1', hasThumb: true })] });

		const img = container.querySelector('img') as HTMLImageElement;
		expect(img.getAttribute('src')).toBe('/api/media/m1/thumb');
		expect(img.getAttribute('loading')).toBe('lazy');
	});

	it('falls back to a placeholder icon, named for screen readers, when the thumbnail fails', async () => {
		const { container } = setup({ items: [mediaItem({ id: 'm1', hasThumb: true })] });

		await fireEvent.error(container.querySelector('img') as HTMLImageElement);

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByText('beach.jpg')).toBeTruthy();
	});

	it('shows the placeholder straight away when there is no thumbnail', () => {
		const { container } = setup({ items: [mediaItem({ id: 'm1', hasThumb: false })] });

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByText('beach.jpg')).toBeTruthy();
	});

	it('shows the duration of a video', () => {
		setup({ items: [mediaItem({ id: 'v1', kind: 'VIDEO', duration: 75, hasThumb: false })] });

		expect(screen.getByText('1:15')).toBeTruthy();
	});

	it('shows a video badge with no duration when it is unknown', () => {
		const { container } = setup({
			items: [mediaItem({ id: 'v1', kind: 'VIDEO', duration: null, hasThumb: false })]
		});

		const badge = container.querySelector('[data-slot="badge"]');
		expect(badge).not.toBeNull();
		expect(badge?.textContent?.trim()).toBe('');
	});

	it('opens the item when its tile is clicked', async () => {
		const { onopen } = setup({ items: [mediaItem({ id: 'm1' })] });

		await fireEvent.click(screen.getByTitle('beach.jpg'));

		expect(onopen).toHaveBeenCalledWith('m1');
	});
});

describe('MediaGrid rendering', () => {
	it('renders one tile per item and lets a flush settle the layout', () => {
		const { container } = setup({}, 1000);
		flushSync();

		expect(tiles(container)).toHaveLength(2);
	});
});

describe('MediaGrid updates', () => {
	it('re-lays out when items, loading and width change', () => {
		const { container, rerender, root } = setup({ items: [], loading: true }, 1000);

		rerender({
			items: [
				mediaItem({ id: 'v1', name: 'v1.mp4', kind: 'VIDEO', hasThumb: false, duration: null }),
				mediaItem({ id: 'p1', name: 'p1.jpg', hasThumb: false }),
				mediaItem({ id: 'p2', name: 'p2.jpg', hasThumb: true })
			],
			loading: false,
			hasMore: true
		} as never);
		resize(root, 300);
		flushSync();

		expect(tiles(container)).toHaveLength(3);
		expect(container.querySelector('[data-slot="badge"]')?.textContent?.trim()).toBe('');
	});
});

describe('MediaGrid selecting', () => {
	it('toggles a tile instead of opening it, and shows which tiles are selected', async () => {
		const onopen = vi.fn();
		const ontoggle = vi.fn();
		const { container } = setup({
			items: [mediaItem({ id: 'a', name: 'a.jpg' }), mediaItem({ id: 'b', name: 'b.jpg' })],
			onopen,
			selecting: true,
			selected: new Set(['a']),
			ontoggle
		});

		const [first, second] = tiles(container);
		expect(first.getAttribute('aria-pressed')).toBe('true');
		expect(first.className).toContain('ring-primary');
		expect(second.getAttribute('aria-pressed')).toBe('false');
		expect(second.className).not.toContain('ring-primary');

		await fireEvent.click(second);
		expect(ontoggle).toHaveBeenCalledWith('b');
		expect(onopen).not.toHaveBeenCalled();
	});

	it('has a circle per tile that toggles it, visible on hover and always in select mode', async () => {
		const ontoggle = vi.fn();
		const items = [mediaItem({ id: 'a', name: 'a.jpg' }), mediaItem({ id: 'b', name: 'b.jpg' })];
		const idle = setup({ items, ontoggle });

		const circle = screen.getByRole('button', { name: 'Select a.jpg' });
		expect(circle.className).toContain('opacity-0');
		expect(circle.className).toContain('pointer-events-none');
		expect(tiles(idle.container)).toHaveLength(2);
		await fireEvent.click(circle);
		expect(ontoggle).toHaveBeenCalledWith('a');
		cleanup();

		setup({ items, selecting: true, selected: new Set(['b']), ontoggle });
		expect(screen.getByRole('button', { name: 'Select a.jpg' }).className).toContain('opacity-100');
		expect(screen.getByRole('button', { name: 'Select b.jpg' }).getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(screen.getByRole('button', { name: 'Select a.jpg' }).getAttribute('aria-pressed')).toBe(
			'false'
		);
	});

	it('marks no tile as pressed outside select mode', () => {
		const { container } = setup({ items: [mediaItem({ id: 'a', name: 'a.jpg' })] });

		expect(tiles(container)[0].hasAttribute('aria-pressed')).toBe(false);
	});
});

describe('MediaGrid press and hold', () => {
	const items = [mediaItem({ id: 'a', name: 'a.jpg' }), mediaItem({ id: 'b', name: 'b.jpg' })];

	/** A pointer event with the fields jsdom's events don't carry on their own. */
	function pointer(el: Element, type: string, { x = 0, y = 0, pointerType = 'touch' } = {}) {
		const event = new Event(type, { bubbles: true, cancelable: true });
		Object.assign(event, { clientX: x, clientY: y, pointerType });
		el.dispatchEvent(event);
	}

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('toggles the tile after half a second, and swallows the click that ends the hold', async () => {
		const onopen = vi.fn();
		const ontoggle = vi.fn();
		const { container } = setup({ items, onopen, ontoggle });
		const tile = tiles(container)[0];

		pointer(tile, 'pointerdown');
		vi.advanceTimersByTime(499);
		expect(ontoggle).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(ontoggle).toHaveBeenCalledWith('a');

		pointer(tile, 'pointerup');
		await fireEvent.click(tile);
		expect(onopen).not.toHaveBeenCalled();
		expect(ontoggle).toHaveBeenCalledOnce();

		await fireEvent.click(tile);
		expect(onopen).toHaveBeenCalledWith('a');
	});

	it('is not a hold when the finger lifts early or moves (scrolling)', () => {
		const ontoggle = vi.fn();
		const { container } = setup({ items, ontoggle });
		const tile = tiles(container)[0];

		pointer(tile, 'pointerdown');
		vi.advanceTimersByTime(300);
		pointer(tile, 'pointerup');
		vi.advanceTimersByTime(1000);

		pointer(tile, 'pointerdown', { x: 10, y: 10 });
		pointer(tile, 'pointermove', { x: 12, y: 11 });
		vi.advanceTimersByTime(300);
		pointer(tile, 'pointermove', { x: 10, y: 60 });
		vi.advanceTimersByTime(1000);

		pointer(tile, 'pointerdown');
		pointer(tile, 'pointercancel');
		vi.advanceTimersByTime(1000);

		expect(ontoggle).not.toHaveBeenCalled();
	});

	it('ignores the mouse, which uses the circle in the corner', () => {
		const ontoggle = vi.fn();
		const { container } = setup({ items, ontoggle });

		pointer(tiles(container)[0], 'pointerdown', { pointerType: 'mouse' });
		vi.advanceTimersByTime(1000);

		expect(ontoggle).not.toHaveBeenCalled();
	});

	it('keeps the context menu off after a touch, but not after a mouse press', () => {
		const { container } = setup({ items });
		const tile = tiles(container)[0];
		const contextMenu = () => {
			const event = new Event('contextmenu', { bubbles: true, cancelable: true });
			tile.dispatchEvent(event);
			return event.defaultPrevented;
		};

		pointer(tile, 'pointerdown', { pointerType: 'touch' });
		expect(contextMenu()).toBe(true);
		pointer(tile, 'pointerdown', { pointerType: 'mouse' });
		expect(contextMenu()).toBe(false);
	});

	it('cancels a pending hold when the grid goes away', () => {
		const ontoggle = vi.fn();
		const { container, unmount } = setup({ items, ontoggle });

		pointer(tiles(container)[0], 'pointerdown');
		unmount();
		vi.advanceTimersByTime(1000);

		expect(ontoggle).not.toHaveBeenCalled();
	});
});
