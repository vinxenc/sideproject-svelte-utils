# 10 · Cleanup

Removes everything this run created, and only that. Always run it, also after failures. Accounts left behind by an earlier or a concurrent run are not this run's to delete: list them in the report and leave them unless the user confirms.

## CLN-01 Page state

**Steps:** put back anything wrapped in the page (`fetch`, `XMLHttpRequest`, observers) by reloading it, delete the QA credentials you may have kept in `localStorage` (for example under `qa-user`), then sign out.

**Expected:** no session (`GET /api/auth/get-session` returns `null`), no QA data left in the origin's storage.

## CLN-02 Delete the accounts this run created, and their media

**Safety:** delete only the user ids this run recorded: the browser account from SET-06 and the two accounts of [02-api.md](02-api.md). Each of them must also have an email that matches `qa-%@example.test` (SQL `like`) as a second guard; if one does not, stop. Do not delete by pattern alone.

**Steps**

1. Collect the ids this run recorded and read their emails back from the database. Show the list.
2. Delete exactly those users from the database. Their sessions, accounts, media rows and albums go with them (cascade).
3. For each deleted user id, delete every object in the `media` bucket under the prefix `<userId>/` (original and thumbnail objects). Use an S3 client with the local RustFS credentials; the bucket is private.
4. Count the users, the rows in `media` and the objects in the bucket again.
5. List any other user whose email matches `qa-%@example.test`. Report them as leftovers of another run; delete them only if the user says so.

**Expected:** none of this run's accounts remains, and the three counts equal the baseline recorded in SET-01 (leftovers of other runs were already counted there). The owner's own account, its media and its objects are untouched.

## CLN-03 Helper processes

**Steps:** stop every helper you started for the run: servers for fixtures or for images that never answer (SET-03 and [01-test-data.md](01-test-data.md) name them) and anything listening on ports you opened.

**Expected:** nothing of yours is left listening, except possibly the preview.

## CLN-04 The preview

Stop the production preview on 4173 if this run started it and the user did not ask for it to stay up. If you leave it running, say so in the report. In both cases leave 5173 free.

## CLN-05 Report

Print the report described in [README.md](README.md): one row per case, the failures in detail, totals, and the result of CLN-02.
