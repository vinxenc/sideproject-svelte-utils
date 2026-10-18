# 10 · Cleanup

Removes everything this run created, and only that. Always run it last, after file 09 (which itself runs after 16), also after failures. Accounts left behind by an earlier or a concurrent run are not this run's to delete: list them in the report and leave them unless the user confirms.

The app never really deletes media, albums or passwords: it sets `deletedAt` (soft delete), keeps the `album_media` links and leaves the objects in the bucket. So "delete through the app" is not cleanup; the data of the run's QA users is removed here, in the database and the bucket, by user id.

## CLN-01 Page state

**Steps:** put back anything wrapped in the page (`fetch`, `XMLHttpRequest`, observers) by reloading it, reset the viewport to desktop, delete the QA credentials you may have kept in `localStorage` (for example under `qa-user`) and `sessionStorage` (`utilities:verify-email`), then sign out.

**Expected:** no session (`GET /api/auth/get-session` returns `null`), no QA data left in the origin's storage.

## CLN-02 Delete the accounts this run created, and everything they own

**Safety:** delete only the user ids this run recorded: the browser account from SET-06, accounts A and B of [02-api.md](02-api.md), the two accounts of [16-auth-verification.md](16-auth-verification.md) (`qa-ver-…`, `qa-ver2-…`) and any other `qa-…` account this run made. Each of them must also have an email that matches `qa-%@example.test` (SQL `like`) as a second guard; if one does not, stop. Do not delete by pattern alone, and never by a bare `LIKE` without the id list: another run may be using other `qa-…` accounts at the same time. Every statement below carries `"userId" IN (<this run's ids>)` or `id IN (<this run's ids>)`.

**Steps**

1. Collect the ids this run recorded and read their emails back from the database. Show the list.
2. In the database delete exactly those users: `DELETE FROM "user" WHERE id IN (…) AND email LIKE 'qa-%@example.test'`. The foreign keys cascade to their sessions, accounts, media (soft-deleted rows included), albums, `album_media` links and passwords. (`album.coverId` is set to null on its way.) If a row was re-claimed by VER-08, the id changed: delete the id the database holds now for that email, and only if that email is one of this run's.
3. `verification` rows have no link to the user and stay behind: `DELETE FROM verification WHERE identifier IN ('email-verification-otp-<email>', …)` for this run's emails only (that is the identifier format of the sign-up codes; if the table holds other `-otp-` identifiers of these emails, such as `sign-in-otp-<email>`, delete those too).
4. For each deleted user id, delete every object in the `media` bucket under the prefix `<userId>/` (originals and thumbnails). This includes the objects of soft-deleted items, which are still there. Use an S3 client with the local RustFS credentials (see `.env`; the bucket is private) and make sure the prefix is the full id followed by `/`.
5. Delete this run's mail from Mailpit by address, not the whole box: for each of this run's emails `DELETE http://localhost:8025/api/v1/search?query=to:<email>` (or delete the messages by `ID`). Never `DELETE /api/v1/messages`: it wipes other people's mail.
6. Count again: rows in `user`, `media`, `album`, `album_media`, `password` and `verification`, the objects in the bucket and the messages in Mailpit.
7. List any other user whose email matches `qa-%@example.test`. Report them as leftovers of another run; delete them only if the user says so.

**Expected:** none of this run's accounts remains, and every count equals the baseline recorded in SET-01 (leftovers of other runs were already counted there), with one exception: `verification`. The app deletes sign-up codes by itself (a code is consumed on a successful verify, and expired or replaced rows go the next time the address is used), so the table can shrink during a run without the run deleting anything: in the first run the 3 baseline rows were gone after the sign-up cases and the table read 0 at the end. For `verification` check only that no row for this run's identifiers is left and that the count is not above the baseline. The owner's own account, its media, albums, passwords and objects are untouched. The `rateLimit` rows are shared counters of the machine, not data of this run; leave them.

## CLN-03 Purging the run's data safely, in the middle of a run (optional)

Cases that seed many rows (placeholders, 70 albums) clean up after themselves with the same rule, by user id and prefix, for example:

```sql
DELETE FROM media WHERE "userId" = '<this run's user id>' AND name LIKE 'seed-%';
DELETE FROM album WHERE "userId" = '<this run's user id>' AND name LIKE 'seedalb-%';
```

`album_media` links go with their album or media row (cascade). Hard deletes like these go straight to SQL, not through the app's soft-deleting client. Remove only the objects under each deleted media id's `<userId>/<mediaId>/` prefix (never CLN-02 step 4's `<userId>/` prefix, which would also take the objects of media this case did not select), or leave them for the final cleanup.

**Expected:** only rows of the named user and prefix are gone (count before and after).

## CLN-04 Helper processes

**Steps:** stop every helper you started for the run: servers for fixtures or for images that never answer (SET-03 and [01-test-data.md](01-test-data.md) name them) and anything listening on ports you opened.

**Expected:** nothing of yours is left listening, except possibly the preview.

## CLN-05 The preview

Stop the production preview on 4173 if this run started it and the user did not ask for it to stay up. If you leave it running, say so in the report. In both cases leave 5173 free.

## CLN-06 Report

Print the report described in [README.md](README.md): one row per case, the failures in detail, totals, the cases that stayed `SKIPPED` and why, and the result of CLN-02.
