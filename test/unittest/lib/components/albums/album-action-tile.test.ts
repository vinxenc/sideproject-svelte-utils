import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AlbumActionTile from '#lib/components/albums/album-action-tile.svelte';

afterEach(() => {
	cleanup();
});

const children = createRawSnippet(() => ({ render: () => '<i data-testid="icon"></i>' }));

describe('AlbumActionTile', () => {
	it('is a link with the label when it has an href', () => {
		render(AlbumActionTile, {
			props: { label: 'All albums', href: '/photo-video/albums', children }
		});
		const link = screen.getByRole('link', { name: 'All albums' });
		expect(link.getAttribute('href')).toBe('/photo-video/albums');
		expect(link.querySelector('[data-testid="icon"]')).toBeTruthy();
	});

	it('is a button that calls onclick when it has no href', async () => {
		const onclick = vi.fn();
		render(AlbumActionTile, { props: { label: 'New album', onclick, children } });
		await fireEvent.click(screen.getByRole('button', { name: 'New album' }));
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('passes the class to the tile', () => {
		render(AlbumActionTile, { props: { label: 'New album', class: 'w-36', children } });
		expect(screen.getByRole('button').classList.contains('w-36')).toBe(true);
	});
});
