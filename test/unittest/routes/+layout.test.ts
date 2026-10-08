import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Layout from '../../../src/routes/+layout.svelte';

afterEach(cleanup);

describe('root layout', () => {
	it('renders the page inside the site header', () => {
		const children = createRawSnippet(() => ({ render: () => '<p>child</p>' }));

		render(Layout, { children } as never);

		expect(screen.getByText('child')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeTruthy();
	});
});
