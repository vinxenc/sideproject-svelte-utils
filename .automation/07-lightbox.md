# 07 · The full-screen viewer

Opening a tile shows the photo or video full screen, with navigation to the neighbours.

**Needs for the whole file:** [04-upload.md](04-upload.md) done (the standard set is stored: a photo with a thumbnail, a video, undecodable files), the QA account signed in, the browser on `Photo & video`. LBX-08 also needs the seeded account from GAL-06 (more than 120 items).

Labels: the viewer is a modal dialog with a visually hidden title (the file name) and description (`Use the left and right arrow keys to move between photos and videos.`), round `Previous` and `Next` buttons at the sides (their text is visually hidden), a header with a round `Back` button (arrow) at the top-left and a `More options` button (three dots) at the top-right, and a footer with the file name on the left and the date on the right. There is no `Close` button: `Back` and Escape close it. The `More options` menu holds `Add to album`, `Remove from album` (only inside an album) and `Delete`; its cases are LBX-09 here, ALB-05 and DEL-08.

## LBX-01 Open a photo

**Steps:** click the tile of `exif-photo.jpg`, wait for it to load, take a screenshot.

**Expected**

- A dialog that covers the whole viewport (no margins, no rounded corners), not just a box in the middle.
- While the original downloads, the thumbnail is shown under a translucent overlay with a spinner; afterwards the overlay is gone and the photo is fully visible (opacity 1), fitted inside the screen without cropping. The loaded image is the original (natural width 1600), not the thumbnail (1024).
- Footer: `exif-photo.jpg` on the left, the date on the right in the browser's locale in medium form (for example `Mar 14, 2021`).
- Both `Previous` and `Next` are visible when the item is in the middle of the list.

## LBX-02 Next and previous

**Steps:** press ArrowRight, then ArrowLeft (the page has focus, not a video). Then click `Next`, then `Previous`.

**Expected:** ArrowRight shows the next tile's item in grid order, ArrowLeft returns; the buttons do the same; the footer name follows. On the first item there is no `Previous` button, and on the last loaded item there is no `Next` button (more pages are fetched when the viewer gets within four items of the end, see LBX-08).

## LBX-03 Swipe

**Steps:** with a pointer, press at a point, move and release: 120 px to the left (and about 5 px vertically); 140 px to the right; 30 px to the left; and 100 px mostly vertical (40 px sideways, 120 px down).

**Expected:** 120 px left goes to the next item; 140 px right goes back; the 30 px move and the mostly-vertical move do nothing (a swipe needs more than 50 px, mostly horizontal). Starting the drag on a video does not swipe.

## LBX-04 Closing

**Steps:** press the real Escape key; then reopen a tile and click `Back`.

**Expected:** the viewer closes both ways (its dialog state becomes closed and the element is removed once the exit animation has run; wake a hidden pane to see that), and the gallery behind it is unchanged.

## LBX-05 A video

**Steps:** open a video item (a recording or video A), wait until it has loaded its metadata, start it muted.

**Expected:** a `<video>` with native controls fills the screen, fitted inside it; its `poster` is the item's thumbnail (`/api/media/<id>/thumb`) and its source is `/api/media/<id>/original`; it is set to preload only the metadata, plays inline, and the playback time advances once started. The footer shows the file name and date. Its duration matches the badge on the tile.

## LBX-06 Arrow keys belong to a focused video

**Steps:** with a video open, send an ArrowRight key event whose target is the `<video>` element; then send an ArrowRight to the page.

**Expected:** the first does nothing to the viewer (the video keeps the key to seek); the second moves to the next item.

## LBX-07 An original the browser cannot show

**Steps:** open `junk-1536.jpg` (its bytes are not an image).

**Expected:** instead of the photo, a centred panel with an image-off icon, the title `This browser can't show the original`, the text `junk-1536.jpg is in a format this browser can't display, such as HEIC outside Safari.` and an `Open original` button that is a link to `/api/media/<id>/original`, opening in a new tab (`target="_blank"`, `rel="noreferrer"`). The viewer can still be navigated and closed.

## LBX-08 Loading more while paging in the viewer

**Needs:** an account with 120 items loaded and more pages behind them (seed so the total is above 160; load two pages, no third).

**Steps:** open the 60th tile (not the 112th: with four columns the 112th tile's neighbourhood is within the grid's own 800 px load trigger, so the grid fetches the third page before the viewer does) and press ArrowRight 52 times to reach the 112th item without touching the list requests; press it once more (the viewer is on the 113th item, count the tiles and requests); press it four more times (the 117th item); then keep pressing it six more times. Watch the list requests.

**Expected:** no request while moving from the 112th to the 116th item. The next page is requested automatically when the viewer steps onto the 117th item (one of the last four of the 120 loaded) and the grid behind it grows to the full list. The viewer then moves past item 120 into the new items without closing. With everything loaded no more requests are made.

## LBX-09 The `More options` menu

**Steps**

1. Open a photo on `/photo-video` and click `More options`. Read the menu. Press Escape (the menu closes, the viewer stays).
2. Open it again and press ArrowRight and ArrowLeft while the menu is open.
3. Choose `Add to album`. While the dialog `Add 1 item to an album` is open, press ArrowRight with focus inside it. Close the dialog with `Escape`.
4. Open the menu, choose `Delete`, and while the confirmation `Delete "<file name>"?` is open press ArrowRight, **right after the click** (three real key presses sent as soon as the click returns) and also in the window before the alertdialog takes focus (about 60 ms): from the page, call the menu item's `click()` and dispatch `keydown` ArrowRight on `document.activeElement` in the same tick and again 15, 40 and 80 ms later. Choose `Cancel`.
5. Open a video and click `More options` while it is open; click once on the page outside the menu.

**Expected**

- The menu shows a group labelled `Album` with `Add to album`, a separator and `Delete` (in the destructive colour). On the library page there is no `Remove from album`.
- In steps 2 to 4 the arrow keys do not move the viewer: the footer keeps the same file name. The menu, the album dialog and the confirmation each own the keys while they are on top.
- `Cancel` leaves the item, the list and the request log untouched (no `DELETE`).
- Step 5: a click outside the menu closes it even over a video (while the menu is open the video ignores pointer events, so the click reaches the page).
- Written from code only; the arrow-key part is the easiest to get wrong, so check it with real key presses.
