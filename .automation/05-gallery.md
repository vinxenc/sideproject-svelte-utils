# 05 · The populated gallery

The grid once it has items: layout, tiles, image loading, infinite scroll and how new uploads slot in.

**Needs for the whole file:** [04-upload.md](04-upload.md) done (the standard set, `rotated.jpg` and the two big files are stored), the QA account signed in, the browser on `Photo & video`. GAL-06 to GAL-08 add placeholder rows to the account.

## GAL-01 Mosaic layout

**Steps:** with all items loaded and the content area wide, read the placement of the first eight tiles (computed `grid-column` and `grid-row` spans, or a screenshot).

**Expected**

- The grid switches by the width of its own container, not of the window: **four columns** when the container is at least 36 rem (576 px) wide, **two columns** below that.
- Four columns: the tiles repeat in blocks of four: 1st tile 2 columns × 2 rows, 2nd and 3rd tiles 1 × 1, 4th tile 2 columns × 1 row, then the 5th tile starts the next block (2 × 2) and so on. The blocks fit together with no holes.
- Two columns: blocks of three: 1st tile 2 × 2, 2nd and 3rd tiles 1 × 1, the 4th tile starts the next block.
- Rows are 7:6 (a tile is a little wider than tall): the row height is `(column width) × 6 / 7`. The gap is 12 px with four columns and 8 px with two.
- The page size is 60, a multiple of both 4 and 3, so a page never ends in the middle of a block.

## GAL-02 What a tile shows

**Steps:** look at the standard set's tiles and their markup.

**Expected**

- A tile with a thumbnail shows it filling the tile (cropped to fit), loaded lazily (`loading="lazy"`).
- A video tile has a badge at the bottom-left: a play icon and the duration as `m:ss` (`h:mm:ss` from one hour).
- An item without a thumbnail shows a grey tile with a small image icon (a video icon for videos) and a visually hidden text with the file name.
- Every tile is a button, its tooltip (`title`) is the file name, it can be focused with the keyboard and Enter or Space opens the viewer (LBX-01).

## GAL-03 Skeleton and overlay while an image loads

**Steps:** make the thumbnails never arrive (see "Images that never load" in [01-test-data.md](01-test-data.md)), leave `Photo & video` and come back, wait about a second, and take a screenshot. Then stop the rewriting and repeat.

**Expected**

- While nothing arrives, every tile that has a thumbnail shows a pulsing skeleton with a spinner on top; the `<img>` is invisible (opacity 0) and its wrapper is marked busy (`aria-busy="true"`).
- With the real images, each tile ends with the image fully visible (opacity 1), no spinner left and `aria-busy="false"`.

## GAL-04 Cached images and re-entering the page

**Steps:** leave `Photo & video` for `Home` and come back, three times, waiting about a second each time.

**Expected:** after every return all thumbnails reach the loaded state (none stuck with a skeleton or a spinner) although they now come from the browser cache; the number of tiles is the same each time (no duplicates, no missing tiles). A new list request is made on each return.

## GAL-05 A thumbnail that is not an image

**Steps:** create an item whose stored thumbnail is garbage: create an upload with `thumb: true`, `PUT` 500 random bytes to both URLs (the original with its type, the thumbnail as `image/jpeg`), complete it, then re-enter `Photo & video`.

**Expected:** the tile shows the grey icon placeholder (not a broken-image icon). Opening it in the viewer works; because the original is garbage too, the viewer shows its "can't show the original" panel (LBX-07).

## GAL-06 Infinite scroll

**Needs:** a QA account with more than 120 items; seed 150 placeholders on top of the existing ones (the total is then above 160). The browser must be awake (README).

**Steps**

1. Scroll to the top, then re-enter `Photo & video` (the scroll position survives re-entering, and a page scrolled to the bottom would start loading at once). Count the list requests from now on.
2. Count the tiles. Scroll to the very bottom, take a small screenshot to wake the page, wait a second, count again. Repeat until the count stops changing.
3. Scroll to the bottom once more and wait.

**Expected**

- First 60 tiles, then 120, then all of them: one request per page, i.e. 3 requests for the 160-odd items (the first without, the other two with a `cursor`).
- Each new page loads when the bottom of the grid comes within about 800 px of the viewport, without any button.
- At the end no further request is made when scrolling again.
- Seeded tiles have no image: they show the grey placeholder.

## GAL-07 A later page fails

**Needs:** as GAL-06, but with only the first page loaded.

**Steps**

1. Make the next `GET /api/media?cursor=...` fail like a network error (once).
2. Scroll to the bottom to trigger it. Note the toast.
3. Scroll to the top and to the bottom again a few times for about 3 seconds and count requests.
4. Click the toast's `Try again`.

**Expected**

- A toast `Couldn't load your photos and videos` with the description `Failed to fetch` and the action `Try again`. It stays until used or dismissed.
- The 60 tiles already there stay; there is **no inline retry row** in the page.
- While the toast is up **no further list request is made** (no retry loop), however much you scroll.
- `Try again` loads the next page (120 tiles), and the toast goes away.
- If the toast is dismissed instead, loading stays paused until something asks again: stepping to the end of the viewer (LBX-08) or leaving and re-entering the page.

## GAL-08 Where a new upload appears

**Needs:** more than 60 items for the account, only the first page loaded (re-enter the page and do not scroll).

**Steps**

1. Upload `older.jpg` (EXIF 2018, older than every loaded tile) through the dialog. Count the tiles.
2. Upload `newer.png` (no EXIF, so "now"). Count the tiles and look at the first tile.
3. Scroll to the bottom (wake the page) until all pages are loaded and look at the last tiles.

**Expected**

- After step 1 the number of tiles is unchanged and `older.jpg` is **not** shown: it sorts after the last loaded item and a later page will bring it.
- After step 2 there is one more tile and the first tile is `newer.png`, immediately and without reloading.
- After step 3 `older.jpg` is the last tile of the whole list, after `rotated.jpg` (2019), and the total is the old total plus 2.
