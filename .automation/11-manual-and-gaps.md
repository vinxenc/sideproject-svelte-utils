# 11 · Not automated, not verified, not built

What an agent cannot run, what has never been run, and what does not exist yet. Report these as `SKIPPED` with the reason, never as `PASS`.

## Needs a person or a device

| Item                                           | Why it cannot be automated, and what to look at                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The `Library` button (UPL-12)                  | It opens the operating system's file picker. Check that it opens, that choosing several photos and videos adds cards, that cancelling the picker changes nothing, and that choosing the same files again works.                                                                                                                   |
| The real camera (UPL-13, UPL-14)               | The cases fake the camera stream. With a real webcam check that the picture is live and sharp, that a photo and a recording come out as seen and with sound, and that the camera light goes off after `Done`. On a phone check the permission prompt (including the installed PWA) and that the photo or video lands in the list. |
| A real drag and drop of files from the desktop | Synthetic events (UPL-09) show the handler works, but not the browser's own default of opening a dropped file. Drop a photo on the dialog: cards appear and the page is not replaced by the photo. Drop one outside the dialog to see what the browser does there (it will open the file).                                        |
| Real HEIC / HEIF photos                        | Chrome usually cannot decode them (the plan expects no thumbnail there): expect a placeholder tile and "This browser can't show the original" in the viewer. Safari can: expect a thumbnail and the photo.                                                                                                                        |
| Real iPhone videos (`.mov`, HEVC)              | Needs the real files. Check the poster, the duration badge and playback in Safari and in Chrome.                                                                                                                                                                                                                                  |
| Safari and iOS                                 | JPEG thumbnails (the reason thumbnails are JPEG), upload progress, infinite scroll, the phone menu, installing the app. Nothing has been run in Safari so far.                                                                                                                                                                    |
| Offline                                        | Plan Phase 9: load the dashboard and the gallery, switch the browser to offline, reload. The dashboard should still load from the service worker; media requests should fail without breaking the page.                                                                                                                           |
| Light theme                                    | The suite only looked at the dark theme. Check the dialog cards, their overlay text, the tiles and the viewer in light mode.                                                                                                                                                                                                      |
| The size limits with real bytes                | API-04 checks the limits by declared size only. A real 50 MB photo and a real 1 GB video exercise the whole path but take long; do them once by hand if the limits change.                                                                                                                                                        |
| A video that never loads                       | The preview step gives up on a video after 10 seconds. A file chooser cannot produce a source that never answers, so this timeout is only checked by reading `src/lib/media/prepare.ts`.                                                                                                                                          |

## Never run

- The gallery on the dev server (`pnpm dev`, port 5173). The suite uses the production preview only; a dev run could expose differences in server-rendering or the service worker (which only exists in production).
- A second browser (Firefox) and other operating systems.
- Keyboard-only use of the dialog and the viewer beyond what the cases say (tab order, focus return after closing).

## Not built yet (no cases until they exist)

- Phase 5, delete: `DELETE /api/media/[id]`, select mode with a bulk delete behind a confirmation, a delete button in the viewer. When it lands, add: the viewer must close when its item is deleted (the code that did this was removed until then), the tile disappears, objects are removed from the bucket, another account gets 404.
- Phase 6, albums: `/api/albums`, adding and removing items, the album picker and the `album` filter on `GET /api/media`, album covers.
- README updates listed in Phase 8 of the plan.

## Keeping these files true

Run a case again after changing the part of the app it covers, and update the text of the case in the same change. When a case and the app disagree, report it as a failure; the owner decides whether the app or the case is out of date.
