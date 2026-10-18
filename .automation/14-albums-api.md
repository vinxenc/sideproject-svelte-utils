# 14 · API contract (`/api/albums`)

The HTTP contract behind albums. No page interaction: plain HTTP clients, like [02-api.md](02-api.md).

> Executed in part 2 of the first run (2026-10-18): ALA-01 to ALA-12 all pass; wording fixed (error body shape, dots-only fallback, placeholder in a download).

**Needs:** SET-01 to SET-04, and **accounts A and B of [02-api.md](02-api.md)** with their cookie jars (sign them in again with `POST /api/auth/sign-in/email` if a jar was lost; 3 sign-ins per 10 seconds at most). Do not make new accounts. All requests send `Content-Type: application/json` and `Accept: application/json`; errors are `{ "status": <code>, "message": "..." }` (the cases below compare `message`). Only success answers carry `Cache-Control: private, no-store`; the 4xx ones do not.

**Items used below:** make these once, as account A, with "Real items without the dialog" ([01-test-data.md](01-test-data.md)): `ala-1.png` to `ala-7.png` (10 random bytes each, type `image/png`, `takenAt` of `ala-n` = `2024-01-0n`, with a thumbnail for `ala-1` to `ala-3`), `ala-gone.png` (finished, then deleted with `DELETE /api/media`), two items both named `dup.png` (distinct `takenAt`), and one item of account B, `b-1.png`. Also one more upload of A that is created and sent but not completed (`pending.png`). Write down every id.

**Requests**

- List: `GET /api/albums?limit=<1..60>&cursor=<c>` answers `{ items, nextCursor }`, newest **created** first (`createdAt` descending, then `id` descending), 30 per page by default.
- Create: `POST /api/albums` `{ name }`, 201. Rename: `PATCH /api/albums/<id>` `{ name }`. Delete: `DELETE /api/albums/<id>`, 204.
- Items: `POST` and `DELETE /api/albums/<id>/items` with `{ mediaIds }`, answering `{ added }` and `{ removed }`.
- Media: `GET /api/albums/<id>/media` answers `{ items, nextCursor }` like `GET /api/media` (60 per page). Download: `GET /api/albums/<id>/download`, a ZIP.
- An album as the API returns it has exactly these keys: `id`, `name`, `count`, `createdAt`, `updatedAt`, `previews` (each preview has exactly `id`, `kind`, `hasThumb`).

## ALA-01 A session is required

| Request (no session)                                                                  | Expected |
| ------------------------------------------------------------------------------------- | -------- |
| `GET /api/albums` and `POST /api/albums` `{"name":"x"}`                               | 401      |
| `PATCH /api/albums/x` and `DELETE /api/albums/x`                                      | 401      |
| `POST /api/albums/x/items` and `DELETE /api/albums/x/items` with `{"mediaIds":["x"]}` | 401      |
| `GET /api/albums/x/media`, `GET /api/albums/x/download`                               | 401      |

## ALA-02 Creating, and the name rules

**Steps and expected results**

1. `POST` `{"name":"  Trip  "}`: 201, `Cache-Control: private, no-store`, the six keys above, `name` `Trip` (trimmed), `count` 0, `previews` `[]`, `createdAt` and `updatedAt` ISO strings.
2. `POST` `{"name":"Trip"}` again: 201 with a different `id`. Names are not unique.
3. These answer 400 and create nothing:

| Body                                                                       | Message                                   |
| -------------------------------------------------------------------------- | ----------------------------------------- |
| no body, a body that is not JSON, the JSON value `null`                    | `Invalid request`                         |
| `{}`, `{"name":5}`, `{"name":null}`, `{"name":""}`, `{"name":"   "}`, `[]` | `Enter an album name`                     |
| `{"name":"<101 characters>"}`                                              | `Album names can be up to 100 characters` |
| a name with a line feed, a carriage return, a tab or U+007F inside         | `Album names can't contain line breaks`   |

4. Accepted (201): a name of exactly 100 characters; 50 emoji (100 UTF-16 units); a name with a leading and trailing line feed (they are trimmed away before the check). A name of 51 emoji (102 units) is 400.

## ALA-03 Listing, order and paging

**Needs:** account A with no albums except the ones made in ALA-02 (delete them first with `DELETE`, or accept them and compare against the database).

**Steps**

1. In the database give account A seven albums `ala-01` to `ala-07` with `createdAt` of 2020-02-01 plus `g` days, and five albums `ala-tie-1` to `ala-tie-5` that all share `createdAt` `2020-03-01 00:00:00` (see "Seeding albums").
2. `GET /api/albums`: 200, `{ items, nextCursor }`; the order is exactly the database's `ORDER BY "createdAt" DESC, "id" DESC` over A's albums that are not soft-deleted.
3. Page through with `?limit=3` and each `nextCursor` until it is `null`: every album exactly once, in the same order, no repeats or gaps across the five tied albums.
4. The first page's `nextCursor` has the shape `<milliseconds>_<id>`. Delete the album it points at (`DELETE /api/albums/<id>`), then request `?cursor=<that value>`: it still works and starts with the album after the deleted one.
5. Limits: `?limit=60` is 200; `?limit=0`, `61`, `abc`, `-1`, `1.5` and an empty `?limit=` are 400 `Invalid limit`; no `limit` gives at most 30 items. `?cursor=garbage` and `?cursor=abc_def` are 400 `Invalid cursor`; an empty `?cursor=` counts as no cursor.
6. **Rename, add and remove never reorder:** note the position of the oldest album, then rename it, add an item to it and remove the item again. After each, `GET /api/albums` lists the same order; only that album's `updatedAt` changed (it moves forward on a rename, on an add that added something and on a remove that removed something, and stays put on an add or remove that changed nothing).

## ALA-04 Renaming

**Steps and expected results**

1. `PATCH` `{"name":" New name "}` on A's album: 200, the album with `name` `New name`, the same `id` and `createdAt`, a later `updatedAt`, `Cache-Control: private, no-store`.
2. The body rules of ALA-02 apply (400 with the same messages); a 400 changes nothing.
3. `PATCH` on an unknown id, on a deleted album and on account B's album: 404 `Not found`, and B's album keeps its name.

## ALA-05 Adding items: all or nothing

**Steps and expected results** (album `T` of A, empty at the start)

1. `POST` `{"mediaIds":["<ala-1>","<ala-2>"]}`: 200 `{"added":2}`, `Cache-Control: private, no-store`; `T`'s `count` is 2 and `updatedAt` moved.
2. The same request again: `{"added":0}`; `updatedAt` did **not** move.
3. `["<ala-2>","<ala-3>","<ala-3>"]` (a repeat inside the body): `{"added":1}` (repeats are collapsed).
4. All-or-nothing: each of these answers 404 `Not found` and adds **nothing** (check the count afterwards), even though the first id is valid: `["<ala-4>","<a random UUID>"]`; `["<ala-4>","<b-1's id (account B's item)>"]`; `["<ala-4>","<pending.png's id>"]` (a pending upload is not READY); `["<ala-4>","<ala-gone's id>"]` (soft-deleted).
5. Foreign or unknown album: `POST` to B's album, to an unknown id and to a deleted album answer 404 `Not found`.
6. Validation (400, nothing added), the same list as API-09: no body or not JSON or `null` → `Invalid request`; `{}`, a non-array, non-string items, `""` or a 65-character id → `Invalid media ids`; `[]` → `No media ids`; 501 distinct strings → `Too many items (500 at most)`; 500 distinct unknown ids are accepted by validation and then answer 404.

## ALA-06 Removing items

**Steps and expected results** (album `T` from ALA-05, holding `ala-1`, `ala-2`, `ala-3`)

1. `DELETE` `{"mediaIds":["<ala-1>"]}`: 200 `{"removed":1}`, count 2, `updatedAt` moved.
2. `DELETE` `{"mediaIds":["<ala-1>","<ala-4>","<a random UUID>","<b-1's id>"]}`: 200 `{"removed":0}`: ids that are not in the album (or not the caller's at all) are ignored, not an error; `updatedAt` did not move.
3. The library is untouched: `GET /api/media` still lists `ala-1` (removing from an album never deletes the item). In the database the link row is really gone.
4. Foreign, unknown and deleted albums answer 404; the validation of ALA-05 step 6 applies.
5. If the removed item was the album's cover (set in ALA-08), `coverId` becomes null.

## ALA-07 The album's media

**Needs:** album `M` of A with `ala-1` to `ala-7` and both `dup.png` items, plus 70 seeded placeholders (prefix `alamedia`, linked into `M`), so `M` holds 79 READY items.

**Expected**

- `GET /api/albums/<M>/media`: 200, `Cache-Control: private, no-store`, 60 items, newest `takenAt` first, `nextCursor` set; the items have the eight keys of a library item. Following the cursor returns the remaining 19 and `nextCursor: null`; every item once.
- Pending items, other people's items and soft-deleted items never appear: after (and only after) the paging check, `DELETE /api/media` for `ala-7` makes it vanish from `M`'s media and `M`'s `count` drops to 78, while the `album_media` link row remains in the database.
- `?cursor=garbage` is 400 `Invalid cursor`.
- Unknown, deleted and foreign albums answer 404 `Not found`.
- The link survives the album's own changes: renaming `M` does not change its media.

## ALA-08 Count, previews and covers

**Steps and expected results** (a fresh album `P` of A)

1. Add `ala-1`, then `ala-2`, then `ala-3`, then `ala-4` in four separate requests (so their `addedAt` differ). `GET /api/albums` shows `P` with `count` 4 and `previews` of **3** items: the first-added three, in the order added (`ala-1`, `ala-2`, `ala-3`), each with `kind`, `hasThumb` as stored.
2. Add `ala-5` and `ala-6` in **one** request: they tie on `addedAt` and sort by id; they come after the earlier ones and only matter once earlier ones are removed.
3. Set a cover in the database (`UPDATE album SET "coverId" = '<ala-4>'`): `previews` becomes `ala-4`, `ala-1`, `ala-2` (the cover first, then the first-added ones without repeating the cover).
4. Soft-delete the cover with `DELETE /api/media`: `previews` falls back to `ala-1`, `ala-2`, `ala-3` and `count` is 5.
5. Set the cover to `ala-5`, then remove `ala-5` from the album with `DELETE …/items`: the response is `{"removed":1}` and `coverId` is null in the database.
6. A pending item is never counted or previewed.

## ALA-09 Download

**Needs:** album `D` of A holding the two `dup.png` items and `ala-1` (all with real stored objects).

**Expected**

- 200, `Content-Type: application/zip`, `Cache-Control: private, no-store`, `Content-Disposition: attachment; filename="<album name>.zip"; filename*=UTF-8''<percent-encoded name>.zip`. The body starts with `PK`.
- It holds each READY item's original, oldest `takenAt` first. Names are the items' names; repeats are numbered: the two `dup.png` become `dup.png` and `dup (2).png`. A name containing `/` or `\` is changed to `_` (create an item named `a/b.png` to see it).
- An album name with characters outside ASCII or a double quote gets an ASCII fallback in `filename` (those characters become `_`) and the real name in `filename*`.
- A name that is empty, `.` or `..` gets the fallback `album` (album name) / `file` (item name); `...` is an ordinary name (`....zip`).
- An album with no READY items answers 404 `This album has no photos or videos`. Foreign, unknown and deleted albums answer 404 `Not found`.
- A seeded placeholder (no stored object) in the album: the archive is never silently shortened. If the placeholder is the **first** entry (oldest `takenAt`, which seeded rows are) the connection is closed before any status line is sent (the client sees a connection error, no 200). If a real item comes first (give the placeholder a newer `takenAt` in SQL), the answer starts as 200 and reading the body ends with a stream error (`ChunkedEncodingError` in `requests`). Try both with a fresh album.

## ALA-10 Deleting an album

**Steps and expected results** (album `X` of A holding `ala-1` and `ala-2`)

1. `DELETE /api/albums/<X>`: 204 with an empty body and `Cache-Control: private, no-store`.
2. Afterwards `GET /api/albums` no longer lists it; `PATCH`, `DELETE`, `POST`/`DELETE …/items`, `GET …/media` and `GET …/download` on it all answer 404 `Not found`; a second `DELETE` is 404.
3. `ala-1` and `ala-2` are still in `GET /api/media` and their files still answer 302.
4. In the database the album row has `deletedAt` set and the `album_media` rows are still there (a soft delete cascades nothing).
5. B's `DELETE` on A's album is 404 and A's album remains.

## ALA-11 Isolation between accounts

With account B signed in (its own cookie jar) and A's album `T` holding items:

| Request by B                                                | Expected                                       |
| ----------------------------------------------------------- | ---------------------------------------------- |
| `GET /api/albums`                                           | A's albums are not in it (B's own albums only) |
| `GET /api/albums/<T>/media`, `GET /api/albums/<T>/download` | 404                                            |
| `PATCH /api/albums/<T>`, `DELETE /api/albums/<T>`           | 404, `T` unchanged                             |
| `POST /api/albums/<T>/items` with B's own item              | 404, nothing added                             |
| `DELETE /api/albums/<T>/items` with A's item                | 404, nothing removed                           |
| `POST /api/albums/<B's album>/items` with A's item          | 404, nothing added                             |
| `DELETE /api/media` with A's item (API-09)                  | 200 `{"deleted":0}`, A's item untouched        |

Then, as A: everything above is unchanged.

## ALA-12 Uploading into an album

**Steps and expected results**

1. Create an upload as A, send its original, then `POST /api/media/<id>/complete` with `{"albumId":"<T>"}`: 200 and the item; it is now in `GET /api/albums/<T>/media` and `T`'s `count` rose and `updatedAt` moved.
2. Complete another upload with `{"albumId":"<B's album>"}`: 200, the item is READY and in the library, but in **no** album (a foreign album is ignored, not an error). The same for an unknown id, a deleted album, `{"albumId":5}`, `{}` and no body.
3. A complete that fails (nothing uploaded: 409) links nothing.
