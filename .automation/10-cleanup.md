# 10 · Cleanup

Removes everything the run created. Always run it, also after failures or when the run was interrupted (a second run finds the leftovers by the QA email pattern).

## CLN-01 Page state

**Steps:** put back anything wrapped in the page (`fetch`, `XMLHttpRequest`, observers) by reloading it, delete the QA credentials you may have kept in `localStorage` (for example under `qa-user`), then sign out.

**Expected:** no session (`GET /api/auth/get-session` returns `null`), no QA data left in the origin's storage.

## CLN-02 Delete the QA accounts and their media

**Safety:** the only thing that may be deleted is a user whose email matches `qa-%@example.test` (SQL `like`) and what belongs to it. Show the list first and check it by eye: if a single address in it is not a throwaway one, stop.

**Steps**

1. List the users whose email matches `qa-%@example.test` (id and email).
2. Delete those users from the database. Their sessions, accounts, media rows and albums go with them (cascade).
3. For each deleted user id, delete every object in the `media` bucket under the prefix `<userId>/` (original and thumbnail objects). Use an S3 client with the local RustFS credentials; the bucket is private.
4. Count the users, the rows in `media` and the objects in the bucket again.

**Expected:** no user with a `qa-…@example.test` email remains, and the three counts equal the baseline recorded in SET-01. The owner's own account, its media and its objects are untouched.

## CLN-03 Helper processes

**Steps:** stop every helper you started for the run: servers for fixtures or for images that never answer (SET-03 and [01-test-data.md](01-test-data.md) name them) and anything listening on ports you opened.

**Expected:** nothing of yours is left listening, except possibly the preview.

## CLN-04 The preview

Stop the production preview on 4173 if this run started it and the user did not ask for it to stay up. If you leave it running, say so in the report. In both cases leave 5173 free.

## CLN-05 Report

Print the report described in [README.md](README.md): one row per case, the failures in detail, totals, and the result of CLN-02.
