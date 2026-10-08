import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import MediaImage from '#lib/components/media/media-image.svelte';

afterEach(cleanup);

const fallback = createRawSnippet(() => ({ render: () => '<p>Fallback</p>' }));

describe('MediaImage', () => {
	it('loads eagerly under a skeleton and reports itself busy', () => {
		const { container } = render(MediaImage, { src: '/a.jpg', alt: 'A' });

		const main = container.querySelector('img') as HTMLImageElement;
		expect(main.getAttribute('loading')).toBe('eager');
		expect(main.classList).toContain('object-cover');
		expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
		expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
	});

	it('loads lazily when asked to', () => {
		const { container } = render(MediaImage, { src: '/a.jpg', alt: 'A', lazy: true });

		expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
	});

	it('contains the image when fit is contain', () => {
		const { container } = render(MediaImage, { src: '/a.jpg', alt: 'A', fit: 'contain' });

		expect(container.querySelector('img')?.classList).toContain('object-contain');
	});

	it('shows a placeholder under a tinted overlay instead of the skeleton', () => {
		const { container } = render(MediaImage, {
			src: '/a.jpg',
			alt: 'A',
			placeholder: '/thumb.jpg'
		});

		const placeholder = container.querySelector('img[src="/thumb.jpg"]') as HTMLImageElement;
		expect(placeholder.getAttribute('alt')).toBe('');
		expect(placeholder.getAttribute('aria-hidden')).toBe('true');
		const overlay = container.querySelector('div[aria-hidden="true"]') as HTMLElement;
		expect(overlay.classList).toContain('bg-background/40');
		expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
	});

	it('reveals the image and removes the overlay once it has loaded', async () => {
		const { container } = render(MediaImage, {
			src: '/a.jpg',
			alt: 'A',
			placeholder: '/thumb.jpg'
		});
		const main = container.querySelector('img[src="/a.jpg"]') as HTMLImageElement;

		await fireEvent.load(main);

		expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('false');
		expect(main.classList).toContain('opacity-100');
		expect(container.querySelector('img[src="/thumb.jpg"]')).toBeNull();
		await waitFor(() => expect(container.querySelector('div[aria-hidden="true"]')).toBeNull());
	});

	it('renders the fallback instead of the image when it fails to load', async () => {
		const { container } = render(MediaImage, { src: '/a.jpg', alt: 'A', fallback });

		await fireEvent.error(container.querySelector('img') as HTMLImageElement);

		expect(screen.getByText('Fallback')).toBeTruthy();
		expect(container.querySelector('img')).toBeNull();
	});

	it('renders nothing when the image fails and there is no fallback', async () => {
		const { container } = render(MediaImage, { src: '/a.jpg', alt: 'A' });

		await fireEvent.error(container.querySelector('img') as HTMLImageElement);

		expect(container.querySelector('img')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});
});
