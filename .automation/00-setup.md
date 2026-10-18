# 00 · Setup

Prepares the machine, the app and a throwaway account. Nothing here tests the gallery yet, but a failed step stops the run.

## SET-01 Services and environment

**Steps**

1. From the repo root, start the local services with `docker compose up -d --wait`. That gives Postgres on 5432, RustFS (S3) on 9000 (console on 9001) and Mailpit (SMTP on 1025, mail API and UI on 8025). A one-shot container creates the `media` bucket and a CORS rule that allows `GET`, `PUT` and `HEAD` from `http://localhost:4173` and `http://localhost:5173`.
2. Check that `.env` exists in the repo root, set up as README.md ("Local .env") says. Do not print its contents.
3. Check that the database is migrated (`pnpm db:migrate`), so the `media`, `album`, `album_media` and `password` tables exist.
4. Record the **baseline** for the final check in [10-cleanup.md](10-cleanup.md). All counts are of every row, soft-deleted ones included (plain SQL `count(*)`; see "Reading what is stored" in [01-test-data.md](01-test-data.md)):
   - rows in `user`, `media`, `album`, `album_media`, `password` and `verification`;
   - objects in the `media` bucket;
   - messages in Mailpit (`GET http://localhost:8025/api/v1/messages?limit=1` answers `total`).

**Expected:** the `postgres`, `rustfs` and `mailpit` services are healthy, the bucket and the tables exist, and you have the baseline numbers. Other people's data (users, albums, messages of earlier runs or of the owner) is part of the baseline: it is never touched.

## SET-02 Quality gate

**Steps:** run `pnpm check`, `pnpm lint`, `pnpm test:cov` and `pnpm build` in the repo root.

**Expected:** all four succeed (type check with 0 errors and 0 warnings, prettier and eslint clean, tests passing with coverage at 90% or more for statements, branches, functions and lines, build finished). If one fails, stop and report: the cases test that build.

## SET-03 Free the ports

**Steps:** find every process _listening_ on TCP 4173 and on TCP 5173 and stop it (ask it to exit first, force it only if it ignores that). Do not touch processes that only have a connection to those ports, such as a browser.

**Expected:** nothing listens on 4173 or 5173. Also stop any leftover helper servers from an earlier run (see [01-test-data.md](01-test-data.md)).

## SET-04 Start the production preview

**Steps**

1. Start the preview of the build from SET-02 with `pnpm preview` (it serves `.svelte-kit/output` on port 4173 and refuses to start if the port is taken), or with the `preview` entry of `.claude/launch.json`. Keep it running for the whole run.
2. Request `http://localhost:4173/sign-in`.

**Expected:** HTTP 200 and the sign-in page. Never start `pnpm dev` and never use a different port.

## SET-05 Fresh browser state

**Steps**

1. Open `http://localhost:4173/sign-in` in the browser.
2. Remove every service worker registered for this origin and delete every Cache Storage entry, then reload. An older build's worker would otherwise serve stale files.
3. Remove the keys an earlier run may have left in `localStorage` (for example `qa-user`) and in `sessionStorage` (`utilities:verify-email`). Do not wipe the rest of the origin's storage: in the owner's real browser profile (Claude in Chrome) it holds their own settings, such as the theme choice.
4. Look at who is signed in (`GET /api/auth/get-session`, returns `null` when nobody is). If a session exists and it is not a `qa-…@example.test` account, stop and ask the user before signing it out. A QA session left by an earlier run can simply be signed out.
5. With nobody signed in, request `GET /api/media`, `GET /api/albums` and `POST /api/passwords/x/reveal`, then open `/dashboard`, `/photo-video`, `/photo-video/albums` and `/passwords` in the browser.

**Expected:** the three API requests answer 401; every page redirects to `/sign-in`.

## SET-06 Create the QA account

Sign-up needs an email code now, so this takes four steps. The technique is "QA accounts" in [01-test-data.md](01-test-data.md); read its pacing note first (rate limits).

**Steps**

1. In the page (same origin), `POST /api/auth/sign-up/email` with `{ name, email, password }`. Use an email like `qa-ui-<8 random hex>@example.test`, a name such as `QA UI`, and a long random password.
2. Check that the answer is 200, that `GET /api/auth/get-session` is still `null` (sign-up no longer signs the browser in) and that the user's row has `emailVerified` false. Note the new user's id: `user.id` from the answer if it carries one, otherwise read it from the database by email. Seeding and cleanup need it.
3. Read the code from Mailpit with the shell (not from the page: Mailpit is another origin), then `POST /api/auth/email-otp/verify-email` from the page with `{ email, otp, password }`.
4. Keep the password only in memory, or in `localStorage` under a key such as `qa-user` if a case has to sign in again. Never show it in the report.

If Mailpit cannot be reached or the rate limit keeps refusing, the last resort is: after step 1 set `emailVerified` to true in the database for this QA user only (`WHERE id = '<id>' AND email LIKE 'qa-%@example.test'`) and sign in with `POST /api/auth/sign-in/email`. Say in the report that the code path was skipped; [16-auth-verification.md](16-auth-verification.md) covers it separately.

**Expected:** after step 3 HTTP 200 and `GET /api/auth/get-session` returns the QA user with `emailVerified` true.

## SET-07 Smoke test of the app shell

**Steps**

1. Open `http://localhost:4173/dashboard`.
2. Click `Photo & video` in the sidebar, then `Passwords`.

**Expected**

- The address is `/dashboard`, then `/photo-video`, then `/passwords`: every sidebar entry is a link to its own page (`Home` is `/dashboard`, the other entries without a page of their own go to `/dashboard?section=<slug>`).
- The page title is `Home · Utilities` on the dashboard, `Photo & video · Utilities` after the first click and `Passwords · Utilities` after the second.
- The sidebar lists, in order: Home, Photo & video, Passwords, Notifications, Navigation, Appearance, Messages & media, Language & region, Accessibility, Mark as read, Connected accounts, Privacy & visibility, Advanced. The entry of the page being shown is highlighted. Its footer shows the QA user's name and email and a `Sign out` button.
- The breadcrumb has no `Settings` part: it reads `Photo & video` on the library page and `Passwords` on the vault page.
- On `/photo-video` there is an `Albums` section above a `Library` heading, and a round button in the bottom-right corner whose accessible name is `Add photos and videos`.

## Notes for the later cases

- The pages are real routes: `/photo-video` (library and album strip), `/photo-video/albums` (all albums), `/photo-video/albums/<id>` (one album), `/passwords` (the vault). Switching between them with the sidebar links or the app's own links is client-side navigation: the page is not reloaded, so state held in the page (a wrapped `fetch`, observers, the upload store) survives it. Switching to `Home` and back to `Photo & video` leaves and re-enters the gallery, which is how cases "leave the page" and "reload the list" without a full page load. `navigate` and a reload are full page loads.
- Signing out goes to `/sign-in` through client-side navigation too, so state held in the page survives it.
- Rows are never really removed by the app: deleting media, albums and passwords sets `deletedAt` (soft delete, `AGENTS.md`), and the objects stay in the bucket. Cases that delete things check the soft-deleted rows; only [10-cleanup.md](10-cleanup.md) removes data for good.
