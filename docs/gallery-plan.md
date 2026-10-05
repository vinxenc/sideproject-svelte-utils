# Gallery for "Photo & video": implementation checklist

Decisions: per-user uploads · S3-compatible storage (RustFS locally) via `aws4fetch` · gallery rendered inside the dashboard, tab kept in page state only · thumbnails/posters generated in the browser · albums · limits 50 MB per image, 1 GB per video.

### Phase 1: Storage (RustFS)

- [x] Add a `rustfs` service to `docker-compose.yml`:
  - [x] Pinned image tag, ports 9000 (API) and 9001 (console)
  - [x] Data volume
  - [x] Healthcheck
  - [x] Init container that fixes volume permissions for UID 10001
- [x] Add a one-time `aws-cli` container that creates the `media` bucket and sets CORS (PUT/GET/HEAD from `localhost:5173` and `:4173`)
- [x] Add `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` to `src/env.ts` and `.env.example`
- [x] `pnpm add aws4fetch`
- [x] Write `src/lib/server/storage.ts` with `presignPut`, `presignGet`, `head` and `remove`
- [x] **Go/no-go check:** a presigned PUT from the browser works through CORS, and a presigned GET returns the file. If either fails, switch to the fallback where uploads go through a SvelteKit endpoint.

### Phase 2: Data model

- [ ] Add to `prisma/schema.prisma`: `MediaKind`, `MediaStatus`, `Media`, `Album`, `AlbumMedia`, and the relations on `User`
- [ ] `pnpm db:migrate --name media`, then `pnpm db:generate`
- [ ] Add the shared allowlist and size limits in `src/lib/media/types.ts`:
  - [ ] Images: JPEG, PNG, WebP, GIF, HEIC/HEIF, AVIF, up to 50 MB
  - [ ] Videos: MP4, WebM, MOV, up to 1 GB
  - [ ] Fall back to the file extension when the browser reports an empty type

### Phase 3: Upload path

- [ ] `POST /api/media`: requires a session, checks type and size against the allowlist, creates a `PENDING` row, returns presigned PUT URLs for the original and the thumbnail
- [ ] `POST /api/media/[id]/complete`: requires ownership, `HEAD` confirms the size matches, sets `READY` and `hasThumb`
- [ ] `src/lib/media/prepare.ts`:
  - [ ] Image thumbnail: `createImageBitmap` with EXIF orientation, 512 px WebP
  - [ ] Video poster: seek to 1 s and draw the frame; read duration and dimensions
  - [ ] Date taken via `exifr`, falling back to the file's `lastModified`
  - [ ] Formats the browser can't decode (e.g. HEIC on Chrome) upload without a thumbnail
- [ ] `src/lib/media/upload.ts`: uploads with `XMLHttpRequest` for progress, up to 3 at once, with a per-file error state
- [ ] `upload-dropzone.svelte`: drag-and-drop and file picker, one progress row per file, rejects disallowed types with a toast

### Phase 4: Viewing

- [ ] `GET /api/media?album=&cursor=`: 60 items per page, newest `takenAt` first; deletes `PENDING` rows older than 24 h
- [ ] `GET /api/media/[id]/[original|thumb]`: checks ownership, then redirects (302) to a presigned GET URL
- [ ] `gallery.svelte`, rendered in the dashboard when `active === 'Photo & video'` (page state only, not the URL):
  - [ ] Fetches on the client when the tab opens
  - [ ] Skeleton tiles while loading
  - [ ] Empty state when there's nothing yet
- [ ] `media-grid.svelte`:
  - [ ] Square tiles with `loading="lazy"`
  - [ ] Video badge with duration; placeholder icon for items without a thumbnail
  - [ ] Infinite scroll via `IntersectionObserver`
- [ ] `media-lightbox.svelte`:
  - [ ] Full-screen dialog; arrow keys and swipe for previous/next; Esc closes
  - [ ] Images show the original; videos use `<video controls preload="metadata" poster>`

### Phase 5: Delete

- [ ] `DELETE /api/media/[id]`: checks ownership, deletes both objects and the row
- [ ] Select mode in the grid with checkboxes; bulk delete behind an `alert-dialog` confirmation
- [ ] Delete button in the lightbox

### Phase 6: Albums

- [ ] `/api/albums`: list (with counts and cover), create, rename, delete
- [ ] `POST/DELETE /api/albums/[id]/items`: add and remove items; checks the user owns both the album and the items
- [ ] Album picker in the toolbar ("All" plus each album) that filters the grid
- [ ] `album-dialog.svelte`: create, rename and delete
- [ ] "Add to album" for selected items; "Remove from album" when viewing an album
- [ ] Album cover: first item when `coverId` isn't set

### Phase 7: shadcn components

- [ ] `pnpm dlx shadcn-svelte@latest add dropdown-menu alert-dialog progress select checkbox sonner empty badge --yes`
- [ ] Check the shadcn-svelte blocks page for a gallery or file-upload block before building those by hand

### Phase 8: Service worker and docs

- [ ] `src/service-worker/` always uses the network for `/api/media/*`, `/api/albums/*` and the S3 origin, and never caches them
- [ ] README updates:
  - [ ] Stack table: add RustFS
  - [ ] Architecture diagram and project layout
  - [ ] Getting started: start RustFS, bucket setup, S3 env vars

### Phase 9: Verification

- [ ] `pnpm check && pnpm lint && pnpm build`
- [ ] Production preview on :4173 (stop whatever holds the port; don't switch ports)
- [ ] Manual test, uploads:
  - [ ] JPEG with EXIF rotation and a date taken
  - [ ] PNG and GIF
  - [ ] HEIC on Chrome (no thumbnail) and on Safari
  - [ ] MP4 and MOV
  - [ ] A file over the size limit and a disallowed type are both rejected
- [ ] Manual test, viewing and editing:
  - [ ] Pagination past 60 items
  - [ ] Lightbox previous/next and video playback
  - [ ] Single and bulk delete
  - [ ] Album create, add, filter, remove, rename, delete
- [ ] Security: a second user can't list, view, delete or add another user's media to an album (they get 404)
- [ ] Offline: the dashboard still loads; media fails without breaking the page
- [ ] Open a PR into `master`
