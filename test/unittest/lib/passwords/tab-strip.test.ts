import { describe, expect, it } from 'vitest';
import { revealScrollLeft, TAB_MARGIN } from '#lib/passwords/tab-strip.js';

// Viewport 300, margin 24 unless a case says otherwise.
describe('revealScrollLeft', () => {
	it('leaves the scroll alone when the label is already visible', () => {
		expect(revealScrollLeft(100, 50, 20, 300)).toBe(20);
	});

	it('scrolls right just enough to show a label cut on the right', () => {
		expect(revealScrollLeft(280, 100, 0, 300)).toBe(280 + 100 + 24 - 300);
	});

	it('scrolls left to show a label cut on the left, keeping the margin', () => {
		expect(revealScrollLeft(200, 50, 300, 300)).toBe(200 - 24);
	});

	it('clamps the left target at 0', () => {
		expect(revealScrollLeft(10, 30, 100, 300)).toBe(0);
	});

	it('applies the left rule when the label is wider than the viewport', () => {
		expect(revealScrollLeft(100, 400, 200, 300)).toBe(100 - 24);
	});

	it('uses a custom margin', () => {
		expect(revealScrollLeft(280, 100, 0, 300, 0)).toBe(80);
	});

	it('exports a 24px margin', () => {
		expect(TAB_MARGIN).toBe(24);
	});
});
