# 03 · Empty, loading and failed first load

What a brand-new account sees on `Photo & video` (`/photo-video`) before it has any media or albums. Run these **before** any upload: the account must have no media and no albums.

**Needs for the whole file:** SET-01 to SET-07 done, signed in as the new QA account with no media rows and no albums, and the browser on the dashboard.

## EMP-01 Empty state

**Steps**

1. Click `Photo & video` in the sidebar and wait for the list request to finish.
2. Inspect the grid area. Take one screenshot.

**Expected**

- Two square placeholder tiles in every column (eight tiles at 1440 px: four columns; three columns at about 1000 px, two in a phone-sized viewport, see GAL-01).
- The tiles are plain grey (muted background): no icon, no text, no image, **no pulsing animation** (the computed `animation-name` is `none`).
- No message panel and no inline "Try again" button. A visually hidden note reads `No photos or videos to show`.
- No toast.
- The round add button (accessible name `Add photos and videos`) is visible in the bottom-right corner.

## EMP-02 Loading state

**Steps**

1. Wrap `fetch` so the first `GET /api/media` waits about 2.5 seconds before it is sent on (see "Making a request fail or wait" in [01-test-data.md](01-test-data.md)).
2. Click `Home` in the sidebar, then `Photo & video` again.
3. While the request waits (about 0.5 s in), inspect the tiles. Then wait for it to finish and inspect again.

**Expected**

- While waiting: the same placeholder tiles, now **pulsing** (computed `animation-name` is `pulse`).
- After the list arrives (no items): the same tiles, no longer animated (`none`), and no toast.

## EMP-03 First list request fails

**Steps**

1. Wrap `fetch` so the first `GET /api/media` rejects like a network error (`Failed to fetch`).
2. Click `Home`, then `Photo & video`.
3. Wait for the toast, note its text, then keep watching for at least 4 seconds.
4. Click the toast's `Try again` button.

**Expected**

- A toast titled `Couldn't load your photos and videos`, with the description `Failed to fetch` and an action button `Try again`.
- Behind it: the plain grey placeholder tiles, not animated; no real tiles.
- The toast does **not** auto-dismiss: it is still there after more than 4 seconds.
- After `Try again`: a second list request is sent (two in total), the toast is gone, and the grid shows the same plain grey placeholder tiles again (the account still has no media).
- Restore `fetch` afterwards.

## EMP-04 No albums yet: the album strip

**Steps:** open `/photo-video` with a full page load and wait for the list request. Look at the `Albums` section above the grid. Take one screenshot.

**Expected**

- A heading `Albums` with a small round icon button named `New album` at its right (a `+`).
- While `GET /api/albums?limit=5` is on its way: five skeleton cards in a row (hold the request back with the wrapper of EMP-02 to see them). Afterwards exactly one dashed-frame tile labelled `New album` (a button, with a plus inside) and nothing else in the row: no album cards, no `All albums` tile.
- Clicking the tile opens the dialog `New album` (title, text `Give it a name. You can add photos and videos next.`, a field `Name`, buttons `Cancel` and a disabled `Create`). Press `Cancel`.
- The `Library` heading and the empty grid of EMP-01 are unchanged.

## EMP-05 No albums yet: the albums page

**Steps:** open `/photo-video/albums` through a full page load (the address, not a link). Record `document.title` as it is.

**Expected**

- A heading `Albums` (an `h1`), the icon button `New album` at its right, and an empty state: icon, title `No albums yet`, text `Create one, then add photos from Photo & video.` and a button `New album`.
- Ten skeleton cards (two per row on a phone, up to five on a wide screen) show while the first page loads, then disappear.
- The breadcrumb reads `Photo & video › Album` with `Photo & video` a link to `/photo-video`; the sidebar entry `Photo & video` is highlighted.
- Not asserted: the page sets its title twice (the layout says `Album · Utilities`, the page `Albums · Utilities`); report which one `document.title` shows.
- Clicking the empty state's `New album` opens the same `New album` dialog; `Cancel` closes it.

## EMP-06 The album strip fails to load

**Steps**

1. Wrap `fetch` so the first `GET /api/albums...` rejects like a network error.
2. Open `/photo-video` through client-side navigation (`Home`, then `Photo & video`).
3. Click `Try again` in the strip (the wrapper no longer fails anything).

**Expected**

- In place of the row: the text `Couldn't load your albums.` and a link-style button `Try again`; the `New album` icon button in the heading is still there. No toast. The library grid below loads normally and is not affected.
- After `Try again` a second request is sent and the strip shows the `New album` tile of EMP-04.
- Restore `fetch` afterwards.
