# Browser test cases

Plain-language test cases for the app's pages: sign-up with an email code, the Photo & video library (upload dialog, masonry grid, full-screen viewer, select and delete), albums, and the password vault. They are written for an AI agent that runs them by itself in a real browser on this machine. The agent reads a case, drives the browser with its own tools, compares what it sees with **Expected** and reports. There are no scripts in this folder on purpose: each case says what to prepare, what to do and what must happen.

The cases describe the app as it is now: the gallery plan ([docs/gallery-plan.md](../docs/gallery-plan.md)) through Phase 6 (delete and albums), the password vault of [docs/password-management-plan.md](../docs/password-management-plan.md) Phase 1, soft delete and the sign-up email code. [11-manual-and-gaps.md](11-manual-and-gaps.md) says what was missing before, which cases were only written from the code and have not been run yet, and what stays manual. **A change to the app is not done until these cases are updated with it** (the rule is in `AGENTS.md`).

## How to run

1. Read this file, then [00-setup.md](00-setup.md) and [01-test-data.md](01-test-data.md).
2. Run the files in this order: **00, 02, 03, 04, 05, 06, 07, 08, 12, 13, 14, 15, 16, 09, 10**. (01 and 11 are reference pages, not run.) The numbers of 12 to 16 are higher than 09 and 10 on purpose: 09 includes the final console audit and the service-worker checks that need the pages of 12 to 16 to have been used, and 10 is the cleanup and must be last. Each case lists what it **Needs** (state left behind by earlier cases); the order is chosen so those needs are met. [02-api.md](02-api.md) uses its own two accounts, A and B, through a plain HTTP client, never the browser's account, so that the browser account is still empty when [03-empty-and-loading.md](03-empty-and-loading.md) starts; [14-albums-api.md](14-albums-api.md) and [15-passwords.md](15-passwords.md) (its PWA cases) reuse A and B, so keep their cookie jars. [16-auth-verification.md](16-auth-verification.md) signs the browser in as other accounts and ends by signing it back in as the main QA user.
3. For every case do the steps, compare with **Expected** and record `PASS`, `FAIL` or `SKIPPED` with a short note of what you actually saw (texts, counts, sizes). Take a screenshot only where a case asks for one, or to show a failure.
4. Use a desktop-sized window unless a case says otherwise: set 1440 × 900 (`resize_window`), where the masonry grid has four columns. The grid switches by the width of its own container (the window minus the 256 px sidebar and the page padding): four columns from 900 px of container, which needs a window of about 1200 px; a 1000 to 1100 px window gets three.
5. A failed setup step stops the run. A failed test case does not: note it and carry on with the cases that do not depend on it.
6. Always finish with [10-cleanup.md](10-cleanup.md), even after failures. Case ids keep their file's prefix, so a failed id tells you where to look: SET, EMP, UPL, GAL, BG, LBX, MOB, RES, API, DEL, ALB, ALA, PWD, PWA, VER, CLN.
7. Print the report in the terminal (format at the end). Do not write it into the repo.

## Rules

- **Production preview on port 4173 only.** Before starting, stop whatever is _listening_ on 4173 and 5173 (listeners only, never a browser's own connections), then start the preview. Never use another port and never run `pnpm dev` for these cases.
- **Throwaway accounts only.** Every write (sign-up, upload, album, password) uses a QA account made for this run, with an email like `qa-<label>-<8 random hex>@example.test`. Sign-up needs the email code, which the agent reads from the local Mailpit (`http://localhost:8025`); see "QA accounts" in [01-test-data.md](01-test-data.md). Nothing is ever delivered to a real mailbox. This is a real browser on a real machine, so it may already be signed in to the app as the owner's own account. Before the first write, look at who is signed in (`GET /api/auth/get-session` returns the current user). If it is not a `qa-…@example.test` address, stop and ask the user. Never test on a real account and never touch its media.
- **Delete only what you created:** the QA accounts this run made (keep their ids), everything they own (media, albums, passwords, soft-deleted rows included), their objects in the bucket, their sign-up code rows and their mail in Mailpit. The app only soft-deletes, so the cleanup removes data by user id in the database and by prefix in the bucket; see [10-cleanup.md](10-cleanup.md). A `qa-…` account you did not create (an earlier or a concurrent run) is not yours: report it and never delete it without the user's say-so. Nothing else, ever.
- Do not print passwords or anything from `.env`. Do not change app code or commit anything while testing; report failures instead.
- Everything runs against the local Docker services (Postgres, RustFS and Mailpit), see [00-setup.md](00-setup.md).
- Rate limits are real: 3 sign-ups or sign-ins per 10 seconds and 3 email-code calls per minute for the whole machine. Pace account creation and treat a `429` as "wait 60 seconds", not as a failure ([01-test-data.md](01-test-data.md), "Pacing").

## Browser tools

Any browser the agent can drive works. These two are available in Claude Code:

| Need                          | Built-in browser pane (`mcp__Claude_Browser__*`)                                                      | Claude in Chrome (`mcp__claude-in-chrome__*`)    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Open a page                   | `navigate`; `preview_start` with the `preview` entry of `.claude/launch.json` (never the `dev` entry) | `navigate`, `tabs_create_mcp`                    |
| Run JavaScript in the page    | `javascript_tool`                                                                                     | `javascript_tool`                                |
| Click, type, keys, scroll     | `computer`                                                                                            | `computer`                                       |
| Find an element / read a page | `find`, `read_page`, `get_page_text`                                                                  | `find`, `read_page`, `get_page_text`             |
| Phone / desktop viewport      | `resize_window`                                                                                       | `resize_window`                                  |
| Console and network           | `read_console_messages`, `read_network_requests`                                                      | `read_console_messages`, `read_network_requests` |
| Attach real files to an input | not available (build the files in the page instead)                                                   | `file_upload`                                    |
| Read the sign-up mail         | the shell (`curl http://localhost:8025/api/v1/...`), never `fetch` from the page (another origin)     | the shell, same                                  |

Prefer running JavaScript in the page for exact checks (counts, computed styles, request bodies) and use screenshots for what is visual. Claude in Chrome drives the owner's real profile, so the signed-in check in the Rules matters most there.

## Things that cause false failures

- **A hidden browser pane.** The built-in pane is usually reported as `visibilityState: hidden`. Then `IntersectionObserver` (the infinite-scroll trigger) never fires and CSS exit animations do not progress, so a dialog or the phone menu still looks open right after it was closed. Taking any screenshot wakes the pane. Work in short steps: do the action, take a small screenshot, then read the state in a separate call. Real Chrome does not have this problem.
- **The JavaScript tool gives up after 45 seconds.** A loop that waits longer (infinite scroll to the end of 680 tiles, a long upload) must not be awaited: start it without `await`, store its result on `window`, and poll it from short calls. A call that timed out may still be running in the page.
- **Toasts are short-lived.** Success and failure toasts disappear after about 4 seconds, and the dialog's exit animation can stall in a hidden pane, so "wait until the dialog is gone, then read the toast" often misses it. Arm a DOM observer for toast text before the action (or poll right after it). The "Try again" toast for a failed load is the exception: it stays until used or dismissed.
- **Clicks by coordinates are unreliable** in the phone-sized viewport. Click by element reference (`find`/`read_page`) or call the element's `click()` from the page.
- **A full page load wipes what you stashed in the page** (fault injection, observers, helpers). Client-side navigation between the sidebar pages does not. Re-arm after any `navigate` or reload.
- **`fetch()` of a thumbnail URL that an `<img>` already loaded can fail with a CORS error** (the cached no-cors response has no CORS headers). Read an image's size from the `<img>` element or fetch before it is shown. This is a test artefact, not an app bug.
- **The native file picker cannot be driven.** The dialog's hidden file input can be given files from the page, see [01-test-data.md](01-test-data.md).
- **Controls that only exist on hover.** The round `Select <name>` button of a tile has no pointer events and is invisible until the tile is hovered or focused; a coordinate click at rest hits the tile instead. Hover first, or call the button's `click()` from the page.
- **`429` from the sign-up cases.** The sign-up, sign-in and code limits are per machine, not per account. Wait 60 seconds; do not retry in a loop.
- **Soft-deleted rows look alive in SQL.** A `SELECT` sees them; check `deletedAt`.
- **Stale service worker.** The production build registers a service worker. After a rebuild, remove old workers and caches before testing, see [00-setup.md](00-setup.md).

## Files

| File                                                                       | Cases   | What it covers                                                                                                     |
| -------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| [00-setup.md](00-setup.md)                                                 | SET     | Services, quality gate, ports, preview, clean browser, QA account with the email code, app shell                   |
| [01-test-data.md](01-test-data.md)                                         | -       | Files to prepare and the techniques the cases rely on (QA accounts, seeding, rate limits, touch)                   |
| [02-api.md](02-api.md)                                                     | API     | The `/api/media` contract: auth, uploads, validation, isolation, paging, redirects, purge, bulk delete             |
| [03-empty-and-loading.md](03-empty-and-loading.md)                         | EMP     | Brand-new account: empty grid, loading skeleton, failed first load, empty album strip and albums page              |
| [04-upload.md](04-upload.md)                                               | UPL     | The upload dialog from picking files to stored data and thumbnails                                                 |
| [05-gallery.md](05-gallery.md)                                             | GAL     | The populated grid: masonry, tiles, image loading, infinite scroll, new uploads                                    |
| [06-upload-failure-and-background.md](06-upload-failure-and-background.md) | BG      | Failed uploads, retry, hiding the dialog, leaving the page, signing out                                            |
| [07-lightbox.md](07-lightbox.md)                                           | LBX     | The full-screen viewer and its `More options` menu                                                                 |
| [08-mobile.md](08-mobile.md)                                               | MOB     | Phone-sized viewport (the new screens have their own phone cases in 12, 13 and 15)                                 |
| [09-resilience.md](09-resilience.md)                                       | RES     | Old thumbnails, service worker (media, albums, passwords, no-store pages), console and network audit               |
| [10-cleanup.md](10-cleanup.md)                                             | CLN     | Remove everything the run created: accounts, soft-deleted rows, objects, code rows, mail                           |
| [11-manual-and-gaps.md](11-manual-and-gaps.md)                             | -       | Gap review, what an agent cannot automate, what is not verified, what is not built                                 |
| [12-delete.md](12-delete.md)                                               | DEL     | Select mode, selection bar, bulk delete in one request, viewer delete, soft delete (Phase 5)                       |
| [13-albums.md](13-albums.md)                                               | ALB     | Album strip, albums page, create, add, remove, rename, delete, download, upload into an album (Phase 6)            |
| [14-albums-api.md](14-albums-api.md)                                       | ALA     | The `/api/albums` contract: auth, names, order by `createdAt`, paging, items, media, previews, download, ownership |
| [15-passwords.md](15-passwords.md)                                         | PWD PWA | The password vault page and its API: add, tabs, search, reveal, delete, no-store, isolation                        |
| [16-auth-verification.md](16-auth-verification.md)                         | VER     | Sign-up with an email code, resend, unverified sign-in, narrowed auth API, re-claim, rate limits                   |

## Coverage of the plans' Phase 9 checklists

Gallery plan, Phase 9:

| Phase 9 item                                                        | Cases                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm check && pnpm lint && pnpm build`                             | SET-02 (also `pnpm test:cov`)                                                                |
| Production preview on :4173, no port switching                      | SET-03, SET-04                                                                               |
| Upload JPEG with EXIF rotation and a date taken                     | UPL-06                                                                                       |
| Upload PNG and GIF                                                  | UPL-02, UPL-03, UPL-05                                                                       |
| HEIC on Chrome (no thumbnail) and on Safari                         | UPL-02 and UPL-04 with a fake `.heic`; real HEIC and Safari: manual                          |
| Upload MP4 and MOV                                                  | UPL-02 to UPL-05 (WebM recorded in the page; real MP4/MOV optional)                          |
| A file over the size limit and a disallowed type are rejected       | UPL-02, API-04                                                                               |
| Pagination past 60 items                                            | GAL-06, API-06, ALA-03, ALA-07, ALB-07                                                       |
| Lightbox previous/next and video playback                           | LBX-01 to LBX-06, LBX-09                                                                     |
| Single and bulk delete                                              | DEL-01 to DEL-13, API-09                                                                     |
| Album create, add, filter, remove, rename, delete                   | ALB-01 to ALB-12, ALB-18, ALA-02 to ALA-10                                                   |
| A second user cannot list, view, delete or add another user's media | API-05, API-09 (delete answers 200 with nothing deleted, see the gap review), ALA-05, ALA-11 |
| Offline: the dashboard loads, media fails without breaking it       | manual, see [11-manual-and-gaps.md](11-manual-and-gaps.md)                                   |

Other areas the plans or the code define:

| Area                                                              | Cases                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Routes, nav (Passwords after Photo & video), signed-out redirects | SET-05, SET-07, VER-06                                         |
| Sign-up with an email code, unverified sign-in, rate limits       | SET-06, VER-01 to VER-10                                       |
| Soft delete (`deletedAt`, objects stay), safe purge               | API-09, DEL-05, DEL-09, ALB-12, ALA-10, PWA-05, CLN-02, CLN-03 |
| Album covers, previews, counts, album download                    | ALB-13, ALB-14, ALA-08, ALA-09                                 |
| Upload straight into an album                                     | ALB-09, ALA-12                                                 |
| Password vault Phase 1 (add, list, tabs, search, reveal, delete)  | PWD-01 to PWD-11, PWA-01 to PWA-07                             |
| Service worker never caches media, albums or passwords            | RES-02, RES-04                                                 |
| Mobile layout (selection bar, album screens, vault)               | MOB-01 to MOB-05, DEL-03, DEL-13, ALB-17, PWD-11               |

## Real-phone cases (waiting for the owner's setup)

Two cases cannot be run by an agent in the in-app browser and are reported `SKIPPED` until the owner has set up a phone the agent can drive:

| Case                                              | What needs the real phone                                                                                                                          | Where it is written down                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| UPL-12, the `Library` button (native file picker) | The picker is the operating system's, so an agent can only see its result: cards added after choosing photos and videos, nothing after cancelling. | [04-upload.md](04-upload.md) UPL-12 (the checks to make), [11-manual-and-gaps.md](11-manual-and-gaps.md)                             |
| UPL-14, the `Camera` button on a phone            | A real camera, the permission prompt (also in the installed PWA), a page served over HTTPS and storage the phone can reach.                        | [04-upload.md](04-upload.md) UPL-13 and UPL-14, [debt/phone-camera-tunnel-test.md](debt/phone-camera-tunnel-test.md) (HTTPS tunnels) |

Status: **parked.** The owner will set up the phone and the access an agent needs (the debt plan above is one way: tunnels for the app and the storage). Until then:

- Do not try to run UPL-12 or UPL-14 on the desktop browser or an emulated phone; UPL-13 already covers the camera logic with a faked stream. Report both as `SKIPPED` with the reason "needs the owner's real phone".
- When the setup exists, add its steps (how the agent reaches the phone, which tools drive it, how the QA account and cleanup work there) to this section, rewrite UPL-12 and UPL-14 so an agent can run them, and delete `debt/phone-camera-tunnel-test.md` once a phone run has passed.

Out of scope on purpose: a browser run of "a second user cannot delete someone else's media". API-05, API-09 and ALA-11 and the unit tests cover it at the API; no browser case is planned.

## Report format

Print one table, one row per case, then a short list of every failure with what was expected and what was seen:

| Case   | Result | Evidence                                      |
| ------ | ------ | --------------------------------------------- |
| UPL-03 | PASS   | 9 items added, at most 3 uploads in flight    |
| BG-02  | FAIL   | Review button missing after the failure toast |

End with the totals (passed, failed, skipped) and the cleanup result (counts back to the baseline recorded in SET-01).
