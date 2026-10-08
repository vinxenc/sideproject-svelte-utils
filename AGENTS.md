# Agent notes

See [README.md](README.md) for stack, layout and scripts.

- Imports use `#lib/...`, never `$lib/...` (SvelteKit 3 subpath imports). The shadcn-svelte skill's examples show `$lib`; translate them, e.g. `#lib/components/ui/button/index.js`.
- Add UI with `pnpm dlx shadcn-svelte@latest add <name> --yes`; check https://shadcn-svelte.com/blocks before building a page by hand.
- Don't edit `src/lib/components/ui/*` by hand; re-add with `--overwrite` instead.
- Service worker lives in `src/service-worker/` with its own tsconfig; it must not import app code.
- Local `.env`: follow "Local .env" in README.md (reuse `BETTER_AUTH_SECRET` from another checkout's `.env`; never commit `.env*` except `.env.example`, which holds no real secrets).
- Tests: Vitest, `test/unittest/**/*.test.ts` mirroring the `src/` layout (import code via `#lib/...`), `*.svelte.test.ts` when using runes. Run `pnpm test`.
- Before finishing: `pnpm check && pnpm lint && pnpm test && pnpm build`.
