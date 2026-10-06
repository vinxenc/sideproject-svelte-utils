# 09 · Old data, service worker, error audit

Things that should keep working although the code around them changed, plus a final look at the browser's error output.

**Needs for the whole file:** the QA account signed in and the browser on `Photo & video`. Run RES-03 last, after everything else in the run.

## RES-01 Thumbnails stored as WebP still display

Before thumbnails were always JPEG, the app stored WebP thumbnails. Those objects still exist for old uploads and must keep working.

**Steps**

1. Create a **new** item without going through the dialog: create the upload with `thumb: true`, `PUT` a small original (a PNG) and a small JPEG thumbnail with their types, and complete it (see API-02). Swap the object right after completing it, before the item has ever been shown, so no earlier copy of the thumbnail can be in the browser.
2. Replace the item's stored thumbnail object (`<userId>/<id>/thumb`) with a real 400 × 300 WebP image, stored with `Content-Type: image/webp`. Use any S3 client with the local RustFS credentials from `docker-compose.yml` or `.env` (for example the `amazon/aws-cli` image the compose file uses). Write only under the QA account's own prefix.
3. Re-enter `Photo & video` and find the tile.

**Expected:** the tile shows the WebP picture filling the tile (the image's natural size is 400 × 300), at full opacity, with no placeholder icon, and `GET /api/media/<id>/thumb` ends at a response with `Content-Type: image/webp`.

## RES-02 The service worker stays out of media requests

The production build registers a service worker that caches pages and static files. It must never touch `/api/media/...`: those answers redirect to the storage origin, which a `fetch` inside the worker cannot follow, and it would also store people's photos in a shared cache.

**Steps:** after the page has been used (list loaded, an upload done, the viewer opened on a photo and on a video), check the page's service worker status and list every entry of every Cache Storage cache.

**Expected**

- A service worker controls the page.
- There is one cache for the current build and **no entry whose path starts with `/api/`** (so none under `/api/media`).
- Despite that, thumbnails display and a video plays while the worker is in control.

## RES-03 Console and network audit

**Steps:** at the end of the run read the browser console and the list of network requests recorded since the first case (or since the last page load).

**Expected**

- No uncaught exceptions and no unhandled promise rejections.
- No server error (5xx) except the ones a case injected on purpose.
- The only errors are those the cases cause deliberately: `404` for the thumbnail of an item that has none (if a case requested one), the CORS error from fetching a thumbnail an image had already loaded, `401` after signing out, and the failures a case injected. Anything else goes into the report.
