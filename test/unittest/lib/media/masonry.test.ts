import { describe, expect, it } from 'vitest';
import { Masonry } from '#lib/media/masonry.js';
import type { MediaItem } from '#lib/media/types.js';

const item = (id: string, width: number | null = 100, height: number | null = 100): MediaItem => ({
	id,
	kind: 'IMAGE',
	name: `${id}.jpg`,
	width,
	height,
	duration: null,
	takenAt: '2026-01-01T00:00:00.000Z',
	hasThumb: true
});

// 2 columns of 100px with a 10px gap.
const WIDTH = 210;
const GAP = 10;

describe('Masonry', () => {
	it('puts each new tile in the shortest column', () => {
		const { colWidth, tiles, height } = new Masonry().layout(
			[item('a', 100, 200), item('b'), item('c')],
			2,
			WIDTH,
			GAP,
			false
		);
		expect(colWidth).toBe(100);
		expect(tiles.map((t) => [t.item.id, t.left, t.top, t.height])).toEqual([
			['a', 0, 0, 200],
			['b', 110, 0, 100],
			['c', 110, 110, 100]
		]);
		expect(height).toBe(210);
	});

	it('clamps extreme aspect ratios and treats unknown sizes as squares', () => {
		const { tiles } = new Masonry().layout(
			[item('wide', 1000, 100), item('tall', 100, 1000), item('unknown', null, null)],
			1,
			100,
			0,
			false
		);
		expect(tiles.map((t) => t.height)).toEqual([50, 200, 100]);
	});

	it('keeps placed tiles in their column when an item is prepended', () => {
		const masonry = new Masonry();
		const before = masonry.layout([item('a'), item('b')], 2, WIDTH, GAP, false);
		const after = masonry.layout([item('new'), item('a'), item('b')], 2, WIDTH, GAP, false);
		const left = (tiles: typeof before.tiles, id: string) =>
			tiles.find((t) => t.item.id === id)!.left;
		expect(left(after.tiles, 'a')).toBe(left(before.tiles, 'a'));
		expect(left(after.tiles, 'b')).toBe(left(before.tiles, 'b'));
	});

	it('returns the same layout for the same input', () => {
		const masonry = new Masonry();
		const items = [item('a', 100, 150), item('b'), item('c', 200, 100)];
		expect(masonry.layout(items, 2, WIDTH, GAP, true)).toEqual(
			masonry.layout(items, 2, WIDTH, GAP, true)
		);
	});

	it('re-places every tile when the column count changes', () => {
		const masonry = new Masonry();
		masonry.layout([item('a'), item('b')], 2, WIDTH, GAP, false);
		const { tiles } = masonry.layout([item('a'), item('b')], 1, 100, GAP, false);
		expect(tiles.map((t) => [t.left, t.top])).toEqual([
			[0, 0],
			[0, 110]
		]);
	});

	it('adds two square skeletons at the end of every column', () => {
		const { skeletons, height } = new Masonry().layout([item('a')], 2, WIDTH, GAP, true);
		expect(skeletons).toEqual([
			{ key: '0-0', left: 0, top: 110 },
			{ key: '0-1', left: 0, top: 220 },
			{ key: '1-0', left: 110, top: 0 },
			{ key: '1-1', left: 110, top: 110 }
		]);
		expect(height).toBe(320);
	});
});
