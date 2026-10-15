import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordSearch from '#lib/components/passwords/password-search.svelte';

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('PasswordSearch', () => {
	it('renders a search box with the accessible name, placeholder and search attributes', () => {
		render(PasswordSearch, { props: { value: '' } });

		const box = screen.getByRole('searchbox', { name: 'Search passwords' });
		expect(box.getAttribute('placeholder')).toBe('Search');
		expect(box.getAttribute('type')).toBe('search');
		expect(box.getAttribute('autocomplete')).toBe('off');
	});

	it('shows a leading search icon inside the input group addon', () => {
		render(PasswordSearch, { props: { value: '' } });

		expect(document.querySelector('[data-slot=input-group-addon] svg')).not.toBeNull();
	});

	it('writes the typed query back through its bound value', async () => {
		let value = '';
		render(PasswordSearch, {
			props: {
				get value() {
					return value;
				},
				set value(next: string) {
					value = next;
				}
			}
		});

		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search passwords' }), {
			target: { value: 'git' }
		});

		expect(value).toBe('git');
	});

	it('sends nothing to the server while typing', async () => {
		render(PasswordSearch, { props: { value: '' } });

		await fireEvent.input(screen.getByRole('searchbox', { name: 'Search passwords' }), {
			target: { value: 'github' }
		});

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
