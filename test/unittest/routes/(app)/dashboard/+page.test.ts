import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Page from '../../../../../src/routes/(app)/dashboard/+page.svelte';

afterEach(() => {
	cleanup();
});

describe('dashboard', () => {
	it('shows placeholder blocks for the sections that have no content yet', () => {
		const { container } = render(Page);

		expect(container.querySelectorAll('.aspect-video')).toHaveLength(10);
	});
});
