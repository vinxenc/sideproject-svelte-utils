import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import AlbumCard from '#lib/components/albums/album-card.svelte';
import { albumPreview, albumSummary } from '../../../helpers/albums.js';

afterEach(() => {
	cleanup();
});

/** A pointerdown with a pointer type, which jsdom's events don't carry on their own. */
function pointerDown(el: Element, pointerType: string) {
	const event = new Event('pointerdown', { bubbles: true });
	Object.defineProperty(event, 'pointerType', { value: pointerType });
	el.dispatchEvent(event);
}

/** A click, returning whether its default (following the link) was prevented. */
function click(el: Element) {
	const event = new MouseEvent('click', { bubbles: true, cancelable: true });
	el.dispatchEvent(event);
	return event.defaultPrevented;
}

const card = (container: HTMLElement) => container.querySelector('a') as HTMLAnchorElement;
const frames = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLElement>('.frame')].map((el) => el.dataset.slot);

describe('AlbumCard', () => {
	it('shows the name, the count and date, and links to the album page', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ id: 'a1', name: 'Trip', count: 12 }) }
		});

		expect(screen.getByText('Trip')).toBeTruthy();
		expect(screen.getByText(/^12 items · /)).toBeTruthy();
		expect(card(container).getAttribute('href')).toBe('/photo-video/albums/a1');
	});

	it('shows the dashed tile, linked to the album, and never fans for an empty album', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ id: 'a1', previews: [], count: 0 }) }
		});

		expect(frames(container)).toEqual([]);
		expect(card(container).getAttribute('href')).toBe('/photo-video/albums/a1');
		expect(container.querySelector('.border-dashed')).toBeTruthy();
		expect(
			screen.getByText(
				'No items · ' +
					new Date('2024-05-01T10:00:00.000Z').toLocaleDateString(undefined, {
						dateStyle: 'medium'
					})
			)
		).toBeTruthy();
	});

	it('stacks the photos front, left and right, back frames first in the DOM', () => {
		const { container } = render(AlbumCard, {
			props: {
				album: albumSummary({
					previews: [
						albumPreview({ id: 'p0' }),
						albumPreview({ id: 'p1' }),
						albumPreview({ id: 'p2' })
					]
				})
			}
		});

		expect(frames(container)).toEqual(['right', 'left', 'front']);
	});

	it('shows only the frames there are for one or two photos', () => {
		const one = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview()] }) }
		});
		expect(frames(one.container)).toEqual(['front']);
		cleanup();

		const two = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview(), albumPreview({ id: 'p1' })] }) }
		});
		expect(frames(two.container)).toEqual(['left', 'front']);
	});

	it('loads the thumbnail of a photo that has one', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview({ id: 'p9' })] }) }
		});

		expect(container.querySelector('img')?.getAttribute('src')).toBe('/api/media/p9/thumb');
	});

	it('shows the placeholder, not a thumbnail request, for an item without one', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview({ hasThumb: false })] }) }
		});

		expect(container.querySelector('img')).toBeNull();
		expect(container.querySelector('.frame svg')).toBeTruthy();
	});

	it('marks a video with a play badge', () => {
		const { container } = render(AlbumCard, {
			props: {
				album: albumSummary({ previews: [albumPreview({ kind: 'VIDEO', hasThumb: false })] })
			}
		});

		expect(container.querySelector('.frame .rounded-full svg')).toBeTruthy();
	});

	it('gives a long name a title, for the truncated text to show in full', () => {
		const name = 'W'.repeat(100);
		render(AlbumCard, { props: { album: albumSummary({ name }) } });

		expect(screen.getByTitle(name).textContent).toBe(name);
	});

	it('takes the extra class on its root', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary(), class: 'w-36 shrink-0' }
		});

		expect(card(container).className).toContain('w-36 shrink-0');
	});

	it('fans on the first tap and keeps the link, and follows the link on the second tap', async () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview(), albumPreview({ id: 'p1' })] }) }
		});
		const link = card(container);

		pointerDown(link, 'touch');
		expect(click(link)).toBe(true);
		await tick();
		expect(link.dataset.fanned).toBe('true');

		expect(click(link)).toBe(false);
	});

	it('navigates on the first tap when there is nothing to fan', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview()] }) }
		});
		const link = card(container);

		pointerDown(link, 'touch');

		expect(click(link)).toBe(false);
		expect(link.dataset.fanned).toBe('false');
	});

	it('navigates straight away for a mouse click', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview(), albumPreview({ id: 'p1' })] }) }
		});
		const link = card(container);

		pointerDown(link, 'mouse');

		expect(click(link)).toBe(false);
		expect(link.dataset.fanned).toBe('false');
	});

	it('navigates on Enter from the keyboard, without fanning first', () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview(), albumPreview({ id: 'p1' })] }) }
		});

		expect(click(card(container))).toBe(false);
	});

	it('collapses when focus leaves the card', async () => {
		const { container } = render(AlbumCard, {
			props: { album: albumSummary({ previews: [albumPreview(), albumPreview({ id: 'p1' })] }) }
		});
		const link = card(container);
		pointerDown(link, 'touch');
		click(link);
		await tick();
		expect(link.dataset.fanned).toBe('true');

		await fireEvent.blur(link);

		expect(link.dataset.fanned).toBe('false');
	});
});
