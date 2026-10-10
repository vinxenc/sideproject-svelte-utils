# Agent notes

See [README.md](README.md) for stack, layout and scripts.

- Imports use `#lib/...`, never `$lib/...` (SvelteKit 3 subpath imports). The shadcn-svelte skill's examples show `$lib`; translate them, e.g. `#lib/components/ui/button/index.js`.
- Add UI with `pnpm dlx shadcn-svelte@latest add <name> --yes`; check https://shadcn-svelte.com/blocks before building a page by hand.
- Don't edit `src/lib/components/ui/*` by hand; re-add with `--overwrite` instead.
- Service worker lives in `src/service-worker/` with its own tsconfig; it must not import app code.
- Local `.env`: follow "Local .env" in README.md (`cp .env.example .env`, which already carries the shared local-dev `BETTER_AUTH_SECRET`; never copy it from another checkout, never commit `.env*` except `.env.example`, and put no other real secret in it).
- Tests: Vitest, `test/unittest/**/*.test.ts` mirroring the `src/` layout (import code via `#lib/...`), `*.svelte.test.ts` when using runes.
- Coverage (`pnpm test:cov`) must stay ≥ 90% for statements, branches, functions and lines. Add tests for new code; don't add coverage excludes or v8-ignore comments to pass. The Lefthook pre-commit hook enforces this; don't bypass it with --no-verify.
- Before finishing: `pnpm check && pnpm lint && pnpm test:cov && pnpm build`.
