# 02 · API contract (`/api/media`)

The HTTP contract behind the gallery. These cases need no page interaction. File bytes go straight to the storage origin with presigned URLs, so a plain HTTP client can upload them too.

**Needs:** SET-01 to SET-04 (the preview is running). Use **two QA accounts created just for this file**, account A and account B, each driven by a plain HTTP client with its own cookie jar (sign up with `POST /api/auth/sign-up/email`, which also signs that client in; send an `Origin: http://localhost:4173` header). Do **not** use the browser or the account from SET-06 here: these cases leave media rows, seeded rows and pending uploads behind, which would break the "no media" starting point of [03-empty-and-loading.md](03-empty-and-loading.md) and the item counts of [04-upload.md](04-upload.md), and signing up from the browser would replace its session. API-06 and API-08 also write database rows directly (see "Seeding" in [01-test-data.md](01-test-data.md)), for account A only. Give both accounts `qa-…@example.test` emails; write down both user ids (from the sign-up responses): [10-cleanup.md](10-cleanup.md) deletes exactly those.

**Requests used below**

- Create an upload: `POST /api/media` with JSON `{ name, type, size, takenAt?, width?, height?, duration?, thumb? }`. Answers 201 with `{ id, contentType, original, thumb }`: `original` and `thumb` are presigned `PUT` URLs (`thumb` is `null` unless `thumb` was `true`).
- Upload the bytes: `PUT` each URL with the matching `Content-Type`.
- Finish: `POST /api/media/<id>/complete` answers with the item.
- List: `GET /api/media` (60 per page, newest `takenAt` first) answers `{ items, nextCursor }`; continue with `?cursor=<nextCursor>`.
- Files: `GET /api/media/<id>/original` and `/thumb` answer `302` with a presigned `GET` URL.

## API-01 A session is required

| Request (no session)                | Expected |
| ----------------------------------- | -------- |
| `GET /api/media`                    | 401      |
| `POST /api/media` with a valid body | 401      |
| `POST /api/media/x/complete`        | 401      |
| `GET /api/media/x/original`         | 401      |
| `GET /api/media/x/thumb`            | 401      |

## API-02 Happy path

**Steps and expected results, in order**

1. `POST /api/media` for `happy.jpg`: type `image/jpeg`, size 5000, `takenAt` `2024-05-01T10:00:00.000Z`, width 4000, height 3000, `thumb: true`. Expect 201, an `id`, `contentType` `image/jpeg`, header `Cache-Control: private, no-store`, an `original` URL on the storage origin whose path is `/media/<userId>/<id>/original`, and a `thumb` URL whose path ends `<userId>/<id>/thumb`.
2. `PUT` 5000 random bytes to `original` with `Content-Type: text/html`: expect **403** (the type is signed into the URL). Repeat with `image/jpeg`: expect 2xx.
3. `PUT` 800 random bytes to `thumb` with `Content-Type: image/webp`: expect **403** (thumbnails are always `image/jpeg`). Repeat with `image/jpeg`: expect 2xx.
4. While the item is still pending: `GET /api/media` does not list it, and `GET /api/media/<id>/original` answers 404.
5. `POST /api/media/<id>/complete`: expect 200 and an item with `hasThumb: true`, `kind: "IMAGE"`, `name: "happy.jpg"`, `duration: null`, `takenAt: "2024-05-01T10:00:00.000Z"` and **exactly these six keys**: `id`, `kind`, `name`, `duration`, `takenAt`, `hasThumb`.
6. In the database the row has width 4000, height 3000, size 5000 and contentType `image/jpeg` (they are stored although the item JSON omits them).
7. Completing again answers 404 (the row is no longer pending).
8. `GET /api/media` returns exactly this item with `nextCursor: null` and `Cache-Control: private, no-store`.
9. For `thumb` and `original`: do not follow the redirect automatically. Expect 302, a `Location` on the storage origin and bucket, and `Cache-Control: private, no-store` (the redirect is never cached, so the ownership check runs on every request). Fetching the `Location` returns exactly the bytes uploaded, with `Content-Type: image/jpeg`.

## API-03 Completing: missing thumbnail, wrong size, missing upload

| Situation                                                                                               | Expected                                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Create without `thumb`, upload only the original, complete                                              | `thumb` was `null`; complete gives `hasThumb: false`; `GET .../thumb` is 404; `GET .../original` is 302 |
| Create with size 100 and `thumb: true`, upload 200 bytes (more than declared) and a thumbnail, complete | 422; the row is deleted and its objects are removed from the bucket; completing again is 404            |
| Create, upload nothing, complete                                                                        | 409; the row stays pending so a client can retry                                                        |
| Create with `thumb: true`, upload a 10 byte original and a thumbnail larger than 2 MB, complete         | 200 with `hasThumb: false`; the oversized thumbnail object is removed                                   |

## API-04 Validation of `POST /api/media`

**Rejected with 400:** type `application/x-msdownload` (`x.exe`); `image/svg+xml`; an image of 50 MB + 1 byte; a video of 1 GB + 1 byte; size 0; size -5; size 10.5; size as the string `"1000"`; a blank name; a body that is not JSON; the JSON value `null`; an unknown extension with an empty type (`x.xyz`).

**Accepted (201) with these canonical types:** an image of exactly 50 MB (`image/jpeg`); a video of exactly 1 GB (`video/mp4`); empty type with `IMG_1.HEIC` (`image/heic`); empty type with `clip.MOV` (`video/quicktime`); type `video/mp4; codecs=avc1` (normalised to `video/mp4`).

**Tolerated:** `thumb` set to anything other than boolean `true` (`"yes"`, `1`, `"image/webp"`, `null`, `{}`) answers 201 with `thumb: null`; the old field `thumbType` is ignored the same way. After upload and complete: a `takenAt` of `2999-01-01` is clamped to about now; an unparsable `takenAt` becomes about now; width -4 and height 1.5 are stored as null.

## API-05 Isolation between accounts

With account A owning a pending upload and a finished item, signed in as account B:

| Request by B                                    | Expected                          |
| ----------------------------------------------- | --------------------------------- |
| `POST /api/media/<A's pending id>/complete`     | 404, and A's row is still pending |
| `GET /api/media/<A's id>/original` and `/thumb` | 404                               |
| `POST /api/media/<A's finished id>/complete`    | 404                               |
| `GET /api/media`                                | `items: []`, `nextCursor: null`   |

A can still read its own item (302).

## API-06 Paging with equal timestamps

**Needs:** account A with about 150 READY items whose `takenAt` values contain ties (seed 150 placeholders).

**Expected**

- Paging with `nextCursor` until it is `null` returns every item exactly once, in 3 pages (60, 60 and the rest), in the same order as the database's `takenAt` descending then `id` descending.
- Take the first page's `nextCursor`, then delete the row it points at (the last item of page 1). Requesting `?cursor=` with that cursor still works and returns the next 60 items, starting with the one that follows the deleted row.
- `?cursor=garbage` and `?cursor=abc_def` answer 400.

## API-07 The `original` and `thumb` route

**Needs:** a finished item with a thumbnail.

| Request                                                                                              | Expected                                           |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /api/media/<id>/original` and `/thumb` (owner)                                                  | 302 to `.../<userId>/<id>/original` or `.../thumb` |
| `GET /api/media/<id>/foo`, `/ORIGINAL`, `/thumbs`, `/original.jpg`, `/original%2F..%2Fthumb` (owner) | 404                                                |
| `GET /api/media/<id>/foo` without a session                                                          | 401 (the session is checked first)                 |
| `GET /api/media/<id>/complete`                                                                       | 405 (that path is the POST-only route)             |
| `POST /api/media/<id>/complete` for an item that is already finished                                 | 404                                                |
| `GET /api/media?album=anything`                                                                      | 200: the parameter is ignored                      |

## API-08 Stale pending uploads are purged

**Steps:** create an upload, send its original and thumbnail, never complete it, and set its `createdAt` back 25 hours in the database. Also create a second, fresh pending upload. Then request the first page `GET /api/media`.

**Expected:** the 25-hour-old row and both of its objects are gone; the fresh pending row is still there.

**Then, for the cursor path:** keep the `nextCursor` that this first-page request returned (account A has more than 60 READY items after API-06; run API-06 first or seed 70 placeholders). Only now create another pending upload and set its `createdAt` back 25 hours, then request `GET /api/media?cursor=<that nextCursor>`. That row is **not** purged: only a request without a cursor cleans up. Do not use an empty `?cursor=`: an empty value counts as no cursor and would purge.
