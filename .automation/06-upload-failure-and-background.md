# 06 · Failed uploads, hiding the dialog, leaving the page

How the dialog and the app behave when an upload fails, when the dialog is hidden while uploading, and when the user leaves the page or signs out. The uploads and their outcome belong to the page, not to the dialog: they keep running without it and are announced when the last one ends.

**Needs for the whole file:** SET-01 to SET-07, the QA account signed in, the browser on `Photo & video`. Use small solid-colour PNGs (a few bytes each) for every upload here. Arm the toast observer before each case and restore `fetch` / `XMLHttpRequest` at the end of each case (see Techniques in [01-test-data.md](01-test-data.md)).

What the outcome toasts look like:

| Outcome                     | Toast                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everything uploaded         | `Added 1 item to the gallery` / `Added N items to the gallery`                                                                                             |
| Some failed (dialog closed) | `1 upload failed` / `N uploads failed`, description `M added to the gallery` when some succeeded, action `Review` when there is a dialog to review them in |

## BG-01 One upload fails with the dialog open, then Retry

**Steps**

1. Choose two PNGs, `a.png` and `b.png`.
2. Make the first `POST /api/media/<id>/complete` answer HTTP 500 with the JSON `{"message":"boom"}`; every other request passes through. Count calls before waiting (see Techniques).
3. Click `Submit (2)`. Wait until one card shows the error.
4. Click `Retry <name>` on the failed card (the interception must no longer fail anything).

**Expected**

- After step 3: the failed card shows `boom` in place of its size, the other card shows `Added · <size>` with a check mark. The dialog **stays open**. **No toast** appears (the cards already say it).
- The footer shows `Cancel` and `Submit (1)` (the failed card is still pending). The failed card has both `Retry <name>` and `Remove <name>` buttons.
- After the retry: the dialog closes by itself and the toast says `Added 2 items to the gallery` (the earlier success counts).
- Without a JSON `message` in the answer the card shows `Request failed (500)` instead of `boom`.

## BG-02 Hide the dialog while uploading, one upload fails, Review

**Steps**

1. Choose `a.png` and `b.png`. Make every `complete` call wait 2.5 seconds and make the second one then fail with HTTP 500 (`{"message":"late failure"}`).
2. Click `Submit (2)`, then immediately click `Hide`.
3. Watch the round button until the failure toast appears.
4. Click the toast's `Review` button.
5. Stop failing requests, click `Retry <name>` on the failed card.

**Expected**

- After `Hide`: the dialog closes; the round button keeps its spinner and its accessible name is `Uploading photos and videos`.
- When the failure lands: a toast `1 upload failed` with the description `1 added to the gallery` and a `Review` button; the round button goes back to the plus.
- After `Review`: the dialog opens with the finished card (check mark) and the failed card showing `late failure` with `Retry` and `Remove`; the footer reads `Cancel` and `Submit (1)`.
- After the retry: the dialog closes, the toast `Added 2 items to the gallery` appears and both items are in the grid.

## BG-03 Escape and the Close button act like Hide

**Steps:** choose one PNG, make `complete` wait 3 seconds, click `Submit`, and while it is uploading press the real Escape key. Repeat with the dialog's `Close` button.

**Expected:** the dialog closes right away (its state becomes closed), the round button still spins with the name `Uploading photos and videos`, the upload carries on, and about 3 seconds later the toast `Added 1 item to the gallery` appears and the button returns to `Add photos and videos`.

## BG-04 Leave the page while uploading, everything succeeds

**Steps**

1. Choose two PNGs, make every `complete` call wait 2 seconds, click `Submit`, click `Hide`.
2. Click `Home` in the sidebar right away and stay there.
3. After about 3 seconds click `Photo & video` again.

**Expected**

- On `Home`: no dialog, and no round button (it belongs to the gallery page).
- The toast `Added 2 items to the gallery` appears while you are on `Home`.
- Back on `Photo & video`: the list is loaded again and shows the two new items, the round button shows the plus (no spinner), the dialog is closed and, when opened, shows no cards.

## BG-05 Leave the page while uploading, one fails

**Steps:** as BG-04 but make the second `complete` fail with HTTP 500 after its wait. Stay on `Home` until the toast shows, then return.

**Expected**

- On `Home` a toast `1 upload failed` with the description `1 added to the gallery` and **no `Review` button** (there is no dialog to review in).
- Back on `Photo & video`: only the successful item is new; the failed file is not kept: the dialog opens empty and the round button is idle.

## BG-06 Leave the page with only a selection

**Steps:** open the dialog, choose a PNG (do not submit), click `Home`, then `Photo & video`, then open the dialog.

**Expected:** the dialog was gone while on `Home`; after returning it is closed, and when opened shows no cards with a disabled `Submit`.

## BG-07 Sign out with a selection

**Steps**

1. Open the dialog and choose two PNGs (do not submit).
2. Click `Sign out` in the sidebar footer. Wait for `/sign-in`.
3. Sign back in as the same QA user **without a full page load**: call `POST /api/auth/sign-in/email` from the page, then go to `/dashboard` through a client-side link (for example add `<a href="/dashboard">` to the page and click it). A `navigate` or reload starts a fresh page and would prove nothing.
4. Open `Photo & video` and the dialog.

**Expected:** signing out goes to `/sign-in`; after signing in again the dialog has no cards and `Submit` is disabled.

## BG-08 Sign out while an upload is finishing

**Steps:** choose one PNG, make `complete` wait 2.5 seconds, click `Submit`, wait about 0.7 s so the file has been sent, click `Hide`, then click `Sign out` straight away. Stay on `/sign-in` for a few seconds, then sign in again without a full page load (as BG-07) and open the dialog.

**Expected:** the app goes to `/sign-in`; when the delayed `complete` call is answered with 401 a toast `1 upload failed` appears (no `Review` button); after signing in again there are no leftover cards, the round button is idle, and nothing was added for that file.

## BG-09 The upload itself fails at the network level

**Steps:** choose `put-fail.png`, make the first `PUT` of an original go to a closed local port (see Techniques), click `Submit`, wait for the card to show an error, then click `Retry put-fail.png`.

**Expected**

- The card shows `Network error while uploading`; the dialog stays open; no toast; footer `Cancel` and `Submit (1)`; `Retry` and `Remove` buttons are on the card.
- After the retry the dialog closes and the toast `Added 1 item to the gallery` appears. The list shows `put-fail.png` exactly once (the failed attempt left a pending row on the server that is never listed).
