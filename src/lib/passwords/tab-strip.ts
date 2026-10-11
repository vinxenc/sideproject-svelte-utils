// Pure helper for the tab strip: where to scroll it so the selected label is fully visible.

/** Room, in px, kept beside a label that is scrolled into view, so the neighbouring label peeks. */
export const TAB_MARGIN = 24;

/**
 * The scrollLeft that shows [start, start + size) (strip content coordinates) inside a viewport of
 * `viewport` px currently scrolled to `scrollLeft`, moving as little as possible:
 * - start - margin < scrollLeft            -> max(0, start - margin)
 * - start + size + margin > scrollLeft + viewport -> start + size + margin - viewport
 * - otherwise                               -> scrollLeft (unchanged)
 * The left check wins when the label is wider than the viewport. The browser clamps the right end.
 */
export function revealScrollLeft(
	start: number,
	size: number,
	scrollLeft: number,
	viewport: number,
	margin = TAB_MARGIN
): number {
	if (start - margin < scrollLeft) return Math.max(0, start - margin);
	if (start + size + margin > scrollLeft + viewport) return start + size + margin - viewport;
	return scrollLeft;
}
