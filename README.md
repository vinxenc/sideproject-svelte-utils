# Utilities

An installable Progressive Web App (PWA) for web, mobile and desktop, built with SvelteKit. Local development only for now; hosting is not chosen yet.

## Tech stack

| Layer     | Choice                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | [SvelteKit 3](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/docs/svelte) (runes), TypeScript                                                                                                                   |
| UI        | [shadcn-svelte](https://shadcn-svelte.com) (style `nova`, base color `neutral`), [Bits UI](https://bits-ui.com), [Lucide](https://lucide.dev) icons, [mode-watcher](https://mode-watcher.svecosystem.com) for dark/light mode |
| Styling   | [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`, Inter font                                                                                                                                                |
| PWA       | SvelteKit built-in service worker + static web manifest, icons from `@vite-pwa/assets-generator`                                                                                                                              |
| Auth / DB | [Better Auth](https://www.better-auth.com) (email + password) → [Prisma 7](https://www.prisma.io/docs) + `@prisma/adapter-pg` → PostgreSQL 18 (local: Docker, `docker-compose.yml`)                                           |
| Hosting   | Not chosen yet; local only (`pnpm dev`, `pnpm preview`)                                                                                                                                                                       |
| Tooling   | pnpm, Vite 8, ESLint, Prettier, svelte-check                                                                                                                                                                                  |

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
      dashboard/           landing page after sign-in/sign-up (sidebar-13 layout, full page)
    api/auth/[...all]/     Better Auth REST API (sign-in, sign-up, get-session, …)
    (guest)/               redirects signed-in users to /dashboard
      sign-in/  sign-up/   auth pages (shadcn blocks login-02, signup-02)
  env.ts                   env var definitions (read via $app/env/private)
  hooks.server.ts          fills locals.user via lib/server/session.ts
  lib/
    server/
      auth.ts              "auth service": Better Auth + Prisma; access token = 5-min JWT cookie signed with a key pair (jwt plugin), refresh token = session cookie
      session.ts           "app" side: verifies the access token with the public keys from /api/auth/jwks, refreshes via /api/auth/get-session
      prisma/              generated Prisma client (gitignored, `pnpm db:generate`)
    auth-client.ts         Better Auth Svelte client (authClient.signIn / useSession / …)
    components/
      ui/                  shadcn-svelte components (generated, managed by the CLI)
      site-header.svelte   dark/light toggle (top-right); logo bar only in the desktop app title bar
      login-form.svelte    sign-in form
      signup-form.svelte   sign-up form
    utils.ts               cn() + shadcn helper types
  service-worker/          offline caching (own tsconfig, WebWorker types)
prisma/schema.prisma       Better Auth models (user, session, account, verification, jwks)
prisma/migrations/         SQL migrations (prisma migrate dev)
docker-compose.yml         local Postgres 18 for development
prisma.config.ts           Prisma CLI config: DATABASE_URL from settings/env.ts
settings/env.ts            env for tools outside SvelteKit: loads .env (dotenv), validates (envalid)
static/                    manifest.webmanifest, icons, robots.txt
components.json            shadcn-svelte config
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
cp .env.example .env          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d --wait   # local Postgres on localhost:5432 (user/password/db: utilities)
pnpm db:migrate               # apply migrations
pnpm dev                      # dev server at http://localhost:5173
```

`docker compose down` stops Postgres and keeps the data; `docker compose down -v` also wipes it.

Auth endpoints live under `/api/auth/*` (e.g. `POST /api/auth/sign-up/email`). API docs: `/api/auth/reference` (Scalar UI), raw OpenAPI JSON: `/api/auth/open-api/generate-schema`, public signing keys: `/api/auth/jwks`.

The service worker only runs in production builds. To test the production build and the PWA (offline, install) locally:

```sh
pnpm build
pnpm preview        # http://localhost:4173
```

Then open it in Chrome or Edge and use the install icon in the address bar to install it as a desktop app. `localhost` counts as a secure origin, so installation works locally.

## Scripts

| Command            | What it does                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| `pnpm dev`         | Vite dev server with hot reload                                                                  |
| `pnpm build`       | Production build into `.svelte-kit/output`                                                       |
| `pnpm preview`     | Serve the production build from Node on port 4173 (`vite preview`)                               |
| `pnpm check`       | Type-check (svelte-check)                                                                        |
| `pnpm lint`        | Prettier check + ESLint                                                                          |
| `pnpm format`      | Prettier write                                                                                   |
| `pnpm gen:icons`   | Regenerate PWA icons from `static/icon.svg`                                                      |
| `pnpm db:generate` | Regenerate the Prisma client after editing the schema                                            |
| `pnpm db:migrate`  | `prisma migrate dev` on `DATABASE_URL`: apply migrations, or create one after editing the schema |
| `pnpm db:studio`   | Browse the database at `DATABASE_URL` in Prisma Studio                                           |

## Database changes

Edit `prisma/schema.prisma` (or regenerate Better Auth's models with `pnpm dlx auth@latest generate --output prisma/schema.prisma` after adding plugins), then:

```sh
pnpm db:migrate --name <change>   # writes prisma/migrations/<timestamp>_<change>/ and applies it locally
pnpm db:generate                  # regenerate the client; Prisma 7's migrate dev no longer does this
```

The app and the Prisma CLI both read `DATABASE_URL` from `.env` (the app via `src/env.ts`, the CLI via `settings/env.ts`, which validates it with [envalid](https://github.com/af/envalid)), so pointing at another database is a one-line change. New variables go in `src/env.ts` if the app reads them, and in `settings/env.ts` if a CLI or script does.

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

Not set up yet. When hosting is chosen: add its SvelteKit adapter in `vite.config.ts`, and point `DATABASE_URL` at a hosted Postgres.

### Production checklist

- **Secrets & URLs:** set a strong `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) in the host's secret store, and set `baseURL` in `auth.ts` (or a `BETTER_AUTH_URL` env var) to the public origin so callbacks and the JWT issuer don't depend on the request's `Host` header.
- **Database:** a hosted Postgres, with `DATABASE_URL` in the host's secret store (and `?sslmode=require` if the provider needs TLS). Apply migrations with `prisma migrate deploy` as a CI step before each release; `prisma.config.ts` picks up `DATABASE_URL` from the environment.
- **HTTPS only:** required for `__Secure-` cookies, and a leaked token is usable immediately.
- **Key rotation:** set `jwt({ jwks: { rotationInterval, gracePeriod } })`. `src/lib/server/session.ts` caches the JWKS until restart, so make it refetch when it sees an unknown `kid` (or use `jose`'s `createRemoteJWKSet`, which does this) before turning rotation on.
- **Revocation lag:** a revoked session's access token stays valid until it expires (5 min). Shorten `session.cookieCache.maxAge` if that matters.
- **Rate limiting:** Better Auth's limiter needs the real client IP behind a proxy: set `advanced.ipAddress.ipAddressHeaders` (e.g. `x-forwarded-for`) or `trustedProxies`.
- **API docs:** `openAPI()` publishes every auth endpoint at `/api/auth/reference`; enable it only outside production if that matters.
- **Splitting auth into its own service:** route `/api/auth/*` to it with a reverse proxy (cookies keep working), and point the two URLs in `session.ts` (`/api/auth/jwks`, `/api/auth/get-session`) at it.

## AI agents

The official [shadcn-svelte agent skill](https://shadcn-svelte.com/docs/skills) is vendored in `.agents/skills/shadcn-svelte` (symlinked into `.claude/skills/` for Claude Code) and pinned in `skills-lock.json`. Update it with:

```sh
pnpm dlx skills update
```

Project rules for agents live in [AGENTS.md](AGENTS.md).
