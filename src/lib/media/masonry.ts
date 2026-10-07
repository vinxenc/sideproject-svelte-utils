import type { MediaItem } from './types.js';

export type Tile = { item: MediaItem; left: number; top: number; height: number };
export type Slot = { key: string; left: number; top: number };

// Unknown size (the browser couldn't decode the file): a square. Extremes are clamped so a
// panorama or a screenshot doesn't make a sliver or a tower.
const ratioOf = (item: MediaItem) =>
	item.width && item.height ? Math.min(2, Math.max(0.5, item.width / item.height)) : 1;

/**
 * Masonry: each tile keeps its photo's aspect ratio and goes to the currently shortest column.
 * A tile never changes column while the column count stays the same, so an upload that lands at
 * the top doesn't make every other tile jump; only tiles that are new are placed. That memory is
 * the only state, and `layout` returns the same result for the same input, so it is safe to call
 * from a `$derived`.
 */
export class Masonry {
	#placed = new Map<string, number>();
	#columns = 0;

	layout(items: MediaItem[], columns: number, width: number, gap: number, withSkeletons: boolean) {
		if (this.#columns !== columns) {
			this.#placed.clear();
			this.#columns = columns;
		}
		const colWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
		const heightOf = (item: MediaItem) => colWidth / ratioOf(item);

		const heights = Array<number>(columns).fill(0);
		for (const item of items) {
			const column = this.#placed.get(item.id);
			if (column !== undefined) heights[column] += heightOf(item) + gap;
		}
		for (const item of items) {
			if (this.#placed.has(item.id)) continue;
			const shortest = heights.indexOf(Math.min(...heights));
			this.#placed.set(item.id, shortest);
			heights[shortest] += heightOf(item) + gap;
		}

		// Top of the next tile in each column, filled in item order.
		const tops = Array<number>(columns).fill(0);
		const tiles: Tile[] = items.map((item) => {
			const column = this.#placed.get(item.id)!;
			const tile = {
				item,
				left: column * (colWidth + gap),
				top: tops[column],
				height: heightOf(item)
			};
			tops[column] += tile.height + gap;
			return tile;
		});

		// Loading placeholders: two squares at the end of every column.
		const skeletons: Slot[] = [];
		if (withSkeletons) {
			for (let column = 0; column < columns; column++) {
				for (let n = 0; n < 2; n++) {
					skeletons.push({
						key: `${column}-${n}`,
						left: column * (colWidth + gap),
						top: tops[column]
					});
					tops[column] += colWidth + gap;
				}
			}
		}
		return { colWidth, tiles, skeletons, height: Math.max(0, Math.max(...tops) - gap) };
	}
}
