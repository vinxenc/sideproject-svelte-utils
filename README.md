# Utilities

An installable Progressive Web App (PWA) for web, mobile and desktop, built with SvelteKit. Local development only for now; hosting is not chosen yet.

## Tech stack

| Layer     | Choice                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | [SvelteKit 3](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/docs/svelte) (runes), TypeScript                                                                                                                   |
| UI        | [shadcn-svelte](https://shadcn-svelte.com) (style `nova`, base color `neutral`), [Bits UI](https://bits-ui.com), [Lucide](https://lucide.dev) icons, [mode-watcher](https://mode-watcher.svecosystem.com) for dark/light mode |
| Styling   | [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`, Inter font                                                                                                                                                |
| PWA       | SvelteKit built-in service worker + static web manifest, icons from `@vite-pwa/assets-generator`                                                                                                                              |
| Auth / DB | [Better Auth](https://www.better-auth.com) (email + password with email-OTP verification) → [Prisma 7](https://www.prisma.io/docs) + `@prisma/adapter-pg` → PostgreSQL 18 (local: Docker, `docker-compose.yml`)               |
| Mail      | Plain-text mail through a `Mailer` adapter (`src/lib/server/mail/`), SMTP via [Nodemailer](https://nodemailer.com); local: [Mailpit](https://mailpit.axllent.org)                                                             |
| Hosting   | Not chosen yet; local only (`pnpm dev`, `pnpm preview`)                                                                                                                                                                       |
| Tooling   | pnpm, Vite 8, Vitest, ESLint, Prettier, svelte-check, [Lefthook](https://lefthook.dev) (git hooks)                                                                                                                            |

## Architecture

```
Browser / installed PWA
  │
  ├── Service worker (src/service-worker/)
  │     • build output + /static: precached, cache-first
  │     • pages & data: network-first, cache fallback when offline
  │
  ▼
SvelteKit server (Node: vite dev / vite preview)
  ├── /api/auth/*     → Better Auth (src/routes/api/auth/)
  └── everything else → SvelteKit SSR (routes in src/routes/)
```

One codebase serves every platform: the PWA is installable from Chrome/Edge/Safari on desktop, Android and iOS. Native wrappers (Tauri, Capacitor) can be added later on top of the same app.

### Project layout

```
src/
  app.html                 HTML shell: manifest, icons, theme-color
  routes/
    +layout.svelte         root layout: layout.css, ModeWatcher, header
    layout.css             Tailwind + shadcn theme tokens (light/dark)
    +page.server.ts        "/" redirects to /dashboard
    (app)/                 requires a session, else redirects to /sign-in
      dashboard/           landing page after sign-in/verification (sidebar-13 layout, full page)
      passwords/           password vault: list, search, add, reveal, delete (see "Passwords" below)
    api/auth/[...all]/     Better Auth REST API (sign-in, sign-up, get-session, …)
    api/passwords/         POST /api/passwords, DELETE /api/passwords/[id], POST /api/passwords/[id]/reveal (no-store)
    (guest)/               redirects signed-in users to /dashboard
      sign-in/  sign-up/   auth pages (shadcn blocks login-02, signup-02)
      verify-email/        enter the sign-up code (shadcn input-otp, otp-02 layout)
  env.ts                   env var definitions (read via $app/env/private)
  hooks.server.ts          fills locals.user via lib/server/session.ts
  lib/
    server/
      auth.ts              "auth service": Better Auth + Prisma; access token = 5-min JWT cookie signed with a key pair (jwt plugin), refresh token = session cookie
      session.ts           "app" side: verifies the access token with the public keys from /api/auth/jwks, refreshes via /api/auth/get-session
      prisma/              generated Prisma client (gitignored, `pnpm db:generate`)
      mail/                `Mailer` adapter: `mailer.ts` (interface), `smtp-mailer.ts` (nodemailer), `messages.ts` (plain-text bodies), `index.ts` (picks the provider)
      email-otp.ts         `EmailOtp`: send/verify a one-time code to the session user's email (Better Auth `emailOTP` plugin as engine)
      email-verification.ts  sign-up verification: already-verified guard, mail callback, rate-limit options
      client-ip.ts         client IP header for Better Auth's rate limiter
    auth-client.ts         Better Auth Svelte client (authClient.signIn / useSession / …)
    verify-email.ts        verify page helpers (sessionStorage hand-off, masking, error texts)
    passwords/             shared password types and checks, avatar colours, search and tab-strip helpers, client API
    components/
      ui/                  shadcn-svelte components (generated, managed by the CLI)
      site-header.svelte   dark/light toggle (top-right); logo bar only in the desktop app title bar
      login-form.svelte    sign-in form
      signup-form.svelte   sign-up form
      verify-email-form.svelte  verify page form (6-box code entry, resend)
      passwords/           password vault components (row, reveal, add and detail sheets)
    utils.ts               cn() + shadcn helper types
  service-worker/          offline caching (own tsconfig, WebWorker types)
prisma/schema.prisma       Better Auth models (user, session, account, verification, jwks, rateLimit)
prisma/migrations/         SQL migrations (prisma migrate dev)
docker-compose.yml         local Postgres 18, RustFS and Mailpit
prisma.config.ts           Prisma CLI config: loads .env (dotenv), DATABASE_URL from the environment
static/                    manifest.webmanifest, icons, robots.txt
test/unittest/             Vitest tests, same folder layout as src/ (plus setup.ts and helpers/); pnpm test, pnpm test:cov
components.json            shadcn-svelte config
lefthook.yml               pre-commit hook: check, lint, unit tests with the coverage gate
vite.config.ts             SvelteKit + Tailwind (no adapter until hosting is chosen)
```

### Conventions

- **Imports use `#lib`**, not `$lib`. SvelteKit 3 uses Node subpath imports (see `imports` in `package.json`), e.g. `import { Button } from '#lib/components/ui/button/index.js'`.
- **UI components** come from the shadcn-svelte CLI. Don't hand-write what the registry already provides:
  ```sh
  pnpm dlx shadcn-svelte@latest add dialog
  ```
- **Use theme tokens** (`bg-background`, `text-muted-foreground`, …) instead of raw Tailwind colours, so dark mode keeps working.

## Getting started

Requirements: Node 22.17+, pnpm 9+ and Docker (for the local Postgres).

```sh
pnpm install                  # also generates the Prisma client
cp .env.example .env          # ready to use as is, see "Local .env" below
docker compose up -d --wait   # Postgres on :5432, RustFS (S3) on :9000, console on :9001, Mailpit SMTP on :1025, mail UI on :8025
pnpm db:migrate               # apply migrations
pnpm dev                      # dev server at http://localhost:5173
```

`docker compose down` stops Postgres, RustFS and Mailpit and keeps their data; `docker compose down -v` also wipes it.

Mail the app sends locally shows up at http://localhost:8025 (Mailpit); nothing is delivered. A `.env` made before mail was added lacks `SMTP_URL` and `MAIL_FROM`: re-run `cp .env.example .env`.

### Local .env

Never commit `.env*` files other than `.env.example`. `.env.example` deliberately holds the shared **local-dev** `BETTER_AUTH_SECRET` (this repository is public, so never use that value outside local development, and never put any other real secret in it).

Every checkout and git worktree (including agent worktrees under `.claude/worktrees/`) shares the same Docker Postgres. Better Auth encrypts its signing key in that database's `jwks` table with `BETTER_AUTH_SECRET`, so **all of them must use the same secret**; a different one makes sign-in and sign-up fail with `Failed to decrypt private key`.

To set up `.env` in a new checkout or worktree, always do exactly this (in every session):

1. `cp .env.example .env`. Every value, including `BETTER_AUTH_SECRET`, already matches `docker-compose.yml` and the shared database. Don't copy the secret from another checkout's `.env` and don't generate a new one: a stale or hand-edited `.env` is what causes the `Failed to decrypt private key` 500.
2. If an existing `.env` returns that 500, re-copy `BETTER_AUTH_SECRET` from `.env.example`.
3. To rotate it (fresh or wiped database only): set a new value in `.env.example` (`openssl rand -base64 32`), delete the rows in the `jwks` table so Better Auth creates a new key, and update every checkout's `.env`; this signs everyone out.

Auth endpoints live under `/api/auth/*` (e.g. `POST /api/auth/sign-up/email`). API docs: `/api/auth/reference` (Scalar UI), raw OpenAPI JSON: `/api/auth/open-api/generate-schema`, public signing keys: `/api/auth/jwks`.

The service worker only runs in production builds. To test the production build and the PWA (offline, install) locally:

```sh
pnpm build
pnpm preview        # http://localhost:4173
```

Then open it in Chrome or Edge and use the install icon in the address bar to install it as a desktop app. `localhost` counts as a secure origin, so installation works locally.

## Passwords

The vault at `/passwords` keeps one user's entries: a name, a type (app, credit card, API key or PIN platform), an optional username or email, and a password.

- **Phase 1 stores passwords as plain text** in the `password` table, so anyone with database access can read them. This is an interim state.
- The list and page data never include a password. Reveal is a `POST /api/passwords/:id/reveal` answered with `Cache-Control: private, no-store`, and the service worker never caches it.
- Phase 2 (encryption and passkeys) is planned in [docs/password-management-plan.md](docs/password-management-plan.md).

## Email OTP

- **Sign-up verification (plugin-native consumer):**
  - Flow: sign-up → no session → code mailed → `/verify-email` → `email-otp/verify-email` verifies and signs in.
  - An unverified sign-in returns 403 and re-mails a code.
  - The email travels via `sessionStorage`, never the URL. `/verify-email` shows it masked (`tr******@gmail.com`) and has no email field; a tab with nothing pending is sent to `/sign-in`, where an unverified sign-in mails a fresh code.
  - Only `email-otp/verify-email` and `email-otp/send-verification-otp` are open. Every other email-otp route, plus core `/verify-email` and `/send-verification-email`, answers 404.
  - The already-verified guard (`beforeEmailVerification`): a mailbox alone never yields a session for a verified account.
  - The callback mails only `email-verification` codes, and only to unverified users. The open send route refuses any other `type` (400), because it stores a code row for whatever type it is given.
  - A sign-up with a taken (verified) email answers like a new one and mails nothing.
  - **Pre-registration hijack (closed):** someone who signs up first with a victim's email and a password they know must not end up owning the victim's verified account. Two rules, both in `EMAIL_VERIFICATION_HOOKS` (`hooks.before`, `src/lib/server/email-verification.ts`):
    - **Re-claim:** a sign-up for an email whose account is still unverified deletes that account and creates a new one with the new password and a new code, so squatting an address does not block its owner. An unverified account that has a session row, or owns passwords, media or albums, is left alone (only pre-verification-era accounts can). A sign-up the core would refuse (password length, missing name) deletes nothing. Verified accounts are never touched.
    - **Password proof:** `email-otp/verify-email` also needs the account's password in the body (checked before the code, so a wrong password costs no attempt). A mailbox alone cannot verify, and sign in to, an account whose password someone else chose. Unknown email, missing or wrong password all answer like a wrong code (`INVALID_OTP`) after one hash, so neither the answer nor its timing shows whether an account exists. The `/verify-email` form takes the password from memory (sign-up and sign-in hold it in a module variable, never in storage or the URL) and asks for it after a reload.
    - Residual: an attacker can keep re-claiming to stop a victim from ever verifying (a nuisance, not a takeover), bounded by the rate limit below. The code is mailed to the victim each time.
  - Existing users were marked verified by the migration.
- **Rate limits:**
  - Better Auth's built-in limiter, `storage: 'database'` (the `rateLimit` table, shared by every instance).
  - Rules:
    - 3 requests per 60 s per IP for `email-otp/send-verification-otp` and `email-otp/verify-email`
    - 3 per 10 s for `/sign-in*` and `/sign-up*`
    - 100 per 10 s elsewhere
    - `/get-session` and `/jwks` exempt
  - A wrong code costs an attempt in the database (5 tries, then the code is deleted; the 6th try answers 403 `TOO_MANY_ATTEMPTS`). This cap holds across instances.
  - **Caveat:** the limit is per IP and path, not per user or email. A NAT shares one bucket; many IPs (IPv6 /64) get many buckets.
  - The client IP is `getClientAddress()`, passed in `x-utilities-client-ip` by `/api/auth`. Behind a proxy, set adapter-node's `ADDRESS_HEADER` / `XFF_DEPTH`. Without an address Better Auth uses one shared bucket per path in production and 127.0.0.1 in dev.

**Step-up building block (`EmailOtp`):**

- A step-up check for a signed-in user: a 6-digit code to the session user's email, valid 10 minutes, 5 wrong tries (the next attempt locks the code), stored hashed.
- **The 60-second resend gap holds only while a code exists.** A second send within 60 seconds is refused with `TOO_SOON`, but a lockout, a successful verify or an expiry ends the code, so the next send is immediate.
- **The 5-try cap holds for one server instance only.** `verify` calls for the same email run one at a time inside the process, so parallel guesses cannot all read the same counter. Across several instances the cap does not hold: each instance counts its own tries. A consumer that runs on more than one instance needs a shared rate limit or a database-side counter before it ships. This is a prerequisite for the consumer, not something this building block provides.
- **Hard prerequisite for the consumer: its send and verify routes must apply a per-user rate limit, shared across instances.** `EmailOtp`'s own resend gap and attempt cap are per code and per process, so a lockout or a new send starts a fresh counter. This building block does not provide that limit; the consumer must add it.
- Mail: `EmailOtp` mails its own codes through the `Mailer`, and deletes the row it created if the mail fails. The plugin callback only serves sign-up.
- Server-only: the consumer owns the routes and UI. No step-up consumer ships yet; the first is the passkey Join in [docs/password-management-plan.md](docs/password-management-plan.md).
- The plugin's other HTTP endpoints answer 404, as listed under sign-up verification above, because they would let a mailbox alone sign in or reset a password. They still appear in `/api/auth/reference`.
- Switching provider: change the one line in `src/lib/server/mail/index.ts`. SMTP already covers Resend, SES and Postmark.
- One code per email and type: `EmailOtp` uses the plugin type `sign-in` (`OTP_TYPE`), which no open route serves (the open send route only takes `email-verification`, and `/sign-in/email-otp` answers 404), so sign-up traffic can neither overwrite nor burn a step-up code. A second step-up consumer still needs a type of its own (or a purpose in the identifier): the plugin has only `sign-in`, `forget-password`, `email-verification` and `change-email`, and a code requested for one flow would satisfy the other.

## Scripts

| Command            | What it does                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`         | Vite dev server with hot reload                                                                                                                         |
| `pnpm build`       | Production build into `.svelte-kit/output`                                                                                                              |
| `pnpm preview`     | Serve the production build from Node on port 4173 (`vite preview`)                                                                                      |
| `pnpm check`       | Type-check (svelte-check)                                                                                                                               |
| `pnpm lint`        | Prettier check + ESLint                                                                                                                                 |
| `pnpm format`      | Prettier write                                                                                                                                          |
| `pnpm gen:icons`   | Regenerate PWA icons from `static/icon.svg`                                                                                                             |
| `pnpm db:generate` | Regenerate the Prisma client after editing the schema                                                                                                   |
| `pnpm db:migrate`  | `prisma migrate dev` on `DATABASE_URL`: apply migrations, or create one after editing the schema                                                        |
| `pnpm db:studio`   | Browse the database at `DATABASE_URL` in Prisma Studio                                                                                                  |
| `pnpm test`        | Vitest unit + component tests (jsdom), run once                                                                                                         |
| `pnpm test:cov`    | Same tests with a v8 coverage table in the terminal and an HTML report in `coverage/`; fails if statements, branches, functions or lines fall below 90% |

### Git hooks

`pnpm install` installs a [Lefthook](https://lefthook.dev) pre-commit hook (`lefthook.yml`) that runs `pnpm check`, `pnpm lint` and `pnpm test:cov` in parallel. It lints the whole repo, including untracked and unstaged files, but a partially staged file is checked as staged.

- Re-install the hook with `pnpm exec lefthook install`.
- Skip it once with `LEFTHOOK=0 git commit …` or `git commit --no-verify`. CI runs the same checks, so skipping only defers the failure.
- Git worktrees share one `.git/hooks`. A checkout without `node_modules` prints "Can't find lefthook in PATH" and commits unchecked: run `pnpm install` there.

## Database changes

Edit `prisma/schema.prisma` (or regenerate Better Auth's models with `pnpm dlx auth@latest generate --output prisma/schema.prisma` after adding plugins), then:

```sh
pnpm db:migrate --name <change>   # writes prisma/migrations/<timestamp>_<change>/ and applies it locally
pnpm db:generate                  # regenerate the client; Prisma 7's migrate dev no longer does this
```

The app and the Prisma CLI both read `DATABASE_URL` from `.env` (the app via `src/env.ts`, the CLI via `prisma.config.ts`, which loads `.env` with dotenv), so pointing at another database is a one-line change. Environment variables are defined in `src/env.ts`; a CLI or script outside SvelteKit reads `process.env` after `import 'dotenv/config'`.

## Auth

| Token         | Cookie                      | Lifetime | Verified by                                                                   |
| ------------- | --------------------------- | -------- | ----------------------------------------------------------------------------- |
| Access token  | `better-auth.session_data`  | 5 min    | Signature, with the public keys at `/api/auth/jwks` (no DB, no shared secret) |
| Refresh token | `better-auth.session_token` | 7 days   | The `session` table (revocable); `get-session` issues a new access token      |

Production builds prefix both cookies with `__Secure-`. Web clients only ever use these httpOnly cookies, so frontend code never touches a token.

### When a mobile app or external API client arrives

These clients can't use the browser cookies, so they send tokens in the `Authorization` header:

1. **Auth server:** add `bearer()` (lets clients send the session token as `Authorization: Bearer`) next to `jwt()`, which already serves `GET /api/auth/token` (short-lived access JWT, 15 min by default). For Expo/React Native also add `@better-auth/expo` and the app scheme to `trustedOrigins`.
2. **Client:** keep the session token (refresh token) in secure storage (Keychain/Keystore, Expo SecureStore), keep the access JWT in memory, fetch a new one from `/api/auth/token` when it expires or an API call returns 401, and send the user back to sign-in if `/token` itself returns 401.
3. **API:** accept `Authorization: Bearer <jwt>` in `session.ts` before the cookie path, verified with `jose` (add it as a direct dependency): `jwtVerify(token, createRemoteJWKSet(new URL('/api/auth/jwks', AUTH_URL)), { issuer, audience })`. Other services do the same with their language's JWT library and the JWKS URL.
4. **If a browser app on another domain uses Bearer:** allow the `Authorization` header in CORS.

## Deploy

Hosting isn't chosen yet. The app uses `@sveltejs/adapter-node` (set in `vite.config.ts`) and ships as a Docker image (`docker build -t utilities .`, then `docker run --env-file .env -p 3000:3000 utilities`; in that `.env`, replace `localhost` in `DATABASE_URL`, `S3_ENDPOINT` and `SMTP_URL` with addresses the container can reach, e.g. `host.docker.internal`). Point `DATABASE_URL` at a hosted Postgres.

CI (`.github/workflows/ci.yml`) runs on every pull request to `master`: install → lint (`pnpm check`, `pnpm lint`) → unit tests with the 90% coverage gate (`pnpm test:cov`) → Docker build → Trivy scan (fails on fixable HIGH/CRITICAL).

### Production checklist

- **Secrets & URLs:** set a strong `BETTER_AUTH_SECRET` (`openssl rand -base64 32`; never the local-dev value from `.env.example`) in the host's secret store, and set `baseURL` in `auth.ts` (or a `BETTER_AUTH_URL` env var) to the public origin so callbacks and the JWT issuer don't depend on the request's `Host` header.
- **Database:** a hosted Postgres, with `DATABASE_URL` in the host's secret store (and `?sslmode=require` if the provider needs TLS). Apply migrations with `prisma migrate deploy` as a CI step before each release; `prisma.config.ts` picks up `DATABASE_URL` from the environment.
- **Mail:** set `SMTP_URL` (smtps:// with the provider's credentials) and `MAIL_FROM` (a domain with SPF/DKIM) in the host's secret store.
- **HTTPS only:** required for `__Secure-` cookies, and a leaked token is usable immediately.
- **Key rotation:** set `jwt({ jwks: { rotationInterval, gracePeriod } })`. `src/lib/server/session.ts` caches the JWKS until restart, so make it refetch when it sees an unknown `kid` (or use `jose`'s `createRemoteJWKSet`, which does this) before turning rotation on.
- **Revocation lag:** a revoked session's access token stays valid until it expires (5 min). Shorten `session.cookieCache.maxAge` if that matters.
- **Rate limiting:** the client IP is SvelteKit's `getClientAddress()`, which `/api/auth` passes in `x-utilities-client-ip`. Behind a proxy, set adapter-node's `ADDRESS_HEADER` / `XFF_DEPTH` so that address is the real client. `ipAddressHeaders` is already set to our own header; don't add `x-forwarded-for`, because it is client-controlled without `trustedProxies`.
- **API docs:** `openAPI()` publishes every auth endpoint at `/api/auth/reference`; enable it only outside production if that matters.
- **Splitting auth into its own service:** route `/api/auth/*` to it with a reverse proxy (cookies keep working), and point the two URLs in `session.ts` (`/api/auth/jwks`, `/api/auth/get-session`) at it.

## AI agents

The official [shadcn-svelte agent skill](https://shadcn-svelte.com/docs/skills) is vendored in `.agents/skills/shadcn-svelte` (symlinked into `.claude/skills/` for Claude Code) and pinned in `skills-lock.json`. Update it with:

```sh
pnpm dlx skills update
```

Project rules for agents live in [AGENTS.md](AGENTS.md).
