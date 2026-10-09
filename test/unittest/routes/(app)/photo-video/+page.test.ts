import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from '../../../../../src/routes/(app)/photo-video/+page.svelte';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
	async () =>
		new Response(JSON.stringify({ items: [], nextCursor: null }), {
			headers: { 'content-type': 'application/json' }
		})
);

beforeEach(() => {
	fetchMock.mockClear();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('Photo & video page', () => {
	it('shows the albums strip above the library, loading both', async () => {
		render(Page);

		expect(await screen.findByRole('heading', { name: 'Albums' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Library' })).toBeTruthy();
		const urls = () => fetchMock.mock.calls.map((call) => call[0]);
		await waitFor(() => expect(urls()).toContain('/api/albums?limit=5'));
		await waitFor(() => expect(urls()).toContain('/api/media'));
	});
});
