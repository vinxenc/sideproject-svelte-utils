# Password management: implementation checklist

Decisions: per-user vault · list like the mockup (icon, name, username, masked password, eye) · tabs All / App / Credit card / API key / PIN platform in a scrollable text strip (tap to switch) · search by name and username, in the browser only · icon is automatic: a rounded square with the first letter of the name on a colour picked from the name (no brand logos, no icon field) · swipe left on a row reveals trash · phase 1 stores plain text, phase 2 encrypts and gates reveal behind a passkey.

Out of scope for phase 1: edit, copy button, undo after delete, auto-hide of a revealed password, brand logos, the green status dot on the avatar in the mockup.

## Phase 1: store, list, reveal, delete

### Data

- [x] `Password` model + `password_type` enum in `prisma/schema.prisma`, back-relation `passwords` on `User`
  - Fields: `id, userId, name, username?, password, type (APP | CREDIT_CARD | API_KEY | PIN_PLATFORM), createdAt`
  - Index `(userId, createdAt desc, id desc)`
- [x] Migration `prisma/migrations/20261011140539_password/` generated and applied to the shared local Postgres
- [ ] `pnpm db:generate` (Prisma 7 does not regenerate on migrate)

### Shared code (`#lib/passwords/`)

- [ ] `types.ts`: `PASSWORD_TYPES`, labels, length caps, `PasswordItem` (no password field), `checkPasswordInput`
  - Trim `name` and `username`, never trim `password`
  - `type` must be in the enum; `username` optional
- [ ] `avatar.ts`: `avatarFor(name)` returns the first letter (upper case) and a class from a palette of literal Tailwind classes
  - Same name always gives the same colour
  - Raw colours on purpose: white letter on a saturated tile, same in light and dark
- [ ] `api.ts`: `createPassword`, `deletePassword`, `revealPassword` (same error shape as `albums/api.ts`)

### Server

- [ ] `src/lib/server/passwords.ts`
  - `listPasswords(userId)`: selects everything except `password`, newest first. No paging yet (`ponytail:` ceiling comment: personal vault, add a cursor past a few hundred rows)
  - `createPassword(userId, input)`
  - `revealPassword(userId, id)`: `findFirst({ id, userId })`, returns the string or `null`
  - `deletePassword(userId, id)`: `deleteMany({ id, userId })`, `false` when nothing matched
- [ ] `POST /api/passwords` (201), `DELETE /api/passwords/[id]` (204/404), `POST /api/passwords/[id]/reveal`
  - 401 when signed out, `NO_STORE` on every response
  - Reveal is a POST on purpose: the service worker only caches GET, and phase 2 needs a body for the passkey assertion
- [ ] `(app)/passwords/+page.server.ts`: loads the list and sets `cache-control: private, no-store`, so names never land in the service worker cache
  - The password is never part of the page data

### UI

Component match (checked against the shadcn-svelte registry and docs):

| Need                                         | Component                                                                             | Status             |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------ |
| Letter tile                                  | `avatar` (`Avatar.Fallback` only; no `Avatar.Badge`)                                  | add                |
| Tab bar                                      | `tabs` (`Tabs.List` + `Tabs.Trigger`, one `Tabs.Content` that follows the active tab) | add                |
| Type picker (4 options)                      | `toggle-group` `type="single"`                                                        | add                |
| Password input with eye                      | `input-group` (`InputGroup.Input` + `InputGroup.Button`)                              | add                |
| Add and detail panels                        | `sheet`                                                                               | installed          |
| Delete confirm in detail                     | `alert-dialog`                                                                        | installed          |
| Form layout, empty state, toasts, type badge | `field`, `empty`, `sonner`, `badge`                                                   | installed          |
| Swipe-left row                               | no registry component; native CSS snap scroller                                       | custom, native CSS |

- [ ] `pnpm dlx shadcn-svelte@latest add avatar tabs toggle-group input-group --yes`
- [ ] Icons from `@lucide/svelte`: `key-round`, `eye`, `eye-off`, `plus`, `trash` (`trash-2` has no `.svelte` file in this version)
- [ ] `src/lib/components/passwords/`
  - `password-avatar.svelte`: `Avatar.Root` + `Avatar.Fallback` with the letter and the palette class
  - `password-reveal.svelte`: dots, or the password after the eye is pressed; used by the row and the detail sheet
  - `password-row.svelte`: avatar, name, username, reveal, trash. Tap opens the detail
  - `add-password-sheet.svelte`: `Field.FieldGroup` with name, `ToggleGroup` for the type, username/email (optional), password in an `InputGroup`
  - `password-detail-sheet.svelte`: all fields, reveal, Delete button behind an `AlertDialog` (the keyboard and mouse path)
- [ ] `src/routes/(app)/passwords/+page.svelte`
  - Tab bar: `Tabs.Root` + `Tabs.List` + `Tabs.Trigger` for All + the 4 types
  - Panel: only the active tab's list is mounted (one `Tabs.Content` whose value follows the tab), filtered by the search field
  - Empty state per tab, "Add" button in the header
  - After add or delete: `invalidateAll()`
- [ ] Swipe rules (decided):
  - Row: a native horizontal snap scroller with `overscroll-behavior-x: contain`; swiping left reveals the trash tile, and the swipe never leaves the row.
  - Tabs: a natively scrollable label strip; swiping it only scrolls the labels; tapping a label or the arrow keys select a tab; the content does not swipe.
- [ ] Nav: `Passwords` entry (`KeyRoundIcon`) after Photo & video
  - Touch points: `NAV`, `sectionHref` (`/passwords`), `activeSlug`, `crumbsFor`, `test/unittest/lib/nav.test.ts` (asserts the exact slug list)

### Tests (coverage must stay at 90% or more)

- [ ] `test/unittest/lib/passwords/{types,avatar,api}.test.ts`
- [ ] `test/unittest/lib/server/passwords.test.ts`: the list never selects `password`; every query is scoped by `userId`
- [ ] `test/unittest/routes/api/passwords/...`: 401, validation 400s, 404s, no-store headers
- [ ] `test/unittest/routes/(app)/passwords/+page.server.test.ts` and `+page.test.ts`
- [ ] Component tests for the row, add sheet and detail sheet

### Finish

- [ ] README: add `passwords/` to the project layout and a short "Passwords" section
- [ ] `pnpm check && pnpm lint && pnpm test:cov && pnpm build`
- [ ] Verify in the browser pane on port 4173 (kill every listener on 4173 and 5173 first), mobile preset
  - Real finger swipes on a row and on the tab strip cannot be driven from the pane: check them with `scrollLeft` and computed styles, then try them on a phone

## Phase 2: encrypt and gate with a passkey

### Encrypt at rest

- [ ] `PASSWORD_ENCRYPTION_KEY` (32 random bytes, base64) in `src/env.ts` and `.env.example` (local-dev value only, same rule as `BETTER_AUTH_SECRET`)
- [ ] `src/lib/server/crypto.ts` with `node:crypto` AES-256-GCM, no new dependency
  - Stored value: `v1.<iv>.<ciphertext+tag>` (base64url); the `v1` prefix allows key rotation
  - Additional authenticated data = `userId:id`, so a ciphertext cannot be moved to another row or user
- [ ] `createPassword` encrypts, `revealPassword` decrypts; nothing else changes because the list never reads the column
- [ ] Backfill: one script that encrypts the existing plain-text rows (idempotent: skips values that already start with `v1.`)

### Passkey gate

- [ ] Better Auth passkey plugin (WebAuthn: Face ID, Touch ID, Windows Hello). Check the package name and version for better-auth 1.7 at implementation time
- [ ] Settings entry to register a passkey; `passkey` table via the auth generator and a migration
- [ ] `POST .../reveal` requires a fresh assertion with `userVerification: "required"` before it returns the password
- [ ] UI: eye triggers the passkey prompt, then shows the password

### Risks to keep in mind

- The key lives in the same environment as the database. This protects against a DB dump or backup leak, not a compromised server. A KMS or a passkey-derived key (WebAuthn PRF, zero-knowledge) is the stronger step, with a recovery story needed
- Passkeys need a secure origin and a stable `rpID`; `localhost` works for development, hosting is not chosen yet
- A user with no passkey registered must be told to register one, not locked out

## Open questions (phase 2)

1. Passkey on every reveal, or one unlock that lasts a few minutes?
2. "Passkey" = device biometric/WebAuthn (assumed), or a PIN typed by the user?
3. Without a registered passkey: block reveal and prompt to register (assumed), or fall back to the account password?
