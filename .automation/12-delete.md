# 12 · Selecting and deleting (Phase 5)

Select mode in the grid, the selection bar, deleting a selection in one request, and deleting one item from the viewer. The API contract of `DELETE /api/media` is API-09 in [02-api.md](02-api.md); this file is the page. Deleting is a **soft delete**: the row gets `deletedAt`, the stored objects stay.

> Written from the code and run once (see [11-manual-and-gaps.md](11-manual-and-gaps.md)); DEL-12 was rewritten after that run and run again on 2026-10-18 (see [11-manual-and-gaps.md](11-manual-and-gaps.md)). Toast texts come from `gallery.svelte` and `media-lightbox.svelte` as they are now; the viewer's Delete calls the same bulk `DELETE /api/media` with one id (there is no per-item route).

**Needs for the whole file:** [04-upload.md](04-upload.md) to [07-lightbox.md](07-lightbox.md) done, the browser account signed in on `/photo-video`, desktop-sized window unless a case says otherwise. Never delete the standard set (file 09 still uses it): this file deletes only the items it makes.

**Preparation (before DEL-01):** seed 12 placeholders named `del-01` to `del-12` that sort above everything else: `takenAt` of row `g` is `2031-01-01` plus `g` minutes (the example in "Seeding placeholder items", [01-test-data.md](01-test-data.md)), so `del-12` is the newest. Re-enter `Photo & video`. The first tiles of the grid are `del-12`, `del-11`, … in that order, and they are all on the first page. Keep an id list of the 12 rows (`SELECT id, name FROM media WHERE "userId" = '<id>' AND name LIKE 'del-%'`).

Labels: every tile has a round **select button** named `Select <file name>` (aria-pressed) over its top-left corner. When something is selected, a bar floats at the bottom centre with `Clear selection` (an X), the text `N selected`, `Add to album` and `Delete selected` (a trash icon); on an album page it also has `Remove` (ALB-11). The confirmation is an alert dialog `Delete N items?`.

## DEL-01 Starting to select with the mouse

**Steps**

1. Before touching anything read the select button of `del-12`: its computed `opacity` and `pointer-events`.
2. Hover the `del-12` tile with the mouse and read them again; take a small screenshot.
3. Click the circle (by coordinates after hovering, or the button's own `click()`).

**Expected**

- Step 1: opacity 0, pointer-events none (nothing to see or click on a touch screen or at rest). The same button is reachable with the keyboard: focus the `del-12` tile with Tab, press Tab once more, and the select button has focus and shows (opacity 1); Enter or Space then selects.
- Step 2: a white-outlined empty circle appears in the tile's top-left corner, opacity 1.
- Step 3: the circle turns into a white disc with a black check mark and `aria-pressed="true"`; a bar appears at the bottom reading `1 selected`; **every** tile now shows its circle (select mode) and every tile button carries `aria-pressed` (`true` only for `del-12`); the round add button (`Add photos and videos`) is hidden (`display: none`) while the bar is up. The viewer did not open.

## DEL-02 Selecting more, and leaving select mode

**Steps**

1. In select mode click the tile (not the circle) of `del-11`, then the circle of `del-10`. Read the bar.
2. Click the tile of `del-11` again. Read the bar.
3. Click `Clear selection`.
4. Select `del-12` again and then deselect it by clicking its circle.
5. Click a tile.

**Expected**

- Step 1: while selecting, a click on a tile toggles it instead of opening the viewer; the bar reads `3 selected`.
- Step 2: `2 selected`, `del-11` no longer checked.
- Step 3: nothing is selected: the bar is gone, all circles are hidden again, the round add button is back, tiles lose `aria-pressed`.
- Step 4: deselecting the last selected item has the same effect as step 3.
- Step 5: outside select mode a click opens the viewer (close it with `Back`).

## DEL-03 Press and hold on a touch screen

**Steps** (touch input is simulated, see "Touch input" in [01-test-data.md](01-test-data.md); the phone preset is optional)

1. On `del-09`: `pointerdown` with `pointerType: 'touch'`, wait 600 ms, `pointerup`, then `click`.
2. Clear the selection. On `del-09`: `pointerdown` touch, `pointermove` 20 px away after 100 ms, wait 600 ms, `pointerup`.
3. On `del-09`: `pointerdown` touch, `pointerup` after 200 ms, `click` (a tap).
4. A `pointerdown` with `pointerType: 'mouse'` held for 600 ms on a tile.
5. Dispatch a `contextmenu` event on a tile right after a touch `pointerdown` on it, and another right after a `pointerdown` with `pointerType: 'mouse'` (the grid remembers the type of the last `pointerdown` anywhere, so a mouse check straight after a touch one would still see `touch`).

**Expected**

- Step 1: after 500 ms the tile becomes selected (`1 selected`); the `click` that ends the hold does **not** open the viewer and does not toggle it back.
- Step 2: moving more than 10 px before the hold completes cancels it: nothing is selected (this is a scroll, not a press).
- Step 3: a short tap opens the viewer as usual.
- Step 4: a mouse never starts a hold; nothing is selected.
- Step 5: the `contextmenu` event is cancelled for touch and pen (`defaultPrevented`), so the browser's own menu does not appear over the hold. For a mouse it is not cancelled.

## DEL-04 Delete confirmation

**Steps**

1. Select `del-12`, `del-11` and `del-10` and click `Delete selected`. Read the dialog.
2. Click `Cancel`.
3. Click `Delete selected` again, press Escape.
4. Deselect two items so one is left, click `Delete selected`.

**Expected**

- Step 1: an alert dialog titled `Delete 3 items?` with the text `They leave your library and every album.`, buttons `Cancel` and a destructive `Delete`.
- Steps 2 and 3: the dialog closes; the three items are still in the grid and **still selected** (`3 selected`); no request was sent (check the request log).
- Step 4: the title reads `Delete 1 item?` (singular) and the text reads `It leaves your library and every album.` (two or more items read `They leave your library and every album.`, as in step 1).

## DEL-05 Deleting a selection is one request

**Needs:** DEL-04's state with `del-12`, `del-11` and `del-10` selected. Arm the fetch recorder (response status and request body included) and delay the `DELETE` by 2 seconds.

**Steps:** click `Delete selected`, then `Delete`; while it waits try Escape, a click on the dark backdrop and the `Cancel` button; let it finish.

**Expected**

- While the request is pending: the dialog stays open, `Delete` shows a spinner and is disabled, `Cancel` is disabled, Escape and the backdrop do nothing (the dialog cannot be dismissed mid-request).
- **Exactly one** request leaves: `DELETE /api/media`, JSON body `{"mediaIds":[…]}` with the three ids of the selected items (any order), answered 200 `{"deleted":3}`. No request to `/api/media/<id>` with the method `DELETE` appears.
- Afterwards the dialog is closed, the three tiles are gone from the grid (the others did not move columns), nothing is selected, the bar is gone, the round add button is back and a toast `Deleted 3 items` appears.
- The album strip asks `GET /api/albums?limit=5` again (its counts and covers may have changed).
- In the database the three rows have `deletedAt` set, `status` still READY and every other column as before; `del-09` and the other rows have `deletedAt` null.

## DEL-06 A failed delete keeps the selection

**Steps**

1. Select `del-09` and `del-08`. Make the first `DELETE /api/media` answer HTTP 500 with `{"message":"boom"}`. Click `Delete selected`, `Delete`.
2. Repeat after restoring `fetch`, but this time make the call reject like a network error.
3. Restore `fetch` and click `Delete selected`, `Delete` once more.

**Expected**

- After step 1: a toast `Couldn't delete 2 items` with the description `boom`; the dialog is closed; both tiles are still in the grid and still selected (`2 selected`); nothing changed in the database.
- After step 2: the same toast with the description `Failed to fetch`; selection unchanged.
- After step 3: both go, toast `Deleted 2 items`, selection cleared. (A retry after a failure is safe: it is the same ids.)

## DEL-07 Deleted items stay deleted

**Steps:** reload the page (full load). Request `GET /api/media` pages (or read the tile names) and, for the ids deleted in DEL-05 and DEL-06, `GET /api/media/<id>/original` and `/thumb`.

**Expected:** none of the five deleted items (`del-12`, `del-11`, `del-10`, `del-09`, `del-08`) is listed or shown; `del-07` and below are; the file requests answer 404 (a soft-deleted item is invisible to its owner, the files included).

## DEL-08 Deleting from the viewer

**Steps**

1. Open `del-06` (the tile in the middle of the remaining `del-` items) and click `More options`, then `Delete`. Read the dialog. Click `Cancel`.
2. Click `More options`, `Delete`, `Delete` with the request recorder armed.
3. Look at the viewer and the grid behind it.
4. Make the next `DELETE /api/media` fail with 500 `{"message":"late"}` and delete the item the viewer now shows.

**Expected**

- Step 1: the dialog is titled `Delete "del-06"?` with the text `It leaves your library and every album.` and `Cancel` / `Delete`; Cancel changes nothing.
- Step 2: while the request is pending the dialog stays open with a spinner on `Delete`; the request is `DELETE /api/media` with the body `{"mediaIds":["<del-06's id>"]}` (one id) and the answer is `{"deleted":1}`. A toast `Deleted` appears.
- Step 3: the viewer **stays open and moves to the next item** in grid order (`del-05`): its name is in the footer, `Previous` goes back to `del-07`. The tile of `del-06` is gone from the grid behind. The album strip refreshed.
- Step 4: a toast `Couldn't delete` with the description `late`; the viewer stays on the same item; the item is still in the grid.

## DEL-09 The objects stay

**Needs:** one real item `del-real.png` made without the dialog (see "Real items without the dialog", [01-test-data.md](01-test-data.md)) with a thumbnail; re-enter the page and find its tile.

**Steps:** note its two object keys and check both exist in the bucket. Select the tile and delete it. Check the bucket and the row again.

**Expected:** the tile goes; the row has `deletedAt` set; **both objects are still in the bucket**; `GET /api/media/<id>/thumb` answers 404 for the owner. (Objects of soft-deleted items are only removed by the cleanup, [10-cleanup.md](10-cleanup.md).)

## DEL-10 Leaving the page drops the selection

**Steps:** select two tiles, click `Home` in the sidebar, then `Photo & video`.

**Expected:** back on the library nothing is selected, no bar, the round add button is visible. (The selection belongs to the page, not to the account.)

## DEL-11 Selecting while more pages load

**Needs:** the seeded account of GAL-06 (more than 60 items below the `del-` rows).

**Steps:** select `del-04`, scroll to the bottom until the next page has loaded (wake the page), select one tile from the new page, scroll up. Click `Delete selected`.

**Expected:** the selection survives loading more tiles, the bar says `2 selected`, and deleting removes both (the second is from the second page). Re-entering the page shows neither.

## DEL-12 More than 500 at once (heavy, optional)

The client splits a selection into requests of at most 500 ids, one after another. The case has three parts. A successful delete removes the rows it deletes, so the three parts cannot share the same 510 rows: **run the two failure parts first (they use one set of 510 rows), then seed again for the success part.** Seed 510 placeholders (prefix `bulka`, `takenAt` = a fixed start plus `g` minutes for row `g`, so that the grid order is `bulka-510` first and `bulka-001` last), reload the page, load every page by scrolling (the library then shows the 510 and the real items), click all 510 select buttons from the page in grid order (`click()` on each) and wrap `window.fetch` as described under "Making a request fail or wait" in [01-test-data.md](01-test-data.md).

**Failure, first request:** make the first `DELETE /api/media` answer `404` with `{"message":"Not found"}` (the stub answers it without reaching the server) and delete all 510. **Expected:** one `DELETE` only (500 ids); nothing leaves the grid (510 tiles of the prefix remain, and no row has `deletedAt`); all 510 stay selected (`510 selected`); the toast is `Couldn't delete 510 items` with the description `Not found`; the album strip is not refetched (no `GET /api/albums?limit=5`).

**Failure, second request (the same 510, still selected):** now make the second `DELETE /api/media` answer `404` with `{"message":"Not found"}` and let the first go through. Delete. **Expected:** two `DELETE` requests (500 and 10 ids). The first 500 leave the grid at once, and their rows have `deletedAt` set (check in the database; with that `takenAt` the first 500 in grid order, `bulka-011` to `bulka-510`, are gone and `bulka-001` to `bulka-010` are alive). The bar reads `10 selected` and those 10 stay selected. The toast is `Couldn't delete 10 items` with the description `Not found`, and no `Deleted` toast. The album strip refreshes: a `GET /api/albums?limit=5` follows the failure, after the second `DELETE`.

**Success:** seed 500 more rows (prefix `bulkb`) so that, with the 10 left over, 510 are alive; reload, load every page, select all 510 (`bulk` prefixes), restore `fetch` (recorder only) and delete. **Expected:** two `DELETE /api/media` requests in sequence with 500 and 10 ids, both answered 200, no request to `/api/media/<id>`, one toast `Deleted 510 items`, nothing selected afterwards, a `GET /api/albums?limit=5` after the second one, and all 510 rows with `deletedAt`. Skip the case if the run is short; the server limit itself is API-09. Purge the seeded rows afterwards (CLN-03).

## DEL-13 The selection bar on a phone

**Needs:** phone preset (375 × 812), page reloaded, at least two tiles in the grid. Reset the viewport to desktop at the end.

**Steps:** press and hold a tile (as DEL-03), then take a screenshot and read the bar's buttons.

**Expected**

- The bar is centred at the bottom, at least 16 px above the bottom edge, inside the viewport, and the page does not scroll sideways.
- `Add to album` shows only its icon (its text is visually hidden: the label's rendered width is 1 px or less) but its accessible name is still `Add to album`; `Delete selected` and `Clear selection` are icon buttons. At desktop width `Add to album` shows its text.
- The tiles show their circles (touch has none at rest, they appear once something is selected).
