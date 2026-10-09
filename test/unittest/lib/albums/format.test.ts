import { describe, expect, it } from 'vitest';
import { albumSubtitle, formatCount } from '#lib/albums/format.js';

describe('formatCount', () => {
	it.each([
		[0, 'No items'],
		[1, '1 item'],
		[12, '12 items']
	])('%s -> %s', (count, expected) => expect(formatCount(count)).toBe(expected));
});

describe('albumSubtitle', () => {
	it('joins the count and the updated date', () => {
		const updatedAt = '2026-10-09T12:00:00.000Z';
		const date = new Date(updatedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });

		expect(albumSubtitle({ count: 12, updatedAt })).toBe(`12 items · ${date}`);
		expect(albumSubtitle({ count: 0, updatedAt })).toBe(`No items · ${date}`);
	});
});
