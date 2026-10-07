# Browser test cases for the Photo & video gallery

Plain-language test cases for the gallery in the dashboard: the upload dialog, the masonry grid, the full-screen viewer and uploads that carry on in the background. They are written for an AI agent that runs them by itself in a real browser on this machine. The agent reads a case, drives the browser with its own tools, compares what it sees with **Expected** and reports. There are no scripts in this folder on purpose: each case says what to prepare, what to do and what must happen.

The cases describe the app as built through Phase 4 of [docs/gallery-plan.md](../docs/gallery-plan.md) plus the follow-ups after it. Delete (Phase 5) and albums (Phase 6) are not built, so they have no cases yet.

## How to run

1. Read this file, then [00-setup.md](00-setup.md) and [01-test-data.md](01-test-data.md).
2. Run the files in numeric order. Each case lists what it **Needs** (state left behind by earlier cases); the order is chosen so those needs are met. One exception to keep in mind: [02-api.md](02-api.md) uses its own two accounts through a plain HTTP client, never the browser's account, so that the browser account is still empty when [03-empty-and-loading.md](03-empty-and-loading.md) starts.
3. For every case do the steps, compare with **Expected** and record `PASS`, `FAIL` or `SKIPPED` with a short note of what you actually saw (texts, counts, sizes). Take a screenshot only where a case asks for one, or to show a failure.
4. Use a desktop-sized window (about 1000 px wide or more) unless a case says otherwise; the masonry grid has four columns from 900 px of content width.
5. A failed setup step stops the run. A failed test case does not: note it and carry on with the cases that do not depend on it.
6. Always finish with [10-cleanup.md](10-cleanup.md), even after failures.
7. Print the report in the terminal (format at the end). Do not write it into the repo.

## Rules

- **Production preview on port 4173 only.** Before starting, stop whatever is _listening_ on 4173 and 5173 (listeners only, never a browser's own connections), then start the preview. Never use another port and never run `pnpm dev` for these cases.
- **Throwaway accounts only.** Every write (sign-up, upload) uses a QA account made for this run, with an email like `qa-<label>-<8 random hex>@example.test`. This is a real browser on a real machine, so it may already be signed in to the app as the owner's own account. Before the first write, look at who is signed in (`GET /api/auth/get-session` returns the current user). If it is not a `qa-…@example.test` address, stop and ask the user. Never test on a real account and never touch its media.
- **Delete only what you created:** the QA accounts this run made (keep their ids), their media rows and their objects in the bucket. A `qa-…` account you did not create (an earlier or a concurrent run) is not yours: report it and never delete it without the user's say-so. Nothing else, ever.
- Do not print passwords or anything from `.env`. Do not change app code or commit anything while testing; report failures instead.
- Everything runs against the local Docker services (Postgres and RustFS), see [00-setup.md](00-setup.md).

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

Prefer running JavaScript in the page for exact checks (counts, computed styles, request bodies) and use screenshots for what is visual. Claude in Chrome drives the owner's real profile, so the signed-in check in the Rules matters most there.

## Things that cause false failures

- **A hidden browser pane.** The built-in pane is usually reported as `visibilityState: hidden`. Then `IntersectionObserver` (the infinite-scroll trigger) never fires and CSS exit animations do not progress, so a dialog or the phone menu still looks open right after it was closed. Taking any screenshot wakes the pane. Work in short steps: do the action, take a small screenshot, then read the state in a separate call. Real Chrome does not have this problem.
- **Toasts are short-lived.** Success and failure toasts disappear after about 4 seconds, and the dialog's exit animation can stall in a hidden pane, so "wait until the dialog is gone, then read the toast" often misses it. Arm a DOM observer for toast text before the action (or poll right after it). The "Try again" toast for a failed load is the exception: it stays until used or dismissed.
- **Clicks by coordinates are unreliable** in the phone-sized viewport. Click by element reference (`find`/`read_page`) or call the element's `click()` from the page.
- **A full page load wipes what you stashed in the page** (fault injection, observers, helpers). Client-side navigation between the sidebar pages does not. Re-arm after any `navigate` or reload.
- **`fetch()` of a thumbnail URL that an `<img>` already loaded can fail with a CORS error** (the cached no-cors response has no CORS headers). Read an image's size from the `<img>` element or fetch before it is shown. This is a test artefact, not an app bug.
- **The native file picker cannot be driven.** The dialog's hidden file input can be given files from the page, see [01-test-data.md](01-test-data.md).
- **Stale service worker.** The production build registers a service worker. After a rebuild, remove old workers and caches before testing, see [00-setup.md](00-setup.md).

## Files

| File                                                                       | Cases | What it covers                                                                            |
| -------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------- |
| [00-setup.md](00-setup.md)                                                 | SET   | Services, quality gate, ports, preview, clean browser, QA account                         |
| [01-test-data.md](01-test-data.md)                                         | -     | Files to prepare and the techniques the cases rely on                                     |
| [02-api.md](02-api.md)                                                     | API   | The `/api/media` contract: auth, uploads, validation, isolation, paging, redirects, purge |
| [03-empty-and-loading.md](03-empty-and-loading.md)                         | EMP   | Brand-new account: empty grid, loading skeleton, failed first load                        |
| [04-upload.md](04-upload.md)                                               | UPL   | The upload dialog from picking files to stored data and thumbnails                        |
| [05-gallery.md](05-gallery.md)                                             | GAL   | The populated grid: masonry, tiles, image loading, infinite scroll, new uploads           |
| [06-upload-failure-and-background.md](06-upload-failure-and-background.md) | BG    | Failed uploads, retry, hiding the dialog, leaving the page, signing out                   |
| [07-lightbox.md](07-lightbox.md)                                           | LBX   | The full-screen viewer                                                                    |
| [08-mobile.md](08-mobile.md)                                               | MOB   | Phone-sized viewport                                                                      |
| [09-resilience.md](09-resilience.md)                                       | RES   | Old thumbnails, service worker, console and network audit                                 |
| [10-cleanup.md](10-cleanup.md)                                             | CLN   | Remove everything the run created                                                         |
| [11-manual-and-gaps.md](11-manual-and-gaps.md)                             | -     | What an agent cannot automate and what is not verified                                    |

## Coverage of the plan's Phase 9 checklist

| Phase 9 item                                                  | Cases                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm check && pnpm lint && pnpm build`                       | SET-02                                                              |
| Production preview on :4173, no port switching                | SET-03, SET-04                                                      |
| Upload JPEG with EXIF rotation and a date taken               | UPL-06                                                              |
| Upload PNG and GIF                                            | UPL-02, UPL-03, UPL-05                                              |
| HEIC on Chrome (no thumbnail) and on Safari                   | UPL-02 and UPL-04 with a fake `.heic`; real HEIC and Safari: manual |
| Upload MP4 and MOV                                            | UPL-02 to UPL-05 (WebM recorded in the page; real MP4/MOV optional) |
| A file over the size limit and a disallowed type are rejected | UPL-02, API-04                                                      |
| Pagination past 60 items                                      | GAL-06, API-06                                                      |
| Lightbox previous/next and video playback                     | LBX-01 to LBX-06                                                    |
| Single and bulk delete, albums                                | not built yet                                                       |
| A second user cannot list or view another user's media        | API-05                                                              |
| Offline: the dashboard loads, media fails without breaking it | manual, see [11-manual-and-gaps.md](11-manual-and-gaps.md)          |

## Report format

Print one table, one row per case, then a short list of every failure with what was expected and what was seen:

| Case   | Result | Evidence                                      |
| ------ | ------ | --------------------------------------------- |
| UPL-03 | PASS   | 9 items added, at most 3 uploads in flight    |
| BG-02  | FAIL   | Review button missing after the failure toast |

End with the totals (passed, failed, skipped) and the cleanup result (counts back to the baseline recorded in SET-01).
