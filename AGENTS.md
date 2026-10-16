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
- IDs: every generated ID is a UUID v7. Prisma models use `@default(uuid(7))`, never `uuid()`/`cuid()`; Better Auth ids come from `advanced.database.generateId` in `src/lib/server/auth.ts`; in code use `v7` from `uuid`, never `crypto.randomUUID()` (that is v4).
- Soft delete: media, album and password rows get `deletedAt` instead of being removed. Use `prisma` from `#lib/server/db.js` (its `delete`/`deleteMany` soft-delete and reads skip deleted rows); `prismaBase` sees and really deletes them, for Better Auth, hard purges and ownership checks. Nested relation filters are not covered: add `deletedAt: null` there yourself. New app tables get `deletedAt` and a name in `src/lib/server/db.ts`; Better Auth's tables stay hard-deleted. See `src/lib/server/soft-delete.ts`.
