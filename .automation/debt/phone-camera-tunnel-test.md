# Phone test of the camera and upload through HTTPS tunnels (plan B)

> **Debt.** This plan is parked, not part of the regular `.automation` run. Delete this file (and the `debt/` folder when it is empty) once the phone test below has passed on a real phone.

## Why

The camera, the swipe row and the full-screen upload dialog were only tested in the in-app browser with a faked camera and mouse input ([04-upload.md](../04-upload.md) UPL-13 and UPL-14, [11-manual-and-gaps.md](../11-manual-and-gaps.md)). A phone needs a page served over HTTPS for `getUserMedia`, and an upload needs the phone to reach the object storage, which is `http://localhost:9000` and means "the phone itself" there. So both the app and the storage must be reachable from the phone over HTTPS.

## What changes (all local, none of it committed)

| What                                    | Change                                             | Put back by                       |
| --------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `.env` (gitignored)                     | `S3_ENDPOINT` points at the storage tunnel         | restoring `http://localhost:9000` |
| Bucket `media` CORS (inside the RustFS) | also allows the app tunnel's origin                | `docker compose up rustfs-init`   |
| Two `cloudflared` processes             | one for the app (4173), one for the storage (9000) | stopping them (Ctrl+C or `kill`)  |
| A QA account and its uploads            | created for the test                               | [10-cleanup.md](../10-cleanup.md) |

Quick tunnels have random `*.trycloudflare.com` addresses that change on every start, so nothing is worth saving. Anyone who has the address can reach the app while a tunnel runs: use a throwaway QA account, keep the tunnels up only as long as needed and never leave them running.

## Setup

1. **Install the tunnel tool (once):** `brew install cloudflared`.
2. **Start the stack:** `docker compose up -d --wait`, then `pnpm db:migrate` if the database is new.
3. **Free the ports, as for every preview test:** kill every listener on 4173 and 5173.
4. **Open the storage tunnel first** (its address is needed before the app starts): `cloudflared tunnel --url http://localhost:9000`. Copy the printed `https://<storage>.trycloudflare.com`.
5. **Point the app at it:** in `.env` set `S3_ENDPOINT="https://<storage>.trycloudflare.com"`. Do not print or commit `.env`.
6. **Build and start the app:** `pnpm build`, then `pnpm preview` (port 4173).
7. **Open the app tunnel:** `cloudflared tunnel --url http://localhost:4173`. Copy the printed `https://<app>.trycloudflare.com`.
8. **Let the bucket accept the app tunnel's origin.** Run the same call that `rustfs-init` in `docker-compose.yml` makes, with `https://<app>.trycloudflare.com` added to `AllowedOrigins` next to the two `localhost` origins (a one-off `docker run --rm amazon/aws-cli s3api put-bucket-cors --bucket media ...` against the RustFS container, with the local keys from `docker-compose.yml`).
9. **Open `https://<app>.trycloudflare.com/sign-up` on the phone** and create a throwaway QA account (an `@example.test` address).

## Known risks, and what to do

- **Sign-in is refused (`Invalid origin` or a missing cookie).** Better Auth builds its base URL from the request. If it does not trust the tunnel host, set `BETTER_AUTH_URL` (or `trustedOrigins`) to the app tunnel's address for the test only, and restart the preview. If the cookie is not kept, check that the session cookie is `Secure` and the page really is on HTTPS.
- **Upload fails with 403 `SignatureDoesNotMatch`.** The presigned URL is signed for the storage tunnel's host name, and RustFS checks it against the `Host` header it receives. If `cloudflared` rewrites the header to `localhost:9000`, restart the storage tunnel with `--http-host-header <storage>.trycloudflare.com`.
- **Upload fails with a CORS error in the phone's console.** The origin added in step 8 does not match the address in the phone's address bar exactly (scheme, host, no trailing slash).
- **A video upload is slow.** The limit is 1 GB, and a tunnel adds latency. Use a short clip.
- **The tunnel address changed** because a `cloudflared` process was restarted: repeat steps 4 to 8.

## Checks on the phone

1. **Camera opens.** `Add photos and videos`, then `Camera`: the browser asks for camera access, then a full-screen live picture with the shutter, `Photo` and `Video` buttons and `Done` fills the screen. Controls are clear of the home bar (no controls under the notch or home indicator).
2. **Photo.** Take two photos, then `Done`: two cards with a thumbnail, named `camera-<timestamp>.jpg`.
3. **Video with sound.** `Video`, `Start recording`: a second prompt asks for the microphone, a red timer counts, `Stop recording`: a card with a play badge and a duration. After the upload, play it in the viewer **with sound** (the in-app test could not check sound).
4. **Lens.** The camera uses the back lens first. (A front/rear switch was removed on purpose; if it is wanted again, this is where to see that it is missing.)
5. **Closing.** Press the dialog's `Close` while the camera is open, then open the dialog again: the source buttons show, not the camera. The camera indicator (green dot, or the status bar icon) is off once the camera is closed.
6. **Dialog layout.** The dialog fills the screen. `Cancel` and `Submit` are on one row. The preview area scrolls when there are more files than fit. The `Library` and `Camera` buttons are square and above the footer.
7. **Swipe row.** With only two buttons nothing scrolls. To see the swipe, add a temporary third entry to `sources` in `upload-dialog.svelte` (a copy of `Library`, not committed) and a fourth and fifth if needed: the row drags with a finger, snaps to a button, starts 16 px from the left edge and the next button peeks in from the right. Remove the extra entries afterwards.
8. **Library.** `Library` opens the phone's own photo picker. Choosing several photos and videos adds a card for each.
9. **Submit.** `Submit` uploads everything: progress, the `Added … to the gallery` toast, and the new tiles at the top of the masonry grid. Open one photo and one video in the viewer.
10. **Gallery.** Two columns, tiles with the right proportions, smooth scrolling, swiping between items in the viewer. Rotate the phone: three columns on a wide landscape width.
11. **Permissions.** Deny the camera once (browser prompt: Block): the toast `Allow camera access to take photos` appears and the camera view closes. Allow it again in the browser's site settings for the next check.
12. **Installed app (optional).** Install the page from the browser menu (`Add to Home Screen` / `Install app`), open it from the home screen and repeat checks 1 to 3: this is where a standalone PWA on iOS differs most.

Record what failed, with the phone model and browser, in the PR conversation.

## Cleanup (do all of it)

1. Stop both `cloudflared` processes. Check that no `cloudflared` is left: `pgrep -l cloudflared` prints nothing.
2. Restore `.env`: `S3_ENDPOINT="http://localhost:9000"`, and remove `BETTER_AUTH_URL` if it was added.
3. Restore the bucket CORS: `docker compose up rustfs-init`.
4. Delete the QA account and its objects as described in [10-cleanup.md](../10-cleanup.md).
5. Kill the preview on 4173 and revert any temporary edit to `upload-dialog.svelte` (`git status` is clean).
6. If everything passed: delete this file.
