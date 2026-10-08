import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SiteHeader from '#lib/components/site-header.svelte';

const theme = vi.hoisted(() => ({ toggleMode: vi.fn() }));
vi.mock('mode-watcher', () => theme);

afterEach(cleanup);

describe('SiteHeader', () => {
	it('toggles the colour theme from the header button', async () => {
		render(SiteHeader);

		await fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));

		expect(theme.toggleMode).toHaveBeenCalledTimes(1);
	});

	it('links the brand to the sign-in page', () => {
		render(SiteHeader);

		const brand = screen.getByRole('link', { name: 'Utilities' });
		expect(brand.getAttribute('href')).toBe('/sign-in');
	});
});
