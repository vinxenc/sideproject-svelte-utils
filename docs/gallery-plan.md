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

- [x] Add to `prisma/schema.prisma`: `MediaKind`, `MediaStatus`, `Media`, `Album`, `AlbumMedia`, and the relations on `User`
- [x] `pnpm db:migrate --name media`, then `pnpm db:generate`
- [x] Add the shared allowlist and size limits in `src/lib/media/types.ts`:
  - [x] Images: JPEG, PNG, WebP, GIF, HEIC/HEIF, AVIF, up to 50 MB
  - [x] Videos: MP4, WebM, MOV, up to 1 GB
  - [x] Fall back to the file extension when the browser reports an empty type

### Phase 3: Upload path

- [x] `POST /api/media`: requires a session, checks type and size against the allowlist, creates a `PENDING` row, returns presigned PUT URLs for the original and the thumbnail
- [x] `POST /api/media/[id]/complete`: requires ownership, `HEAD` confirms the size matches, sets `READY` and `hasThumb`
- [x] `src/lib/media/prepare.ts`:
  - [x] Image thumbnail: `createImageBitmap` with EXIF orientation, 1024 px JPEG (the mosaic shows some tiles at 2x2, which needs the extra pixels to stay sharp; JPEG because every browser can encode it, where Safari can't do WebP)
  - [x] Video poster: seek to 1 s and draw the frame; read duration and dimensions
  - [x] Date taken via `exifr`, falling back to the file's `lastModified`
  - [x] Formats the browser can't decode (e.g. HEIC on Chrome) upload without a thumbnail
- [x] `src/lib/media/upload.ts`: uploads with `XMLHttpRequest` for progress, up to 3 at once, with a per-file error state
- [x] `upload-dialog.svelte` (replaces the inline dropzone): a round button at the bottom right opens a dialog; its Library button opens the device's photo library; picked photos and videos get a preview as a shadcn `Attachment` card (the thumbnail or poster fills the whole card with the name and status over it, and an icon stands in for formats the browser can't decode) and Submit uploads them, one progress card per file
  - [x] Also takes files dropped on the dialog (a bare drop would make the browser open the file and leave the page), rejects disallowed types with a toast, and lets the uploads carry on in the background if the dialog is hidden

### Phase 4: Viewing

- [x] `GET /api/media?cursor=`: 60 items per page, newest `takenAt` first; deletes `PENDING` rows older than 24 h
- [x] `GET /api/media/[id]/[original|thumb]`: checks ownership, then redirects (302) to a presigned GET URL
- [x] `gallery.svelte`, rendered in the dashboard when `active === 'Photo & video'` (page state only, not the URL):
  - [x] Fetches on the client when the tab opens
  - [x] One block of 4 skeleton tiles while a page loads
  - [x] When there is nothing to show (no photos yet, or the first page failed to load), the same block as 4 plain gray tiles instead of a message panel; a failed load also raises a toast with Try again (it stays until used or dismissed, and loading pauses until then)
- [x] `media-grid.svelte`:
  - [x] Mosaic tiles with `loading="lazy"`: on 4 columns every block of 4 is a 2x2, two 1x1 and a 2x1; on 2 columns every block of 3 is a 2x2 and two 1x1
  - [x] A skeleton with a loading overlay on every image until it has loaded (`media-image.svelte`, also used by the lightbox)
  - [x] Video badge with duration; placeholder icon for items without a thumbnail
  - [x] Infinite scroll via `IntersectionObserver`
- [x] `media-lightbox.svelte`:
  - [x] Full-screen dialog; arrow keys and swipe for previous/next; Esc closes
  - [x] Images show the original; videos use `<video controls preload="metadata" poster>`

### Follow-ups requested after Phase 4

- [x] Upload from a round button at the bottom right (see `upload-dialog.svelte` in Phase 3)
- [x] Upload previews use the shadcn `Attachment` component, with the preview filling the whole card
- [x] Uploads carry on if the dialog is hidden or the tab is left, and the outcome is announced in a toast when the last one ends
- [x] Load the next page automatically while scrolling (the sentinel from Phase 4; re-checked in the mosaic on desktop and phone widths: 60, 120, then all 159 items, then no more requests)
- [x] On a phone, choosing a page in the menu closes the menu (`dashboard-nav.svelte`)
- [x] Simplification pass after a review for needless complexity:
  - [x] Upload state lives in `src/lib/media/uploads.svelte.ts` instead of the dialog, so there is one path for announcing the outcome whether or not the tab was left (leaving drops a mere selection, never an upload in flight)
  - [x] Dropped: the drop ring and its `dragleave` bookkeeping, the dialog's empty card, the `?album=` filter (until Phase 6), four unused fields on the item JSON, the `settle()` guard in `media-image.svelte`, and the WebP/JPEG negotiation (thumbnails are always JPEG)
  - [x] `/api/media/[id]/[variant]` is one route instead of two

### Phase 5: Delete

- [ ] `DELETE /api/media/[id]`: checks ownership, deletes both objects and the row
- [ ] Select mode in the grid with checkboxes; bulk delete behind an `alert-dialog` confirmation
- [ ] Delete button in the lightbox; the viewer must close when the item it shows is deleted, which `media-lightbox.svelte` no longer does by itself (the `$effect` that did it was removed while nothing could delete an item)

### Phase 6: Albums

- [ ] `/api/albums`: list (with counts and cover), create, rename, delete
- [ ] `POST/DELETE /api/albums/[id]/items`: add and remove items; checks the user owns both the album and the items
- [ ] Album picker in the toolbar ("All" plus each album) that filters the grid: add an `album` filter to `GET /api/media`
- [ ] `album-dialog.svelte`: create, rename and delete
- [ ] "Add to album" for selected items; "Remove from album" when viewing an album
- [ ] Album cover: first item when `coverId` isn't set

### Phase 7: shadcn components

- [ ] `pnpm dlx shadcn-svelte@latest add dropdown-menu alert-dialog progress select checkbox sonner empty badge --yes`:
  - [x] `progress`, `sonner`, `empty` and `badge`, added with Phases 3 and 4, which use them
  - [ ] `dropdown-menu`, `alert-dialog`, `select` and `checkbox`
- [x] Check the shadcn-svelte blocks page for a gallery or file-upload block before building those by hand: it only has sidebar, login, signup, OTP, calendar and dashboard blocks, so the upload and gallery UI is composed from the primitives

### Phase 8: Service worker and docs

- [x] `src/service-worker/` always uses the network for `/api/media/*`, `/api/albums/*` and the S3 origin, and never caches them
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
