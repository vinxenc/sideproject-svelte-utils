# 15 · The password vault (`/passwords`)

The vault of [docs/password-management-plan.md](../docs/password-management-plan.md), Phase 1: add, list, tabs, search, reveal, delete, and the API behind it. Phase 1 keeps passwords as **plain text** in the `password` table; encryption and the passkey gate (Phase 2) are not built, so there is nothing to test for them yet. Deleting is a soft delete (`deletedAt`).

> Executed in part 2 of the first run (2026-10-18): PWD-01 to PWD-11 and PWA-01 to PWA-07 all pass; wording fixed (open the sheet with a real click, the 404 reveal toast text).

The UI cases (PWD) use the browser account; the API cases (PWA) use accounts A and B of [02-api.md](02-api.md) with their cookie jars (see the rate-limit note in [01-test-data.md](01-test-data.md)). Passwords below are made up for the run, for example `QA-pw-<8 hex>-A!`; never print them in the report and never use a real one.

Labels: the page has an `h1` `Passwords`, a button `Add` at its right, a search field (accessible name `Search passwords`, placeholder `Search`), a strip of tabs `All`, `App`, `Credit card`, `API key`, `PIN platform`, and the list. A row shows a letter tile, the name, the username (or the type's label when there is none) and an eye button named `Show password for <name>` / `Hide password for <name>`. After swiping the row sideways a trash tile named `Delete <name>` shows.

## PWD-01 The page, nav entry and empty state

**Needs:** the browser account with no passwords, signed in.

**Steps:** click `Passwords` in the sidebar (third entry, after `Photo & video`). Take one screenshot.

**Expected**

- The address is `/passwords`, the title `Passwords · Utilities`, the breadcrumb `Passwords`, the sidebar entry highlighted.
- The five tabs in that order with `All` selected, the search field, the `Add` button.
- The empty state: a key icon, title `No passwords yet`, text `Add your first one with the Add button.` and a button `Add password`, which opens the same sheet as `Add`.
- No toast.

## PWD-02 Adding a password

**Steps**

1. Click `Add`. Read the sheet. Try `Save` with the fields empty.
2. Fill `Name` = `QA GitHub`, leave the type, `Username or email (optional)` = `qa-user@example.test`, `Password` = a made-up password (type it with the field masked; press the eye to show it and press it again).
3. With the request recorder armed, press `Save`.

**Expected**

- Step 1: a sheet from the right (full width on a phone) titled `Add password` with the text `Saved to your vault. Only you can see it.`; fields `Name`, a `Type` group of four toggle buttons (`App`, `Credit card`, `API key`, `PIN platform`; `App` is on, and pressing the selected one again does not turn it off), `Username or email (optional)` and `Password` with an eye button (`Show password` / `Hide password`); buttons `Save` (disabled until a name and a password are filled) and `Cancel`.
- Step 2: the password field is masked until the eye is pressed and is masked again after the second press.
- Step 3: one request, `POST /api/passwords` with `{"name":"QA GitHub","username":"qa-user@example.test","password":"…","type":"APP"}`, answered 201 with the item (no password in it). A toast `Password saved`; the sheet closes; the list refreshes and shows the new row at the top: an `Q` tile, `QA GitHub`, `qa-user@example.test`, the eye. The empty state is gone.
- Reopening `Add` shows empty fields, type `App`, masked password (nothing is kept from before).

## PWD-03 Types, tabs and the empty tab

**Steps**

1. With only `QA GitHub` in the vault, open the `Credit card` tab.
2. Add `QA Visa` (type `Credit card`, no username) while the `App` tab is open, then `QA Stripe key` (type `API key`, username `ops@example.test`) and `QA Bank PIN` (type `PIN platform`, password `4821`) from the `All` tab. Watch the tabs after each save.
3. Click each tab in turn and list the rows.
4. Open the `API key` tab and click `Add`.

**Expected**

- Step 1: the `Credit card` tab shows the empty state `Nothing here yet` with the text `Add a password and choose Credit card as its type.` and a button `Add password`.
- Step 2: adding while the `All` tab is open keeps `All` and shows the entry; adding from a **different** tab switches to the new entry's type tab (`QA Visa` added while `App` is open: the `Credit card` tab becomes selected). A search text that would hide the new entry is cleared. Open the sheet with a real click on `Add`: when a script opens it, the focus goes back to the tab that was last clicked once the sheet closes, and that tab selects itself again, which undoes the switch (a test artefact, not a bug).
- Step 3: `All` lists the four newest first (`QA Bank PIN`, `QA Stripe key`, `QA Visa`, `QA GitHub`); each type tab lists only its own entry. The row's second line is the username, or the type's label (`Credit card`, `PIN platform`) when there is none.
- Step 4: the sheet opens with `API key` already selected (the current tab's type; on `All` it is `App`).
- The selected tab's label stays fully inside the tab strip (it scrolls by itself if the strip overflows).

## PWD-04 Search

**Steps** (arm the request recorder, type slowly)

1. On `All` type `git`, then `GITHUB`, then `  git  `.
2. Clear it and type `example.test`.
3. Switch to the `Credit card` tab and type `git`.
4. Type a fragment of one of the made-up passwords.
5. On `All` type `zzzz`, press `Clear search`.

**Expected**

- Step 1: only `QA GitHub` in every case (case-insensitive, surrounding spaces ignored, a substring of the name).
- Step 2: the two entries whose username contains `example.test` (`QA GitHub`, `QA Stripe key`), not the others.
- Step 3: the search only looks inside the tab: `No results` with the text `No names or usernames match "git".` and a `Clear search` button (a different empty state than `Nothing here yet`).
- Step 4: no entry matches: passwords are never searched (and never in the page's data).
- Step 5: `No results` / `No names or usernames match "zzzz".`; `Clear search` empties the field, shows the list and puts the focus in the field.
- No network request is made while typing (the search is in the browser only).

## PWD-05 Revealing and hiding

**Steps**

1. Search the page's text for the made-up password of `QA GitHub` (`document.body.innerText`, and the HTML). Click the eye of `QA GitHub` with the recorder armed.
2. Click `Hide password for QA GitHub`; click the eye again.
3. Reveal two rows at the same time.
4. Make the reveal request fail (500 `{"message":"boom"}`) once.

**Expected**

- Step 1: before the click the page shows only `••••••••` (always eight dots, whatever the length) and a visually hidden `Hidden`; the password is nowhere in the text or HTML. During the request the eye is a disabled spinner. One request, `POST /api/passwords/<id>/reveal` (no body), answered 200 `{"password":"…"}`; the exact password then shows in a monospace line and the button reads `Hide password for QA GitHub`.
- Step 2: hiding puts the dots back and the password is gone from the page again; revealing a second time sends a **second** `POST` (nothing is cached in the page).
- Step 3: the rows reveal independently.
- Step 4: a toast `Couldn't show the password` with the description `boom`; the dots stay. If the entry was deleted elsewhere (reveal answers 404) the same toast appears (its description is `Not found`) and the list refreshes so the row leaves.
- A password with leading or trailing spaces is shown exactly as typed (it was never trimmed).

## PWD-06 The detail sheet and deleting with a confirmation

**Steps**

1. Click the row of `QA Stripe key` (its name, not the eye). Read the sheet.
2. Reveal its password in the sheet. Open the sheet of `QA Visa` (no username).
3. In the sheet of `QA Stripe key` click `Delete`. Read the dialog. Click `Cancel`.
4. Click `Delete`, then `Delete password` (recorder armed).

**Expected**

- Steps 1 and 2: a sheet with the letter tile, the name, a badge with the type (`API key`), `Username or email` (`ops@example.test`; `—` for `QA Visa`), `Password` with its own eye (long values wrap), and `Added` with the date in medium form.
- Step 3: an alert dialog `Delete "QA Stripe key"?` with `It leaves your vault.` and `Cancel` / `Delete password`. Cancel changes nothing.
- Step 4: one request, `DELETE /api/passwords/<id>` answered 204 (empty body); the dialog shows a spinner while it runs; toast `Password deleted`; the list refreshes, the row is gone and the sheet closes by itself. In the database the row has `deletedAt` set.

## PWD-07 Swipe a row to delete it (no confirmation)

**Steps**

1. Read the computed style of a row's scroller (`[data-slot="password-row"]`): `overflow-x`, `scroll-snap-type`, `overscroll-behavior-x`, and its `scrollWidth` and `clientWidth`. Read where the trash button `Delete QA Visa` is.
2. Set the scroller's `scrollLeft` to its maximum. Look again; take a small screenshot.
3. Click `Delete QA Visa` (by element reference or its own `click()`; it sits outside the visible part until the swipe) with the recorder armed.

**Expected**

- Step 1: `overflow-x: auto`, `scroll-snap-type: x mandatory`, `overscroll-behavior-x: contain`; `scrollWidth` about 88 px larger than `clientWidth` (an 80 px tile and an 8 px gap); the trash tile lies to the right of the visible part. The row is at least 90 px high.
- Step 2: the trash tile (destructive colour, trash icon) is fully visible and the card has snapped to the left; the swipe stayed inside the row, the page did not scroll sideways.
- Step 3: **no** confirmation: `DELETE /api/passwords/<id>` goes out at once (204); the tile shows a spinner and is disabled until the list has refreshed; toast `Password deleted`; the row is gone. A second click during the request sends nothing.
- A `DELETE` that fails (500 `{"message":"boom"}`) gives the toast `Couldn't delete the password` with `boom` and the row stays. A `404` (already deleted) counts as deleted: toast `Password deleted`, row gone.
- Real finger swipes cannot be driven; see [11-manual-and-gaps.md](11-manual-and-gaps.md).

## PWD-08 The page never carries a password and is not stored

**Steps**

1. With at least one entry, request `/passwords` with a full page load and look at the response headers and body (from the page: `fetch('/passwords')`).
2. Find the data request SvelteKit makes when the list refreshes (after an add: the URL ends `__data.json`; find it with `performance.getEntriesByType('resource')`), fetch it again and read headers and body.
3. After revealing and hiding, search the HTML of the whole document for each made-up password.

**Expected**

- Both responses carry `Cache-Control: private, no-store`; they contain the names and usernames but **none** of the passwords (search the body for every made-up password; each entry in the data has only the five keys `id`, `name`, `username`, `type`, `createdAt`).
- The document never contains a password except while it is revealed (PWD-05). RES-04 checks the service worker does not keep these responses.

## PWD-09 Add form errors

**Steps**

1. Click `Add`. Type spaces only in `Name` and something in `Password`.
2. Set `Name` to `a<TAB>b` from the page (a tab character) and press `Save`. Then `Username or email` to `a<TAB>b` with a good name.
3. Set the password to a value containing U+0000 (from the page) and press `Save`.
4. With a good form, make `POST /api/passwords` answer 500 `{"message":"boom"}` and press `Save`; then restore `fetch` and press `Save` again.

**Expected**

- Step 1: `Save` stays disabled while the name is blank or the password is empty (a password of only spaces is allowed and counts as filled).
- Step 2: under the field, `Names can't contain line breaks`, then `Usernames can't contain line breaks`; nothing is sent. The fields stop at their `maxlength` (100, 254, 1024).
- Step 3: `Passwords can't contain null characters` under `Password`.
- Step 4: `boom` shows under the form, the sheet stays open with everything typed, and no entry is added; the second `Save` works and adds **one** entry.

## PWD-10 Entries persist

**Steps:** reload the page (full load), then click `Home` and `Passwords`.

**Expected:** the same entries in the same order (newest first) each time; the `All` tab and an empty search field after a full load; passwords hidden. Entries belong to the account: they are not in account A's page (PWA-06).

## PWD-11 The vault on a phone

**Needs:** phone preset (375 × 812), at least two entries. Reset the viewport at the end.

**Steps:** open `/passwords`, read the layout, set a row's `scrollLeft` as in PWD-07, select the last tab (`PIN platform`), open `Add`.

**Expected**

- The document is no wider than the viewport; the row's trash tile is outside the visible part at rest and visible after the scroll; the card is not narrower than the row.
- If the tab strip overflows, it scrolls on its own (never the window) and the selected last label ends fully visible, a few pixels (about 24) from the strip's edge unless it is at the end of the strip.
- The `Add password` sheet fills the whole width and its fields and buttons are reachable without sideways scrolling.

## PWA-01 A session is required

| Request (no session)                    | Expected          |
| --------------------------------------- | ----------------- |
| `POST /api/passwords` with a valid body | 401               |
| `DELETE /api/passwords/x`               | 401               |
| `POST /api/passwords/x/reveal`          | 401               |
| `GET /passwords` (the page)             | 303 to `/sign-in` |

## PWA-02 Creating

**Steps and expected results (account A)**

1. `POST /api/passwords` `{"name":"  Site  ","type":"APP","username":"  me@example.test  ","password":"  pw with spaces  "}`: 201, `Cache-Control: private, no-store`, **exactly these five keys**: `id`, `name`, `username`, `type`, `createdAt`. `name` is `Site`, `username` `me@example.test` (both trimmed); there is no `password` key.
2. Reveal it (PWA-04): the password comes back exactly as sent, spaces included.
3. `username` omitted, `null`, `""` and `"   "` all give `username: null`.
4. Each of `APP`, `CREDIT_CARD`, `API_KEY` and `PIN_PLATFORM` is accepted; a password of exactly 1,024 characters and a name of exactly 100 characters are accepted, as is a username of 254 characters.

## PWA-03 Validation

The checks run in this order and the first failure is reported; every 400 stores nothing.

| Body                                                       | Message                                   |
| ---------------------------------------------------------- | ----------------------------------------- |
| no body, a body that is not JSON, `null`, `[]`, `"x"`, `5` | `Invalid request`                         |
| `name` missing, not a string, `""` or spaces only          | `Enter a name`                            |
| `name` of 101 characters                                   | `Names can be up to 100 characters`       |
| `name` with a control character (line feed, tab, U+007F)   | `Names can't contain line breaks`         |
| `type` missing, lower case (`app`) or unknown              | `Choose a type`                           |
| `username` that is a number, an object or an array         | `Invalid username`                        |
| `username` of 255 characters                               | `Usernames can be up to 254 characters`   |
| `username` with a control character                        | `Usernames can't contain line breaks`     |
| `password` missing, not a string or `""`                   | `Enter a password`                        |
| `password` containing U+0000                               | `Passwords can't contain null characters` |
| `password` of 1,025 characters                             | `Passwords can be up to 1024 characters`  |
| a bad `name` and a bad `type` together                     | the `name` message (order)                |

A password with other control characters (a tab, a line feed) is accepted.

## PWA-04 Revealing

**Steps and expected results**

1. `POST /api/passwords/<id>/reveal` as the owner (no body): 200, `Cache-Control: private, no-store`, body exactly `{"password":"…"}` with the stored text.
2. `GET /api/passwords/<id>/reveal` and `GET`, `PUT`, `PATCH` on `/api/passwords/<id>`: 405 (the only handlers are `POST` for reveal and `DELETE` for an entry).
3. `GET /api/passwords` is 405 as well: there is no list endpoint, so a password can only leave through the owner's reveal.
4. An unknown id, a deleted entry and an entry of the other account answer 404 `Not found`.

## PWA-05 Deleting

**Steps and expected results**

1. `DELETE /api/passwords/<id>` as the owner: 204, empty body, `Cache-Control: private, no-store`.
2. The same again: 404. Reveal after the delete: 404. The page `/passwords` no longer lists it.
3. As B on A's entry: 404, and A can still reveal it afterwards.
4. In the database the deleted row has `deletedAt` set and still exists; B's and A's other rows are untouched.

## PWA-06 Isolation and the page

**Steps and expected results** (A owns entries named `A-secret-name-<hex>`; B owns none)

1. B: `POST /api/passwords/<A's id>/reveal` and `DELETE /api/passwords/<A's id>`: 404 each.
2. B: `GET /passwords` (full page, B's cookie jar): 200 with `Cache-Control: private, no-store`; the HTML contains none of A's names or usernames. A's `GET /passwords` contains A's names and usernames and **no password**.
3. A: the page data request found in PWD-08 has the same no-store header and no password.

## PWA-07 What is stored (Phase 1)

**Observation, not a defect:** in Phase 1 the `password` column of a live row holds the password as typed (plain text). Record it. When Phase 2 (encryption) lands this case must change to expect a `v1.…` value, and the cases above must keep passing unchanged: the API contract does not depend on how the value is stored.
