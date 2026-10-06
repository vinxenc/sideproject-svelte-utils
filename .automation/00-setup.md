# 00 · Setup

Prepares the machine, the app and a throwaway account. Nothing here tests the gallery yet, but a failed step stops the run.

## SET-01 Services and environment

**Steps**

1. From the repo root, start the local services with `docker compose up -d --wait`. That gives Postgres on 5432 and RustFS (S3) on 9000, console on 9001. A one-shot container creates the `media` bucket and a CORS rule that allows `GET`, `PUT` and `HEAD` from `http://localhost:4173` and `http://localhost:5173`.
2. Check that `.env` exists in the repo root, set up as README.md ("Local .env") says. Do not print its contents.
3. Check that the database is migrated (`pnpm db:migrate`), so the `media` table exists.
4. Record the **baseline** for the final check in [10-cleanup.md](10-cleanup.md): the number of users, the number of rows in `media`, and the number of objects in the `media` bucket.

**Expected:** the `postgres` and `rustfs` services are healthy, the bucket and the table exist, and you have three baseline numbers.

## SET-02 Quality gate

**Steps:** run `pnpm check`, `pnpm lint` and `pnpm build` in the repo root.

**Expected:** all three succeed (type check with 0 errors and 0 warnings, prettier and eslint clean, build finished). If one fails, stop and report: the cases test that build.

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
3. Remove the keys an earlier run may have left in `localStorage` (for example `qa-user`). Do not wipe the rest of the origin's storage: in the owner's real browser profile (Claude in Chrome) it holds their own settings, such as the theme choice.
4. Look at who is signed in (`GET /api/auth/get-session`, returns `null` when nobody is). If a session exists and it is not a `qa-…@example.test` account, stop and ask the user before signing it out. A QA session left by an earlier run can simply be signed out.
5. With nobody signed in, open `http://localhost:4173/dashboard` and request `GET /api/media`.

**Expected:** `/dashboard` redirects to `/sign-in`; `GET /api/media` answers 401.

## SET-06 Create the QA account

**Steps**

1. Create the account from the page: `POST /api/auth/sign-up/email` with a JSON body `{ name, email, password }` (same origin; it also signs the browser in), or use the form at `/sign-up`. Use an email like `qa-ui-<8 random hex>@example.test` and a long random password.
2. Keep the password only in memory, or in `localStorage` under a key such as `qa-user` if a case has to sign in again. Never show it in the report.
3. Note the new user's id from the response (`user.id`). Seeding and cleanup need it.

**Expected:** HTTP 200, and `GET /api/auth/get-session` now returns the QA user.

## SET-07 Smoke test of the dashboard

**Steps**

1. Open `http://localhost:4173/dashboard`.
2. Click `Photo & video` in the sidebar.

**Expected**

- The page title is `Home · Utilities` on the dashboard and `Photo & video · Utilities` after the click.
- The sidebar lists, in order: Home, Photo & video, Notifications, Navigation, Appearance, Messages & media, Language & region, Accessibility, Mark as read, Connected accounts, Privacy & visibility, Advanced. Its footer shows the QA user's name and email and a `Sign out` button.
- On a wide window the breadcrumb reads `Settings › Photo & video`.
- The gallery area is shown with a round button in the bottom-right corner whose accessible name is `Add photos and videos`.

## Notes for the later cases

- The sidebar pages are chosen by page state, not by URL: the address stays `/dashboard`. Switching to `Home` and back to `Photo & video` leaves and re-enters the gallery, which is how cases "leave the page" and "reload the list" without a full page load.
- The gallery needs a session; signing out goes to `/sign-in` through client-side navigation, so state held in the page survives it.
