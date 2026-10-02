# Utilities

An installable Progressive Web App (PWA) for web, mobile and desktop, built with SvelteKit and deployed to Cloudflare Workers.

## Tech stack

| Layer     | Choice                                                                                                                                                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | [SvelteKit 3](https://svelte.dev/docs/kit) + [Svelte 5](https://svelte.dev/docs/svelte) (runes), TypeScript                                                                                                                   |
| UI        | [shadcn-svelte](https://shadcn-svelte.com) (style `nova`, base color `neutral`), [Bits UI](https://bits-ui.com), [Lucide](https://lucide.dev) icons, [mode-watcher](https://mode-watcher.svecosystem.com) for dark/light mode |
| Styling   | [Tailwind CSS v4](https://tailwindcss.com) via `@tailwindcss/vite`, Inter font                                                                                                                                                |
| PWA       | SvelteKit built-in service worker + static web manifest, icons from `@vite-pwa/assets-generator`                                                                                                                              |
| Hosting   | [Cloudflare Workers](https://developers.cloudflare.com/workers/) (static assets) via `@sveltejs/adapter-cloudflare` and `wrangler`                                                                                            |
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
Cloudflare Worker (.svelte-kit/cloudflare/_worker.js)
  ├── static assets  → served directly by the ASSETS binding
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
    +page.ts               "/" redirects to /sign-in
    sign-in/  sign-up/     auth pages (shadcn blocks login-02, signup-02)
  lib/
    components/
      ui/                  shadcn-svelte components (generated, managed by the CLI)
      site-header.svelte   app header: logo + dark/light toggle (right)
      login-form.svelte    sign-in form
      signup-form.svelte   sign-up form
    utils.ts               cn() + shadcn helper types
  service-worker/          offline caching (own tsconfig, WebWorker types)
static/                    manifest.webmanifest, icons, robots.txt
components.json            shadcn-svelte config
wrangler.jsonc             Cloudflare Worker config
vite.config.ts             SvelteKit + Tailwind + Cloudflare adapter
```

### Conventions

- **Imports use `#lib`**, not `$lib`. SvelteKit 3 uses Node subpath imports (see `imports` in `package.json`), e.g. `import { Button } from '#lib/components/ui/button/index.js'`.
- **UI components** come from the shadcn-svelte CLI. Don't hand-write what the registry already provides:
  ```sh
  pnpm dlx shadcn-svelte@latest add dialog
  ```
- **Use theme tokens** (`bg-background`, `text-muted-foreground`, …) instead of raw Tailwind colours, so dark mode keeps working.

## Getting started

Requirements: Node 22+ and pnpm 9+.

```sh
pnpm install
pnpm dev            # dev server at http://localhost:5173
```

The service worker only runs in production builds. To test the PWA (offline, install) on the real Cloudflare runtime:

```sh
pnpm build
pnpm preview        # http://localhost:4173
```

Then open it in Chrome or Edge and use the install icon in the address bar to install it as a desktop app. `localhost` counts as a secure origin, so installation works locally.

## Scripts

| Command          | What it does                                            |
| ---------------- | ------------------------------------------------------- |
| `pnpm dev`       | Vite dev server with hot reload                         |
| `pnpm build`     | Production build into `.svelte-kit/cloudflare`          |
| `pnpm preview`   | Run the production build locally with `wrangler dev`    |
| `pnpm check`     | Regenerate Cloudflare types + type-check (svelte-check) |
| `pnpm lint`      | Prettier check + ESLint                                 |
| `pnpm format`    | Prettier write                                          |
| `pnpm gen:icons` | Regenerate PWA icons from `static/icon.svg`             |

## Deploy

```sh
pnpm wrangler login     # once
pnpm build
pnpm wrangler deploy    # → https://utilities.<your-subdomain>.workers.dev
```

Run `pnpm check` after editing `wrangler.jsonc` so the generated `worker-configuration.d.ts` types stay in sync.

## AI agents

The official [shadcn-svelte agent skill](https://shadcn-svelte.com/docs/skills) is vendored in `.agents/skills/shadcn-svelte` (symlinked into `.claude/skills/` for Claude Code) and pinned in `skills-lock.json`. Update it with:

```sh
pnpm dlx skills update
```

Project rules for agents live in [AGENTS.md](AGENTS.md).
