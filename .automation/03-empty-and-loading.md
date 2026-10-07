# 03 · Empty, loading and failed first load

What a brand-new account sees on `Photo & video` before it has any media. Run these **before** any upload: the account must have no media.

**Needs for the whole file:** SET-01 to SET-07 done, signed in as the new QA account with no media rows, and the browser on the dashboard.

## EMP-01 Empty state

**Steps**

1. Click `Photo & video` in the sidebar and wait for the list request to finish.
2. Inspect the grid area. Take one screenshot.

**Expected**

- Two square placeholder tiles in every column (four columns wide, two in a phone-sized viewport, see GAL-01).
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
- After `Try again`: a second list request is sent (two in total), the toast is gone, and the grid shows the four plain grey tiles again (the account still has no media).
- Restore `fetch` afterwards.
