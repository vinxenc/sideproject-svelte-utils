import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MediaLightbox from '#lib/components/media/media-lightbox.svelte';
import type { MediaItem } from '#lib/media/types.js';
import { mediaItem } from '../../../helpers/media.js';

afterEach(cleanup);

const a = mediaItem({
	id: 'a',
	name: 'a.jpg',
	takenAt: '2024-05-01T10:00:00.000Z',
	hasThumb: true
});
const b = mediaItem({
	id: 'b',
	name: 'b.mp4',
	kind: 'VIDEO',
	duration: 3,
	takenAt: '2024-05-02T10:00:00.000Z',
	hasThumb: true
});
const c = mediaItem({
	id: 'c',
	name: 'c.jpg',
	takenAt: '2024-05-03T10:00:00.000Z',
	hasThumb: false
});
const three: MediaItem[] = [a, b, c];

function open(openId: string | null, props: { items?: MediaItem[]; hasMore?: boolean } = {}) {
	const onloadmore = vi.fn();
	const result = render(MediaLightbox, {
		items: props.items ?? three,
		openId,
		hasMore: props.hasMore ?? false,
		onloadmore
	} as never);
	return { ...result, onloadmore };
}

const key = (k: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(window, { key: k, ...init });
const dialog = () => screen.getByRole('dialog');

describe('MediaLightbox opening', () => {
	it('is closed when no item is selected', () => {
		open(null);

		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('shows the selected photo, its name, its date and its thumbnail as a placeholder', () => {
		const { container } = open('a');

		expect(screen.getByRole('heading', { name: 'a.jpg' })).toBeTruthy();
		expect(
			screen.getByText(new Date(a.takenAt).toLocaleDateString(undefined, { dateStyle: 'medium' }))
		).toBeTruthy();
		expect(
			container.ownerDocument.querySelector('img[src="/api/media/a/original"]')
		).not.toBeNull();
		expect(container.ownerDocument.querySelector('img[src="/api/media/a/thumb"]')).not.toBeNull();
	});

	it('offers Next but not Previous on the first item', () => {
		open('a');

		expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
		expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
	});
});

describe('MediaLightbox keyboard navigation', () => {
	it('moves forward to a video with a poster, then to an unthumbnailed photo', async () => {
		open('a');

		await key('ArrowRight');
		const video = document.querySelector('video') as HTMLVideoElement;
		expect(video.getAttribute('poster')).toBe('/api/media/b/thumb');
		expect(video.getAttribute('src')).toBe('/api/media/b/original');
		expect(screen.getByRole('button', { name: 'Previous' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();

		await key('ArrowRight');
		expect(document.querySelector('img[src="/api/media/c/thumb"]')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
	});

	it('stays on the last item, and moves back on ArrowLeft', async () => {
		open('a');
		await key('ArrowRight');
		await key('ArrowRight');

		await key('ArrowRight');
		expect(screen.getByRole('heading', { name: 'c.jpg' })).toBeTruthy();

		await key('ArrowLeft');
		expect(screen.getByRole('heading', { name: 'b.mp4' })).toBeTruthy();
	});

	it.each([{ altKey: true }, { ctrlKey: true }, { metaKey: true }])(
		'leaves a modified arrow %o to the browser',
		async (modifier) => {
			open('a');

			await key('ArrowRight', modifier);

			expect(screen.getByRole('heading', { name: 'a.jpg' })).toBeTruthy();
		}
	);

	it('leaves arrows pressed inside a video to the video, which seeks with them', async () => {
		open('b');
		const video = document.querySelector('video') as HTMLVideoElement;

		await fireEvent.keyDown(video, { key: 'ArrowRight' });

		expect(screen.getByRole('heading', { name: 'b.mp4' })).toBeTruthy();
	});

	it('moves with the Next and Previous buttons', async () => {
		open('b');

		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(screen.getByRole('heading', { name: 'c.jpg' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
		expect(screen.getByRole('heading', { name: 'b.mp4' })).toBeTruthy();
	});

	it('asks for the next page as the viewer nears the end of the loaded items', async () => {
		// Ten loaded items: the prefetch fires when the viewer reaches index 5 (within the last five).
		const many = Array.from({ length: 10 }, (_, i) =>
			mediaItem({ id: `i${i}`, name: `i${i}.jpg` })
		);
		const { onloadmore } = open('i0', { items: many, hasMore: true });

		for (let i = 0; i < 4; i++) await key('ArrowRight');
		expect(screen.getByRole('heading', { name: 'i4.jpg' })).toBeTruthy();
		expect(onloadmore).not.toHaveBeenCalled();

		await key('ArrowRight');
		expect(onloadmore).toHaveBeenCalledTimes(1);
	});

	it('never asks for more once every page has loaded', async () => {
		const many = Array.from({ length: 10 }, (_, i) =>
			mediaItem({ id: `i${i}`, name: `i${i}.jpg` })
		);
		const { onloadmore } = open('i0', { items: many, hasMore: false });

		for (let i = 0; i < 9; i++) await key('ArrowRight');

		expect(onloadmore).not.toHaveBeenCalled();
	});
});

describe('MediaLightbox swipe', () => {
	const surface = () => dialog().querySelector('[role="presentation"]') as HTMLElement;

	it('moves on after a clear swipe to the left, and back after one to the right', async () => {
		open('a');
		await fireEvent.pointerDown(surface(), { clientX: 300, clientY: 0 });
		await fireEvent.pointerUp(surface(), { clientX: 200, clientY: 0 });
		expect(screen.getByRole('heading', { name: 'b.mp4' })).toBeTruthy();

		await fireEvent.pointerDown(surface(), { clientX: 200, clientY: 0 });
		await fireEvent.pointerUp(surface(), { clientX: 300, clientY: 0 });
		expect(screen.getByRole('heading', { name: 'a.jpg' })).toBeTruthy();
	});

	it('ignores a short swipe', async () => {
		open('a');
		await fireEvent.pointerDown(surface(), { clientX: 100, clientY: 0 });
		await fireEvent.pointerUp(surface(), { clientX: 130, clientY: 0 });

		expect(screen.getByRole('heading', { name: 'a.jpg' })).toBeTruthy();
	});

	it('ignores a mostly vertical gesture', async () => {
		open('a');
		await fireEvent.pointerDown(surface(), { clientX: 300, clientY: 0 });
		await fireEvent.pointerUp(surface(), { clientX: 200, clientY: 90 });

		expect(screen.getByRole('heading', { name: 'a.jpg' })).toBeTruthy();
	});

	it('forgets a swipe that the pointer cancelled', async () => {
		open('a');
		await fireEvent.pointerDown(surface(), { clientX: 300, clientY: 0 });
		await fireEvent.pointerCancel(surface());
		await fireEvent.pointerUp(surface(), { clientX: 200, clientY: 0 });

		expect(screen.getByRole('heading', { name: 'a.jpg' })).toBeTruthy();
	});

	it('does not start a swipe on a video, which has its own seek bar', async () => {
		open('b');
		const video = document.querySelector('video') as HTMLVideoElement;
		await fireEvent.pointerDown(video, { clientX: 300, clientY: 0 });
		await fireEvent.pointerUp(surface(), { clientX: 200, clientY: 0 });

		expect(screen.getByRole('heading', { name: 'b.mp4' })).toBeTruthy();
	});
});

describe('MediaLightbox original that cannot be shown', () => {
	it('explains the problem and offers the original in a new tab', async () => {
		open('a');
		const img = document.querySelector('img[src="/api/media/a/original"]') as HTMLImageElement;

		await fireEvent.error(img);

		expect(screen.getByText("This browser can't show the original")).toBeTruthy();
		const link = screen.getByRole('link', { name: 'Open original' });
		expect(link.getAttribute('href')).toBe('/api/media/a/original');
	});
});

describe('MediaLightbox closing', () => {
	it('closes on Escape, and then ignores the arrow keys', async () => {
		open('a');

		await fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
		await key('ArrowRight');
		expect(screen.queryByRole('dialog')).toBeNull();
	});
});

describe('MediaLightbox edge cases', () => {
	it('shows a video without a poster when it has no thumbnail', () => {
		const bare = mediaItem({
			id: 'v',
			name: 'v.mp4',
			kind: 'VIDEO',
			hasThumb: false,
			duration: null
		});
		open('v', { items: [bare] });

		const video = document.querySelector('video') as HTMLVideoElement;
		expect(video.hasAttribute('poster')).toBe(false);
		expect(video.getAttribute('src')).toBe('/api/media/v/original');
	});

	it('stays empty when the selected item is no longer in the list', () => {
		open('gone');

		expect(screen.getByRole('dialog')).toBeTruthy();
		expect(screen.queryByRole('heading')).toBeNull();
	});
});
