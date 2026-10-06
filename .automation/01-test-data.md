# 01 · Test data and techniques

What the cases need to prepare, and the browser techniques they rely on. Everything is created on the fly in the page or in the database; no fixture files are stored in the repo.

## The standard set (9 files)

Used by [04-upload.md](04-upload.md) and everything after it. Build each one as a `File` object in the page (canvas, typed arrays) and give it the name and type below.

| File             | Type given to the File | How to make it                                                                                                                                                                                         | What the app should make of it                                                   |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `exif-photo.jpg` | `image/jpeg`           | 1600×1200 canvas drawn as a colour gradient with the text "EXIF 2021", exported as JPEG, then an EXIF segment with `DateTimeOriginal` `2021:03:14 09:26:53` inserted right after the JPEG start marker | Thumbnail, date taken 2021-03-14                                                 |
| `alpha.png`      | `image/png`            | 800×600 canvas left transparent with an opaque red circle in the middle, exported as PNG                                                                                                               | Thumbnail on a white background                                                  |
| `photo.webp`     | `image/webp`           | 1200×800 canvas filled green with the text "WEBP", exported as WebP                                                                                                                                    | Thumbnail                                                                        |
| `tiny.gif`       | `image/gif`            | The 43 bytes `47 49 46 38 39 61 01 00 01 00 80 00 00 FF 00 00 00 00 00 21 F9 04 01 00 00 00 00 2C 00 00 00 00 01 00 01 00 00 02 02 44 01 00 3B` (a 1×1 GIF whose only pixel is transparent)            | Thumbnail of 1×1 (white), size label `43 B`                                      |
| video A          | see Videos             | a short video                                                                                                                                                                                          | Thumbnail from a frame, duration                                                 |
| video B          | see Videos             | a second short video                                                                                                                                                                                   | Thumbnail from a frame, duration                                                 |
| `broken.heic`    | empty string           | 2,048 random bytes                                                                                                                                                                                     | Extension fallback to `image/heic`; cannot be decoded, so no thumbnail; `2.0 KB` |
| `five-bytes.jpg` | `image/jpeg`           | 5 random bytes                                                                                                                                                                                         | No thumbnail; `5 B`                                                              |
| `junk-1536.jpg`  | `image/jpeg`           | 1,536 random bytes                                                                                                                                                                                     | No thumbnail; `1.5 KB`                                                           |

Two more files are chosen alongside them to test rejections: `notes.txt` (type `text/plain`, a few bytes) and `huge.jpg` (type `image/jpeg`, 51 MB of zero bytes).

To embed EXIF without a library, build a minimal little-endian TIFF block (header, one IFD pointing to an Exif IFD, one ASCII entry for `DateTimeOriginal`, the date string ending in a NUL byte) and wrap it in an APP1 segment (`FF E1`, length, `Exif\0\0`, TIFF block).

## Videos

- **Default, no external files:** record about 2 seconds of a canvas in the page (a 320×180 canvas with a changing colour and a frame counter, `captureStream`, `MediaRecorder` with `video/webm`) and use the recording as a `video/webm` file. Verified here: stored as 320×180, duration ≈ 2 s, with a thumbnail. Use two recordings for video A and B.
- **Optional, wider coverage:** a real H.264 `.mp4` and a QuickTime `.mov` of a few seconds, from anywhere on the machine or made with ffmpeg if it is installed. Give the `.mov` an empty type so the extension fallback (`video/quicktime`) is exercised. With Claude in Chrome the `file_upload` tool can attach them to the dialog's file input; with the built-in pane, serve them from a local static server with CORS enabled and `fetch()` them into `File` objects.

## Other files used by single cases

| File                     | Made for         | How to make it                                                                                                                                                           |
| ------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rotated.jpg`            | UPL-06           | The same kind of 1600×1200 JPEG with an EXIF `Orientation` of 6 (rotate 90° clockwise) and `DateTimeOriginal` `2019:06:01 08:00:00`                                      |
| `older.jpg`              | GAL-08           | A small JPEG with `DateTimeOriginal` `2018:01:01 00:00:00` (older than anything seeded)                                                                                  |
| `newer.png`              | GAL-08           | A small PNG without EXIF (its date is the file's last-modified time, so "now")                                                                                           |
| `big-1.mp4`, `big-2.mp4` | UPL-10           | 250 MB of zero bytes each, type `video/mp4` (cannot be decoded, which is fine: it only needs bytes to send)                                                              |
| size-label files         | UPL-11           | Zero-filled files of the sizes listed in that case, type `image/jpeg`                                                                                                    |
| small PNGs               | UPL-09, BG cases | 60 to 100 px solid-colour PNGs, a few hundred bytes each (`dialog-drop.png`, `a.png`, `b.png`, `put-fail.png`, ...), one per upload that must succeed or fail on purpose |

## Techniques

**Giving the dialog files.** The dialog contains a hidden `<input type="file">` (accepts images and videos, multiple). The native picker cannot be automated, so put the files into a `DataTransfer`, assign its `files` to the input and dispatch a `change` event. The app clears the input's value after every selection; check that when a case asks. To simulate a drop, dispatch `dragover` and `drop` events carrying a `DataTransfer` on the dialog's content area.

**Observing toasts.** Toasts live in the page for about 4 seconds. Arm a `MutationObserver` on `document.body` _before_ the action that causes them and collect the text of every `[data-sonner-toast]` element, or poll immediately after the action. Do not wait for a dialog to disappear first.

**Making a request fail or wait.** Wrap `window.fetch` in the page. A rule has a URL pattern, optionally a method and "only the n-th matching call", and what to do: wait some milliseconds, answer with an HTTP status and a JSON body such as `{"message":"boom"}` (the app shows that message), or reject like a network error (`TypeError: Failed to fetch`). Count a call _before_ any waiting, otherwise calls that overlap in time all see the final count and all of them fail. Restore the original `fetch` when the case ends.

**Making the upload of the original fail at the network level.** The browser uploads with `XMLHttpRequest` straight to the storage origin (`http://localhost:9000`, a `PUT` whose URL path ends in `/original` and whose query is a signature). Wrap `XMLHttpRequest.prototype.open` so the first such `PUT` is sent to a closed local port instead (for example `http://127.0.0.1:1/`). The app then shows `Network error while uploading`.

**Counting uploads in flight.** Wrap `XMLHttpRequest.prototype.open` and `send`; for `PUT` requests whose URL path ends in `/original`, add one when sent and subtract one when the request ends (`loadend`). Remember the maximum. Also remember the `Content-Type` header of every `PUT` (set through `setRequestHeader`) and the JSON body of every `POST /api/media`.

**Images that never load.** Run a throwaway local TCP or HTTP server that accepts connections and never answers, and rewrite thumbnail URLs (`/api/media/<id>/thumb`) in `<img>` elements to point at it before the images are created (wrap `Element.prototype.setAttribute` and the `src` property setter of `HTMLImageElement`). Remove the wrapping and re-enter the page to let the real images through. Stop the server afterwards.

**Reading what is stored.** The `media` table has `id, userId, kind (IMAGE or VIDEO), status (PENDING or READY), name, contentType, size, width, height, duration, takenAt, hasThumb, createdAt`. Query it in the compose Postgres (service `postgres`, database `utilities`, user `utilities`; see `docker-compose.yml`) for one QA user at a time, e.g. with `docker compose exec postgres psql`. Objects live in the `media` bucket under `<userId>/<mediaId>/original` and `<userId>/<mediaId>/thumb`.

**Seeding placeholder items.** For scroll and paging cases insert rows for the QA user directly: `kind` IMAGE, `status` READY, `name` `seed-1` … `seed-N`, `contentType` `image/jpeg`, `size` 1, a generated `id`, and `takenAt` of row number `g` (1 to N) set to 2020-01-01 00:00 plus `g/3` minutes (integer division), so that groups of three rows share the same time and the tie-breaking by id is exercised. They have no stored objects, so their tiles show the grey placeholder (this is intended). Only ever seed a QA user.

**Waking a hidden pane.** See "Things that cause false failures" in [README.md](README.md).
