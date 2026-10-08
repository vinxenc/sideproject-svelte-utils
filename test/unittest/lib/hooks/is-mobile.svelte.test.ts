import { afterEach, describe, expect, it, vi } from 'vitest';
import { IsMobile } from '#lib/hooks/is-mobile.svelte.js';
import { matchingQueries } from '../../helpers/dom.js';

afterEach(() => {
	matchingQueries.clear();
});

describe('IsMobile', () => {
	it('is true below the default 768px breakpoint', () => {
		matchingQueries.add('(max-width: 767px)');

		expect(new IsMobile().current).toBe(true);
	});

	it('uses a breakpoint given in pixels, with the query one pixel below it', () => {
		const spy = vi.spyOn(window, 'matchMedia');

		const isMobile = new IsMobile(1024);

		expect(isMobile.current).toBe(false);
		expect(spy.mock.calls.map(([q]) => q)).toContain('(max-width: 1023px)');
	});
});
