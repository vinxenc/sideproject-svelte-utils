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

**Making a request fail or wait.** Wrap `window.fetch` in the page. A rule has a URL pattern, optionally a method and "only the n-th matching call", and what to do: wait some milliseconds, answer with an HTTP status and a JSON body such as `{"message":"boom"}` (the app shows that message), or reject like a network error (`TypeError: Failed to fetch`). Count a call _before_ any waiting, otherwise calls that overlap in time all see the final count and all of them fail. The same wrapper can just record every call (method, URL, request body, response status), which is how cases count requests and read the exact JSON the page sent. Restore the original `fetch` when the case ends.

**Making the upload of the original fail at the network level.** The browser uploads with `XMLHttpRequest` straight to the storage origin (`http://localhost:9000`, a `PUT` whose URL path ends in `/original` and whose query is a signature). Wrap `XMLHttpRequest.prototype.open` so the first such `PUT` is sent to a closed local port instead (for example `http://127.0.0.1:1/`). The app then shows `Network error while uploading`.

**Counting uploads in flight.** Wrap `XMLHttpRequest.prototype.open` and `send`; for `PUT` requests whose URL path ends in `/original`, add one when sent and subtract one when the request ends (`loadend`). Remember the maximum. Also remember the `Content-Type` header of every `PUT` (set through `setRequestHeader`) and the JSON body of every `POST /api/media`.

**Images that never load.** Run a throwaway local TCP or HTTP server that accepts connections and never answers, and rewrite thumbnail URLs (`/api/media/<id>/thumb`) in `<img>` elements to point at it before the images are created (wrap `Element.prototype.setAttribute` and the `src` property setter of `HTMLImageElement`). Remove the wrapping and re-enter the page to let the real images through. Stop the server afterwards.

**Reading what is stored.** The `media` table has `id, userId, kind (IMAGE or VIDEO), status (PENDING or READY), name, contentType, size, width, height, duration, takenAt, hasThumb, createdAt, updatedAt, deletedAt`. The `album` table has `id, userId, name, coverId, createdAt, updatedAt, deletedAt`; `album_media` has `albumId, mediaId, addedAt` (no `deletedAt`: its rows are links); `password` has `id, userId, name, username, password, type, createdAt, deletedAt`. Query them in the compose Postgres (service `postgres`, database `utilities`, user `utilities`; see `docker-compose.yml`) for one QA user at a time, e.g. with `docker compose exec -T postgres psql -U utilities -d utilities -c "..."`. Plain SQL sees **soft-deleted rows** too (`deletedAt` is not null): the app hides them, SQL does not, so "the row is gone" is never the right check; look at `deletedAt`. Objects live in the `media` bucket under `<userId>/<mediaId>/original` and `<userId>/<mediaId>/thumb`; a soft delete leaves them there. Postgres is version 18, so `uuidv7()` is available (every id in the app is a UUID v7, seed rows should be too).

**Seeding placeholder items.** For scroll, paging and delete cases insert rows for the QA user directly. Columns: `kind` IMAGE, `status` READY, `name` `<prefix>-1` … `<prefix>-N` (the paging cases use the prefix `seed`; zero-padded when a case says so), `contentType` `image/jpeg`, `size` 1, `id` from `uuidv7()`, and `takenAt` of row number `g` (1 to N) set to a start time plus `g/3` minutes (integer division) for the paging cases, so that groups of three rows share the same time and the tie-breaking by id is exercised, or plus `g` minutes where a case needs distinct times. The default start is 2020-01-01 00:00 (older than anything real); a case that wants its rows at the very top of the grid says to start in 2031. Example for 12 rows that sort first, newest being number 12:

```sql
INSERT INTO media (id, "userId", kind, status, name, "contentType", size, "takenAt")
SELECT uuidv7(), '<userId>', 'IMAGE'::media_kind, 'READY'::media_status,
       'del-' || lpad(g::text, 2, '0'), 'image/jpeg', 1,
       timestamp '2031-01-01' + g * interval '1 minute'
FROM generate_series(1, 12) g;
```

They have no stored objects, so their tiles show the grey placeholder (this is intended) and an album download that contains one fails (see ALA-09). Only ever seed a QA user, and clean up the rows of a prefix when the case says so (see "Purging the run's data safely" in [10-cleanup.md](10-cleanup.md)).

**Seeding albums.** Same idea in `album`: `id` from `uuidv7()`, `userId`, `name`, and an explicit `createdAt` when the order matters (the table orders by it), e.g. `timestamp '2020-01-01' + g * interval '1 day'`. Link items with `INSERT INTO album_media ("albumId", "mediaId") ...`. A cover is set with `UPDATE album SET "coverId" = '<mediaId>' WHERE id = '<albumId>'` (nothing in the app or the API sets it).

**Real items without the dialog.** Some cases need items that have real objects (an album download, the "objects stay" check) or that exist in numbers without the dialog. From the page (same origin) or from a plain HTTP client: `POST /api/media` with `{ name, type: 'image/png', size, thumb }`, `PUT` `size` random bytes to `original` and `thumb` random bytes to `thumb` (each with the type signed into the URL, `image/png` and `image/jpeg`; from the page the storage origin allows it through CORS), then `POST /api/media/<id>/complete` (an optional body `{ albumId }` links the upload into that album). The server never looks at the bytes, so 10 random bytes will do; the tile then shows the grey placeholder because the thumbnail is not an image (GAL-05). Name these items per case (`del-real.png`, `alb-1.png`) and give each a distinct `takenAt` in the create body when order matters.

**QA accounts.** Sign-up no longer signs anyone in: an account needs its email code first.

1. `POST /api/auth/sign-up/email` with `{ name, email, password }` and the header `Origin: http://localhost:4173` (from the page the browser sends it itself). Answers 200, no session cookie.
2. Read the code with the shell, **not from the page** (Mailpit at `localhost:8025` is another origin): `curl -s 'http://localhost:8025/api/v1/search?query=to:<email>'` lists the messages sent to that address; take the `ID` of the newest and `curl -s http://localhost:8025/api/v1/message/<ID>`: the code is the six digits in its `Text` (`Your code to verify your email is 123456.`). The mail is sent without waiting for it, so poll for up to 10 seconds.
3. `POST /api/auth/email-otp/verify-email` with `{ email, otp, password }` (the password is required too) and the same `Origin`. Answers 200 and signs that client in: from the page the browser's cookies change, from a plain HTTP client its cookie jar does.
4. Last resort: step 1, then in the database `UPDATE "user" SET "emailVerified" = true WHERE id = '<id>' AND email LIKE 'qa-%@example.test'`, then `POST /api/auth/sign-in/email`. Use it only when steps 2 and 3 cannot work, and say so in the report.

**Pacing (rate limits).** Better Auth limits, per client address (every local client shares one bucket) and per path: 3 requests per 10 seconds for `/sign-up*` and `/sign-in*`, 3 per 60 seconds for `email-otp/verify-email` and `email-otp/send-verification-otp`. One account costs one sign-up and one verify, so the browser account, account A and account B of [02-api.md](02-api.md) are already three verifies: space account creation about 20 seconds apart, and **reuse accounts A and B** (keep their cookie jars) for every "a second account gets 404" check instead of creating more. A `429` is not an app failure: wait 60 seconds and try again. Do not sign in an unverified account just to see (that mails a new code and counts against the limits).

**Touch input.** The page cannot receive real touches. For a press and hold, dispatch on the tile's button a `PointerEvent` `pointerdown` with `pointerType: 'touch'`, wait 600 ms without any `pointermove` of more than 10 px, then dispatch `pointerup` and a `click`. A hold shorter than 500 ms followed by a `click` is a plain tap. The browser tools' mobile preset reports a touch device to the page but still clicks with a mouse.

**Waking a hidden pane.** See "Things that cause false failures" in [README.md](README.md).
