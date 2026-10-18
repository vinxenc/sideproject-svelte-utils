# 11 · Gap review, not automated, not verified

What the suite missed and now covers, what an agent cannot run, and what has never been run. Report the manual items as `SKIPPED` with the reason, never as `PASS`. This file is a reference page: it is not run in order.

## Gap review

The suite was written when the app stood at Phase 4 of [docs/gallery-plan.md](../docs/gallery-plan.md). This review compared it with the app as it is now (routes, components, API handlers, `AGENTS.md`).

### Not covered before, covered now

| Area                                                                                                   | Cases                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Real routes (`/photo-video`, albums, `/passwords`), nav                                                | SET-05 to SET-07, notes in [00-setup.md](00-setup.md)                                                                                  |
| Email-code sign-up, 403 until verified, hardening                                                      | SET-06 and "QA accounts" in [01-test-data.md](01-test-data.md), VER-01 to VER-10 in [16-auth-verification.md](16-auth-verification.md) |
| Soft delete (rows and objects stay)                                                                    | API-09, DEL-05, DEL-09, ALB-12, ALB-15, ALA-10, PWA-05, CLN-02, CLN-03                                                                 |
| Phase 5: select mode, selection bar, bulk delete, viewer delete                                        | DEL-01 to DEL-13 in [12-delete.md](12-delete.md), API-09, LBX-09                                                                       |
| Phase 6: album strip, list, create, rename, delete, download, add/remove, covers, upload into an album | ALB-01 to ALB-18 in [13-albums.md](13-albums.md), EMP-04 to EMP-06                                                                     |
| `/api/albums` contract, ordering by `createdAt`, keyset paging, ownership                              | ALA-01 to ALA-12 in [14-albums-api.md](14-albums-api.md)                                                                               |
| Password vault (Phase 1) and its API                                                                   | PWD-01 to PWD-11, PWA-01 to PWA-07 in [15-passwords.md](15-passwords.md)                                                               |
| Service worker rules for albums and passwords                                                          | RES-02 and RES-04 in [09-resilience.md](09-resilience.md)                                                                              |
| Phone layout of the new screens                                                                        | DEL-03, DEL-13, ALB-17, PWD-11 (pointed to from MOB-05)                                                                                |

### Existing cases that were untrue and are fixed

- Item JSON has eight keys (`width` and `height` too): API-02, UPL-04, ALB cases.
- The viewer has `Back` and a `More options` menu, no `Close`: the labels paragraph of file 07, LBX-04.
- No `Settings ›` crumb; titles and addresses come from real routes: SET-07, MOB-01, MOB-02.
- MOB-01 described the removed 2x2 mosaic; the grid is masonry. MOB-03 said the dialog footer is stacked on a phone; it is one row.
- GAL-01: each tile is followed by its `Select <name>` button, so the Tab stops alternate.
- Sign-up no longer signs the browser in: SET-06 and every case that said "sign up with `POST /api/auth/sign-up/email`".
- The cleanup assumed rows and objects disappear; it now covers soft-deleted rows, `verification` rows, Mailpit mail and the new tables.

### Written from the code only, never executed

Everything added in this update: EMP-04 to EMP-06, API-09 and the changed lines of API-01, API-02 and API-05, LBX-09, DEL-01 to DEL-13, ALB-01 to ALB-18, ALA-01 to ALA-12, PWD-01 to PWD-11, PWA-01 to PWA-07, VER-01 to VER-10, RES-04, MOB-05, the new SET-06, CLN-02, CLN-03. Expect the first run to find wording and selector slips; fix the case text in the same change (see "Keeping these files true"). First run, part 1 (production preview, 1440 × 900 and 375 × 812): EMP-04 to EMP-06, API-09, DEL-01 to DEL-13, VER-01 to VER-10 and MOB-05 were executed and pass, after the wording fixes made in that run, and LBX-09 was executed and fails (see "Where the plan and the code disagree"); ALB, ALA, PWD, PWA and RES-01 to RES-04 were executed in part 2 (2026-10-18): all pass except ALB-05 (see below); the wording fixes of that run are in the case files.

Checked live while writing: the Mailpit API (`/api/v1/search?query=to:<email>` and `/api/v1/message/<id>` with the code in `Text`), the seeding SQL (in a rolled-back transaction; Postgres 18 has `uuidv7()`), and the table and column names. Not checked: deleting Mailpit messages by search (CLN-02 step 5), the exact rate-limit numbers (taken from README.md, "Email OTP"), `DELETE /api/media` with one id from the viewer and the removal of `DELETE /api/media/[id]` (that change was being made while these cases were written; API-09 and DEL-08 describe the intended final behaviour; the change is in and both pass).

### Where the plan and the code disagree (for the owner to decide)

- Phase 9 of the plan says another user "gets 404" when deleting someone's media; the code answers 200 `{"deleted":0}` and leaves the item alone (API-05, API-09, ALA-11 test the code).
- Album covers: nothing in the app or the API sets `coverId`; only the database does, so covers are tested through SQL (ALA-08).
- `/photo-video/albums` sets two page titles (layout and page); EMP-05 records which one wins instead of asserting.
- `/dashboard`, `/photo-video` and `/sign-in` are cached by the service worker with the signed-in user's name and email in their layout data (RES-04 records it). `/passwords` and album pages are `no-store`.
- An album download that contains an item whose object is missing fails mid-stream instead of skipping the file (by design, ALA-09).
- Phase 1 of the vault stores passwords as plain text (PWA-07 records it).
- LBX-09 step 4 fails on a real key press sent right after choosing `Delete` in the viewer menu: for about 60 ms the confirmation is rendered but focus is still on the viewer's menu trigger, so `onkeydown` in `media-lightbox.svelte` lets ArrowRight through, the viewer moves on and the open confirmation names the next item. With a pause of 0.4 s or more the key is ignored as the case expects. Fixed afterwards in `media-lightbox.svelte` (the handler now checks `confirmOpen`); the re-check passed (real key presses right after the click, and synthetic keydowns in the same tick and 15, 40 and 80 ms later).
- ALB-05 fails the same way for the album picker: a real ArrowRight sent right after choosing `Add to album` in the viewer menu (the dialog is in the DOM about 10 ms after the click and takes focus only after about 40 ms) moves the viewer to the next item while the dialog stays open, and the dialog then adds the item it was opened for, not the one shown. The handler only knows `confirmOpen`, not the album dialog. With a pause of about a second the key is ignored. Fixed afterwards: the gallery passes `keysPaused={pickerOpen}` to the viewer, which ignores the arrow keys while it is set. Unit tests cover it; the real-key browser re-check of ALB-05 passed (ArrowRight sent 34 to 37 ms after the click, with the dialog already in the DOM and focus not yet in it: the footer kept the same name, and the dialog added the item it was opened for; arrows work again after the dialog is closed).
- At 1440 px the `Photo & video` page can be scrolled 8 px sideways: the album strip's `-mx-6` row ends at x = 1448 (`documentElement.scrollWidth` 1448). The phone layout is fine (ALB-17).

## Needs a person or a device

| Item                                           | Why it cannot be automated, and what to look at                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `Library` button (UPL-12)                  | It opens the operating system's file picker. Check that it opens, that choosing several photos and videos adds cards, that cancelling the picker changes nothing, and that choosing the same files again works.                                                                                                                                                            |
| The real camera (UPL-13, UPL-14)               | The cases fake the camera stream. With a real webcam check that the picture is live and sharp, that a photo and a recording come out as seen and with sound, and that the camera light goes off after `Done`. On a phone check the permission prompt (including the installed PWA) and that the photo or video lands in the list.                                          |
| A real drag and drop of files from the desktop | Synthetic events (UPL-09) show the handler works, but not the browser's own default of opening a dropped file. Drop a photo on the dialog: cards appear and the page is not replaced by the photo. Drop one outside the dialog to see what the browser does there (it will open the file).                                                                                 |
| Real HEIC / HEIF photos                        | Chrome usually cannot decode them (the plan expects no thumbnail there): expect a placeholder tile and "This browser can't show the original" in the viewer. Safari can: expect a thumbnail and the photo.                                                                                                                                                                 |
| Real iPhone videos (`.mov`, HEVC)              | Needs the real files. Check the poster, the duration badge and playback in Safari and in Chrome.                                                                                                                                                                                                                                                                           |
| Safari and iOS                                 | JPEG thumbnails (the reason thumbnails are JPEG), upload progress, infinite scroll, the phone menu, installing the app. Nothing has been run in Safari so far.                                                                                                                                                                                                             |
| Offline                                        | Plan Phase 9: load the dashboard and the gallery, switch the browser to offline, reload. The dashboard should still load from the service worker; media requests should fail without breaking the page.                                                                                                                                                                    |
| Light theme                                    | The suite only looked at the dark theme. Check the dialog cards, their overlay text, the tiles and the viewer in light mode.                                                                                                                                                                                                                                               |
| The size limits with real bytes                | API-04 checks the limits by declared size only. A real 50 MB photo and a real 1 GB video exercise the whole path but take long; do them once by hand if the limits change.                                                                                                                                                                                                 |
| Real finger gestures on a phone                | Swiping a password row to show its trash tile, swiping the tab strip, press and hold on a tile to start selecting, the first-tap fan of an album card. The cases check scroll positions, computed styles and synthetic pointer events; a real finger on a real phone is the only proof that the gesture feels right and does not scroll the page or open the browser menu. |
| An album ZIP saved by a real browser           | ALB-13 and ALA-09 read the bytes from the page. Click `Download` once by hand: the browser should save `<album name>.zip`, which unzips to the photos and videos with the right names. Try an album of a few hundred MB to see that memory stays flat.                                                                                                                     |
| Real mail                                      | The sign-up code goes to Mailpit only. With a real SMTP provider check delivery, the sender and that the mail does not land in spam.                                                                                                                                                                                                                                       |
| Password manager and autofill                  | The sign-up, sign-in and add-password forms with the browser's or a manager's autofill and password generator (the vault's fields turn autofill off on purpose).                                                                                                                                                                                                           |
| A video that never loads                       | The preview step gives up on a video after 10 seconds. A file chooser cannot produce a source that never answers, so this timeout is only checked by reading `src/lib/media/prepare.ts`.                                                                                                                                                                                   |

## Never run

- The gallery on the dev server (`pnpm dev`, port 5173). The suite uses the production preview only; a dev run could expose differences in server-rendering or the service worker (which only exists in production).
- A second browser (Firefox) and other operating systems.
- Keyboard-only use of the dialog, the viewer, the selection bar and the vault beyond what the cases say (tab order, focus return after closing).
- Safari, Firefox and a physical phone for any of the new screens (select mode, album strip, vault).

## Not built (no cases until they exist)

- Phase 2 of the password vault: encryption at rest and the passkey gate on reveal ([docs/password-management-plan.md](../docs/password-management-plan.md)). When it lands, change PWA-07, add cases for the passkey prompt and for a user without a passkey, and keep PWA-04 and PWD-05 true.
- Editing an entry, a copy button, undo after delete and auto-hide of a revealed password (out of scope of Phase 1).
- Changing an album's cover (nothing sets `coverId` yet), paging of the password list, restoring soft-deleted items and a trash view, a real purge job for soft-deleted rows and their objects.
- Password reset and the `Forgot your password?` link, the GitHub buttons on the sign-in and sign-up forms (they do nothing), the dashboard sections that are still placeholders.
- README updates listed in Phase 8 of the gallery plan.

## Keeping these files true

The rule is in `AGENTS.md`: a change is not done until the matching cases in this folder are added or fixed in the same change, and the coverage and Files tables in [README.md](README.md) are up to date. Run a case again after changing the part of the app it covers. When a case and the app disagree, report it as a failure; the owner decides whether the app or the case is out of date.
