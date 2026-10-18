# 13 · Albums (Phase 6)

The album strip on `/photo-video`, the album list, an album's page and everything that puts items into an album or takes them out. The API behind it is [14-albums-api.md](14-albums-api.md). Deleting an album or an item is a soft delete: rows get `deletedAt`, links in `album_media` and the stored objects stay.

> Executed in part 2 of the first run (2026-10-18): ALB-01 to ALB-18 pass (ALB-17 and ALB-18 were changed afterwards and run again on 2026-10-18: ALB-18 passes; ALB-17 passes both its width check and the check that the first card's fan stays in view, the latter after the strip got a start padding of 32 px (56 px from `sm`), see [11-manual-and-gaps.md](11-manual-and-gaps.md)); ALB-05 first failed (arrow key right after choosing `Add to album` moved the viewer), was fixed with `keysPaused` and passed the real-key browser re-check (see [11-manual-and-gaps.md](11-manual-and-gaps.md)); wording fixed where the run found it wrong (ALB-13). A card with exactly one photo on a phone (ALB-17) followed its link on the first tap in the re-run.

**Needs for the whole file:** [04-upload.md](04-upload.md) done (the standard set is stored and is what the albums hold), [12-delete.md](12-delete.md) done, the browser account signed in on `/photo-video`, a desktop-sized window unless a case says otherwise. The browser account has no albums when the file starts (EMP-04 and EMP-05 checked that; if an earlier run left albums in it, say so). Album names used below: `QA Holidays`, `QA Trip`, `QA Picks`. Never delete the standard set here; the cases that delete items make their own.

Labels: the strip is the section headed `Albums`; its icon button is named `New album`. An album card is a link to `/photo-video/albums/<id>` showing up to three stacked photos, the name (tooltip = name) and `N items · <date>` (`No items`/`1 item`/`N items`, then the album's last-changed date in the browser's medium date form). On an album page the `⋯` button is named `Album options`; its menu has the group `File` with `New file`, `Download`, `Rename`, then `Delete`.

## ALB-01 Creating an album from the strip

**Steps**

1. On `/photo-video` click the `New album` icon button in the `Albums` heading (or the dashed `New album` tile).
2. In the dialog `New album` type nothing, then only spaces. Then type `  QA Holidays  `. Arm the request recorder first.
3. Press `Create`.
4. Click `Photo & video` in the sidebar.

**Expected**

- Step 2: `Create` is disabled for an empty name and for spaces only. (Typing a tab character into the field, set from the page, and pressing `Create` shows `Album names can't contain line breaks` under the field and creates nothing; `maxlength` stops the field at 100 characters.)
- Step 3: one request, `POST /api/albums` with the body `{"name":"QA Holidays"}` (trimmed), answered 201. A toast `Album created` appears, and the app goes to `/photo-video/albums/<id>`: heading `QA Holidays`, breadcrumb `Photo & video › Album › QA Holidays` (the first two are links), page title `QA Holidays · Utilities`, an empty state `This album is empty` with the text `Upload with the + button, or add photos from Photo & video: select them, then Add to album.`, and the round add button named `Add photos and videos to QA Holidays`.
- Step 4: the strip now shows one card `QA Holidays` with `No items · <today>` (a dashed frame with an images icon, since there is nothing to stack) followed by the dashed `All albums` tile. Cancelling the dialog (`Cancel`, Escape) instead creates nothing and clears the field for the next time.

## ALB-02 Creating an album from the albums page

**Steps:** open `/photo-video/albums` through the `All albums` tile, click the `New album` icon button at the right of the `Albums` heading, create `QA Trip`.

**Expected:** the same as ALB-01 step 3 (toast, the new album's page, heading `QA Trip`). Back on `/photo-video/albums` (use the breadcrumb link `Album`; breadcrumb `Photo & video › Album`, the sidebar entry `Photo & video` highlighted) two cards are listed, newest created first: `QA Trip`, `QA Holidays`.

## ALB-03 Adding a selection to a new album

**Steps**

1. On `/photo-video` select `alpha.png`, `photo.webp` and `tiny.gif` (their select buttons are named `Select alpha.png` and so on). Click `Add to album` in the bar.
2. Read the dialog. Click `New album`, type `QA Picks`, click `Create and add`.
3. Look at the page and the request log.

**Expected**

- Step 2: the dialog is titled `Add 3 items to an album` (`Add 1 item to an album` for one) with the text `Pick an album, or create one for these.`; it lists `QA Trip` and `QA Holidays` newest first, each with its name and `No items`, and a `New album` button above them that opens a `Name` field and a `Create and add` button (disabled while the name is blank).
- Step 3: two requests in order, `POST /api/albums` `{"name":"QA Picks"}` then `POST /api/albums/<new id>/items` with `{"mediaIds":[…3 ids…]}` answered `{"added":3}`. A toast `Added 3 items to "QA Picks"`. The dialog is closed, the selection is cleared (no bar), and the strip refreshes by itself: the first card is `QA Picks` with `3 items · <today>` and three stacked photos (three frames).
- Failure variant: make the `POST /api/albums` fail with 500 `{"message":"nope"}`; the dialog stays open with `nope` under the field and nothing is created; after restoring `fetch` a second press works and creates **one** album (never two).

## ALB-04 Adding to an existing album, and adding twice

**Steps**

1. Select `exif-photo.jpg` and `alpha.png`, click `Add to album`, choose `QA Trip` in the list (its row shows its name and `No items`).
2. Select the same two again and choose `QA Trip` again.
3. Select `exif-photo.jpg`, `alpha.png` and `tiny.gif` and choose `QA Trip`.

**Expected**

- Step 1: `POST /api/albums/<QA Trip id>/items` answered `{"added":2}`, toast `Added 2 items to "QA Trip"`, dialog closed, selection cleared, the card shows `2 items`.
- Step 2: `{"added":0}` and a toast `Already in "QA Trip"`; the card's date does not change (a re-add that adds nothing is not a change).
- Step 3: `{"added":1}`, toast `Added 1 item to "QA Trip"`, the card shows `3 items`.
- The dialog on an album's own page does not list that album (see ALB-08). A spinner replaces the folder icon on the row while the request runs, and the other rows are disabled.

## ALB-05 Adding from the viewer

**Steps:** open `photo.webp` on the library page, `More options`, `Add to album`. While the dialog `Add 1 item to an album` is open press ArrowRight, once after the dialog has settled (focus inside it, about a second after the click) and once immediately after clicking the menu item (the dialog takes focus only after about 40 ms). Choose `QA Holidays`.

**Expected:** the dialog opens on top of the viewer (the viewer stays open underneath, same item); the arrow key does not change the item (also when pressed immediately after the click: the lightbox's key handler must ignore keys while the album dialog is opening); the toast is `Added 1 item to "QA Holidays"`, the dialog closes and the viewer is still open on `photo.webp`; the strip card `QA Holidays` now says `1 item`.

## ALB-06 The strip: order, limit and cards

**Needs:** seed 70 albums for the browser account (prefix `seedalb`, `createdAt` = 2020-01-01 plus `g` days for `g` = 1 to 70, see "Seeding albums"), no items in them. They are also used by ALB-07.

**Steps:** re-enter `Photo & video` and read the strip: which cards, in which order, what the last tile is; hover or focus (Tab) a card with photos and read its frames; touch is covered by ALB-17.

**Expected**

- The strip shows the **5 newest** albums by creation date: `QA Picks`, `QA Trip`, `QA Holidays`, `seedalb-70`, `seedalb-69`, then the dashed tile `All albums` linking to `/photo-video/albums`. The request was `GET /api/albums?limit=5`. Albums are ordered by when they were **created**, never by when they were last changed: adding to or renaming an older album does not move it (ALB-10 checks this again).
- Each card is a link with the name (tooltip), the subtitle `N items · <date>` and up to three stacked photos; with 0 items it is the dashed tile described in ALB-01. Hovering or focusing a card with two or more photos fans the stack out. A video in the stack has a small play badge at its top-right.
- The row scrolls sideways (native scroll; the mouse can also drag it by holding and moving more than 5 px, which does not open the card it started on). Nothing else on the page moves.

## ALB-07 The albums page and its paging

**Needs:** ALB-06's 70 seeded albums (73 in total).

**Steps:** open `/photo-video/albums` through a full page load and count the cards. Scroll to the bottom (wake the page), wait, count again; repeat until it stops growing. Count the list requests.

**Expected**

- 30 cards, then 60, then 73: three requests `GET /api/albums?limit=30` (the first), then two with `&cursor=…`, the next page requested when the end of the list is within about 800 px of the viewport; no button. No further request after the last page.
- Order: `QA Picks`, `QA Trip`, `QA Holidays`, `seedalb-70` … `seedalb-01`; no card twice, none missing. The grid has two columns on a phone, three from 640 px, four from 1024 px and five from 1280 px.
- The first card is not cut by the sidebar: the grid has a start padding of 24 px from `sm` (16 px below it), so at 1440 px the first card is at x = 296 and its fanned frames (real hover) start at 256 or more; see ALB-17 for the numbers. At 1440 px five columns are 174.4 px wide each, at 1024 px four columns are 130 px.
- While the first page loads there are ten skeleton cards; a failed page raises a toast `Couldn't load your albums` with `Try again` that stays until used (make one cursor request fail once with a network error, as GAL-07 does).
- Afterwards purge the seeded albums (prefix `seedalb`, this user only, hard delete; see "Purging the run's data safely" in [10-cleanup.md](10-cleanup.md)).

## ALB-08 An album's page

**Steps:** open `QA Trip` (from the strip). Read the grid, then click the first tile and use `Next`/`Previous`. Click the round add button and read the dialog; close it.

**Expected**

- The request is `GET /api/albums/<id>/media`; the grid holds exactly the album's items (`exif-photo.jpg`, `alpha.png`, `tiny.gif`), newest first (`alpha.png` and `tiny.gif` "now", `exif-photo.jpg` last), not the whole library. Page title `QA Trip · Utilities`; breadcrumb `Photo & video › Album › QA Trip`; the sidebar entry `Photo & video` is highlighted.
- The viewer only walks through those three items. Its `More options` menu has the group `Album` with `Add to album` and `Remove from album`, then `Delete`.
- The upload dialog is titled `Add to "QA Trip"` with the text `New photos and videos go into this album and your library.`
- `Add to album` for items selected here lists the other albums but **not** `QA Trip` itself.
- The `⋯` button `Album options` opens `File` › `New file` (opens the same upload dialog), `Download`, `Rename`, then `Delete`.

## ALB-09 Uploading straight into an album

**Steps:** on the album page of `QA Trip` open the upload dialog (round button or `New file`), give it one small PNG named `alb-up.png`, submit, with the request recorder armed. Then go to the library page.

**Expected**

- The upload finishes as in UPL-03; the toast is `Added 1 item to "QA Trip"` (not `…to the gallery`). `POST /api/media/<id>/complete` carries the body `{"albumId":"<QA Trip id>"}`.
- The tile appears at the top of the album page without a reload, and is also in the library; the strip card of `QA Trip` says `4 items`.
- An upload from the library page (no album) completes with **no body** and links to no album.
- With a mixed round (cannot happen from one page) the toast would say `to the gallery`; not tested.

## ALB-10 Renaming

**Steps**

1. Open `QA Holidays`, `Album options` › `Rename`. Read the dialog. Clear the field, then restore the original text.
2. Rename it to `QA Holidays 2` and press `Save` (recorder armed).
3. Look at the heading, breadcrumb and title. Go to `Photo & video` and read the strip.

**Expected**

- Step 1: the dialog `Rename album` (text `Choose a new name for this album.`) opens with the current name filled in; `Save` is disabled while the name is unchanged (also after an edit that only adds spaces around it); a blank name can be submitted and is rejected with `Enter an album name` under the field, nothing is sent.
- Step 2: one request, `PATCH /api/albums/<id>` with `{"name":"QA Holidays 2"}`, answered with the album; toast `Album renamed`; the dialog closes.
- Step 3: the page's heading, the last breadcrumb and the tab title all show `QA Holidays 2` without a reload. In the strip the album is still in the **same position** (third): renaming does not reorder.
- Cancelling and reopening shows the current name again, not the abandoned edit.

## ALB-11 Removing items from an album

**Steps**

1. Open `QA Trip`, select `tiny.gif` and `alb-up.png`. Read the bar. Click `Remove` (recorder armed).
2. Open the viewer on `alpha.png` in the same album, `More options` › `Remove from album`.
3. Go to the library.

**Expected**

- Step 1: the bar has `Clear selection`, `2 selected`, `Add to album`, `Remove` and `Delete selected` (on the library page there is no `Remove`). One request, `DELETE /api/albums/<id>/items` with `{"mediaIds":[…2 ids…]}`, answered `{"removed":2}`; toast `Removed 2 items from "QA Trip"`; the two tiles leave the album page, the selection clears, the strip card shows `2 items`.
- Step 2: `Removed 1 item from "QA Trip"`; the viewer moves to a neighbour or closes (as DEL-08 describes for delete); the album now holds only `exif-photo.jpg`.
- Step 3: all three items are still in the library, and `QA Picks` is unchanged. In the database the `album_media` rows are really removed (links are hard-deleted), the media rows are untouched and `deletedAt` is null. Re-add `alpha.png`, `tiny.gif` and `alb-up.png` to `QA Trip` for the next cases (ALB-04's way).

## ALB-12 Deleting an album

**Steps:** open `QA Holidays 2`, `Album options` › `Delete`. Read the dialog and click `Cancel`. Open it again and click `Delete album` (recorder armed). Then open the old address `/photo-video/albums/<its id>`.

**Expected**

- The dialog is titled `Delete "QA Holidays 2"?` with `The album is deleted. Its photos and videos are kept in your library.` and buttons `Cancel` / `Delete album` (a spinner on it while the request runs).
- `DELETE /api/albums/<id>` answered 204; toast `Album deleted` with the description `Its photos and videos are still in your library.`; the app goes to `/photo-video/albums`, where the album is gone, and the strip no longer shows it.
- In the database the album row has `deletedAt` set and its `album_media` links are still there (soft delete); the media rows are untouched.
- The old address shows a not-found page (`Album not found`), because a deleted album is invisible. Every item the album held is still in the library afterwards (the standard set must be whole before going on).

## ALB-13 Download

Do **not** let the browser save a file; the case intercepts the click.

**Steps**

1. On the album page of `QA Trip` replace `HTMLAnchorElement.prototype.click` so it records `href` and `download` and does not call the original. Choose `Album options` › `Download`. Restore it.
2. From the page, `fetch('/api/albums/<id>/download')` and read the response and its bytes.
3. Do step 2 for an album with no items (create `QA Empty` through the API for this).

**Expected**

- Step 1: one recorded click on an anchor whose `href` ends `/api/albums/<id>/download` with a `download` attribute; the page did not navigate.
- Step 2: 200, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="QA Trip.zip"; filename*=UTF-8''QA%20Trip.zip`, `Cache-Control: private, no-store`. The bytes start with `PK`; the file names of the album's items appear in them (as plain text, the entries are stored, not compressed) **twice each** (the local file header and the central directory), the first occurrence of each in order of `takenAt`, oldest first (`exif-photo.jpg` before the others); the body is at least as large as the sum of the items' sizes.
- Step 3: 404 with the message `This album has no photos or videos`. On the page the `Download` of an empty album would start a download that fails; nothing else happens.

## ALB-14 Previews match the data

**Steps:** compare the strip and albums page cards with `GET /api/albums` for the same albums: the number of stacked frames, the count in the subtitle.

**Expected:** a card has `min(3, count)` frames; the subtitle count equals `count`; an item without a thumbnail shows an image or video icon in its frame instead of a picture. Covers and the fallback rules are checked at the API in ALA-08.

## ALB-15 An item deleted from the library leaves its albums

**Steps:** make `alb-del.png` as a real item (see "Real items without the dialog") and add it to `QA Trip` through the dialog; note `QA Trip`'s count; delete `alb-del.png` from the library with select mode (DEL-05 way).

**Expected:** on the library page the strip card of `QA Trip` has one item fewer straight away (it refreshes after a delete); the album page no longer lists it; `GET /api/albums/<id>/media` no longer returns it. In the database the media row has `deletedAt`, the `album_media` link still exists, and the album's `count` ignores it.

## ALB-16 Unknown albums and signed out

**Steps:** open `/photo-video/albums/not-a-real-id` and the address of an album that belongs to account A of [02-api.md](02-api.md) (get an id from the database). Then, with a request, `GET /photo-video/albums/<id>` with no cookies.

**Expected:** both pages show a not-found error (HTTP 404, message `Album not found`), A's album name appears nowhere. Without a session the answer is a redirect (303) to `/sign-in`. (The album page is served `Cache-Control: private, no-store`, see RES-04.)

## ALB-17 The album screens on a phone

**Needs:** phone preset (375 × 812), albums `QA Picks` and `QA Trip` with photos, one album with none. Reset the viewport at the end.

**Steps:** on the desktop preset (1440 × 900) open `/photo-video` and run `document.documentElement.scrollWidth` and `document.documentElement.clientWidth`. Then switch to the phone preset, open `/photo-video`, read the strip. Open `/photo-video/albums`. Dispatch a touch `pointerdown` then `click` on a card with photos (once), then once more. Read the two document widths again on the phone.

**Expected**

- At 1440 px and at 375 px the page does not scroll sideways: `scrollWidth` is at most `clientWidth`. (The strip's row used to end 8 px past the page at 1440 px; it now stops at the layout's padding.)
- The first card keeps its frames in view. With a card with three photos first in the strip (create one if the newest album has none), at 1440 px (and at 1024 px, where the sidebar is still there) and at rest, no `.frame` of that card starts left of the sidebar's edge (`getBoundingClientRect().left` of each frame is at least 256), and the hovered fan (real mouse over the card) does not lose its left frame or the shadow to the clip either. On the phone (375 px, no sidebar) every frame starts at 0 or more, at rest and after the first touch tap (`data-fanned="true"`). The strip row has a start padding of 32 px (`ps-8`), 56 px from the `sm` breakpoint (`sm:ps-14`), with the same `scroll-ps`, so the first card sits at x = 312 on desktop (strip row at 256) and at x = 32 on the phone, and scrolling to the end and back returns it there. (Run 2026-10-18 after the padding change, passes: at 1440 and at 1024 the strip row starts at x = 256, padding 56 px, first card at x = 312; frames at rest start at 287.3 (left), 333.1 (front), 349.2 (right); hovered 260.4, 326.5, 371.3, so at least 4.4 px clear of the sidebar, and the faint dark shadow of the left frame reaches about the sidebar's edge. On the phone the first card is at x = 32, frames at 18.5 at rest and 3.9 after the first tap (they were at 2.5 and -12 before). Wheel scroll snapped card 2 to x = 56 inside the row; at the end `scrollLeft` = 712 = max with the last tile ending at 1424 of 1440; back at 0 the first card is at x = 312 again. Page width equals the viewport at 1440, 1024 and 375.)

- Strip cards are 144 px wide, snap to the start when scrolled, and the row is the only thing that scrolls sideways; the page itself does not (document width = viewport width).
- The albums page has two columns of cards. Its first card keeps its frames in view like the strip's: the card grid (and the loading skeleton grid) has a start padding of 16 px (`ps-4`), 24 px from `sm` (`sm:ps-6`), on top of the page's 16 px, so at 1440 px (sidebar 256 px wide) the first card is at x = 296 and every `.frame` of a card with three photos starts at 256 or more, at rest and with a real hover; on the phone the first card is at x = 32 and every frame starts at 0 or more, at rest and after the first touch tap. (Run 2026-10-18 after the padding change, passes: 1440 px: five columns of 174.4 px, grid at x = 272, first card at 296, frames at rest start at 279.7 (left), 310.0, 320.6, hovered 261.9, 305.6, 335.2; 1024 px: four columns of 130 px, frames at rest 283.8, hovered 270.6; 375 px: two columns of 155.5 px, first card at x = 32, frames at 17.4 at rest, 1.6 after the first tap, which fanned it without leaving `/photo-video/albums` (`data-fanned="true"`); the second tap went to the album's page. Zoom screenshots at 1440 and 1024 and a full screenshot at 375 show nothing cut. Page width equals the viewport at all three sizes. The loading skeleton, caught by delaying `GET /api/albums` by 6 s on client-side navigation, has the same classes, 10 tiles, a start padding of 24 px and its first tile at x = 296 at 1440 px. Before the change the same card was at x = 272 with its left frame at 255.2 at rest and 237 hovered, about 19 px under the sidebar.)
- The first touch tap on a card with two or more photos only fans the stack (`data-fanned="true"`, navigation prevented); the second tap follows the link. Blurring the card puts the stack back. A card with one photo or none follows the link at once.
- On an album page the bar with a selection has icon-only `Add to album` and `Remove` (accessible names unchanged), see DEL-13.

## ALB-18 Deleting from the viewer inside an album: next, previous, close

**Steps**

1. Create `QA Last` through the API and two real items `last-1.png` and `last-2.png` (distinct `takenAt`, `last-2` newer) linked into it by completing the uploads with `{albumId}`. Open the album page; the order is `last-2.png`, `last-1.png`.
2. Open `last-1.png` (the last one), `More options` › `Delete` › `Delete`.
3. Delete the item the viewer now shows the same way.
4. Click `Photo & video` in the sidebar. The album page has no strip, so the strip is read only from here.

**Expected**

- Step 2: the viewer stays open and shows the **previous** item `last-2.png` (there is no next one). The grid behind has one tile.
- Step 3: the viewer **closes** (nothing is left), the toast is `Deleted`, and the page shows `This album is empty`.
- Step 4: the strip card `QA Last` shows `No items`.
- Both are soft deletes (`deletedAt` set, objects kept).
