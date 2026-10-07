# 04 · Upload dialog

From opening the dialog to what is stored. These cases build the data that [05-gallery.md](05-gallery.md), [06-upload-failure-and-background.md](06-upload-failure-and-background.md) and [07-lightbox.md](07-lightbox.md) use, so run them in order.

**Needs for the whole file:** SET-01 to SET-07, the QA account signed in, the browser on `Photo & video`, and the files from [01-test-data.md](01-test-data.md).

Labels the cases refer to: the round add button (accessible name `Add photos and videos`, `Uploading photos and videos` while uploading); the dialog title `Add to gallery`; buttons `Library` and `Camera` (square, in a row above the footer that swipes sideways), `Cancel` (idle) or `Hide` (uploading), `Submit` with a count such as `Submit (9)`, or `Uploading` while busy; per card `Remove <file name>` and `Retry <file name>`; the dialog's own close button `Close`.

## UPL-01 The dialog opens

**Steps:** click the round add button.

**Expected**

- A modal dialog titled `Add to gallery` with the text `Choose photos and videos from your library, check the previews, then submit.`
- Nothing in the body: no list and no "nothing selected" card. On a wide screen the empty body is about 320 px tall (room for two rows of three previews, so the dialog keeps its height as files are added and the previews scroll beyond six). Above the footer, a row of square `Library` and `Camera` buttons that scrolls sideways when more sources are added. In a phone-sized viewport (below 640 px) the dialog fills the whole screen: the previews take the space between the header and the footer, and the buttons row and the footer sit at the bottom, the footer last, with `Cancel` and `Submit` side by side on one row, each half the width.
- Footer: `Cancel` and a **disabled** `Submit`.
- The page behind is dimmed; the dialog is about 512 px wide on a desktop window.

## UPL-02 Choosing files shows previews and rejects the wrong ones

**Steps**

1. Give the dialog's file input the standard set plus `notes.txt` and then `huge.jpg` (in that order) in one go (see "Giving the dialog files").
2. Watch the cards appear and wait until none says `Preparing preview`.
3. Take one screenshot of the dialog.

**Expected**

- Nine cards in a grid of three columns (two on a phone), in the order the files were given. Each card is a rounded tile whose **preview fills the whole card** (the thumbnail or the first video frame), with the file name and the size label laid over the bottom edge, and a round `Remove <name>` button in the top-right corner.
- A card of a file that cannot be decoded (`broken.heic`, `five-bytes.jpg`, `junk-1536.jpg`) shows an image icon instead of a preview. A video card with no preview would show a video icon.
- Video cards show a badge with a play icon and the duration (for example `0:02`, never `Infinity` or `NaN`) in the top-left corner.
- Size labels: `tiny.gif` `43 B`, `five-bytes.jpg` `5 B`, `junk-1536.jpg` `1.5 KB`, `broken.heic` `2.0 KB`; the others show a plausible size in B, KB or MB.
- The two rejected files get **no** card. One toast says `notes.txt: Unsupported file type` with the description `and 1 more skipped` (it names the first rejected file and counts the rest; `huge.jpg` is rejected with `Photos can be up to 50 MB`).
- `Submit (9)` is enabled and `Cancel` is still the left button.
- The file input's value is empty again (so choosing the same file again fires).

## UPL-03 Submitting uploads everything

**Needs:** UPL-02's state (nine cards). Arm the toast observer, the in-flight counter and the request recorder first (see Techniques).

**Steps:** click `Submit (9)` and watch until the dialog closes.

**Expected while uploading**

- The submit button changes to a spinner with `Uploading` and is disabled; `Library` and `Camera` are disabled; the left footer button reads `Hide`.
- The round add button shows a spinner and its accessible name is `Uploading photos and videos`.
- Each card moves through `Waiting`, `Preparing`, `Uploading N%` (with a progress bar) and `Finishing` to `Added · <size>` with a check mark over the preview. The remove buttons disappear while a card is in flight and do not come back on a finished card.
- **At most 3 originals are uploading at the same moment** (the in-flight count never exceeds 3).
- Every thumbnail upload is a `PUT` with `Content-Type: image/jpeg`. The `POST /api/media` bodies carry `thumb` set to the thumbnail's size in bytes for the six files with previews and no `thumb` for the three that cannot be decoded; none carries a `thumbType` field. Every `PUT` sends exactly the number of bytes declared for it (the file's size, the thumbnail's size).

**Expected at the end**

- The dialog closes by itself. A toast `Added 9 items to the gallery` appears. The round button shows the plus again.
- The grid now has nine tiles, newest first: the eight files without an EXIF date (dated "now") in some order, then `exif-photo.jpg` last (March 2021). Tiles with a preview show the image; the three undecodable files show an icon on a grey tile; video tiles carry the duration badge.
- No error toast appeared.

## UPL-04 What is stored

**Needs:** UPL-03. Read the QA account's rows.

**Expected:** nine rows, all `READY`, and the list JSON items have exactly the keys `id`, `kind`, `name`, `duration`, `takenAt`, `hasThumb`.

| Name             | kind  | contentType                                                   | size | width × height   | duration    | takenAt                | hasThumb |
| ---------------- | ----- | ------------------------------------------------------------- | ---- | ---------------- | ----------- | ---------------------- | -------- |
| `exif-photo.jpg` | IMAGE | `image/jpeg`                                                  | file | 1600 × 1200      | empty       | 2021-03-14 09:26:53 \* | true     |
| `alpha.png`      | IMAGE | `image/png`                                                   | file | 800 × 600        | empty       | about now              | true     |
| `photo.webp`     | IMAGE | `image/webp`                                                  | file | 1200 × 800       | empty       | about now              | true     |
| `tiny.gif`       | IMAGE | `image/gif`                                                   | 43   | 1 × 1            | empty       | about now              | true     |
| video A, B       | VIDEO | the file's type (`video/quicktime` for an empty-typed `.mov`) | file | the video's size | more than 0 | about now              | true     |
| `broken.heic`    | IMAGE | `image/heic`                                                  | 2048 | empty            | empty       | about now              | false    |
| `five-bytes.jpg` | IMAGE | `image/jpeg`                                                  | 5    | empty            | empty       | about now              | false    |
| `junk-1536.jpg`  | IMAGE | `image/jpeg`                                                  | 1536 | empty            | empty       | about now              | false    |

\* The EXIF time is read as local time of the browser; the database stores UTC, so compare after converting.

## UPL-05 Thumbnails

**Needs:** UPL-03. Look at each stored thumbnail through `GET /api/media/<id>/thumb` (an `<img>` is enough; read its natural size).

**Expected**

- Every thumbnail is a JPEG (`Content-Type: image/jpeg` on the storage response).
- The longest edge is `min(1024, original longest edge)` with the aspect ratio kept: `exif-photo.jpg` 1024 × 768, `photo.webp` 1024 × 683, `alpha.png` 800 × 600 (not enlarged), `tiny.gif` 1 × 1. Video posters keep the video's size when it is below 1024.
- The transparent corners of `alpha.png` (and the transparent pixel of `tiny.gif`) are **white** in the thumbnail, not black.
- The three undecodable items have no thumbnail: `GET .../thumb` answers 404 and their tiles show the grey placeholder icon.

## UPL-06 EXIF date and rotation

**Steps:** upload `rotated.jpg` alone through the dialog (Submit), then read its row and its tile.

**Expected**

- Stored size is **1200 × 1600**: the 1600 × 1200 picture with orientation 6 is stored as shown (width and height swapped). Its thumbnail is portrait, 768 × 1024.
- Date taken is 2019-06-01 08:00:00 in the browser's local time; the tile sorts after everything dated later, and the viewer footer (LBX-01) shows `Jun 1, 2019` in the browser's locale.
- A file without EXIF (any `newer.png`) gets its last-modified time as the date.

## UPL-07 The same file twice

**Steps:** give the dialog `rotated.jpg`, then give it the same file again.

**Expected:** two cards (there is no de-duplication), `Submit (2)`, and the input's value is empty after each selection. Remove one with its `Remove rotated.jpg` button: one card is left and the button reads `Submit (1)`.

## UPL-08 Closing the dialog while only a selection exists

**Needs:** nothing uploading.

**Steps:** do each of these separately, starting from a dialog that holds one chosen file: (a) click `Cancel`; (b) click the dialog's `Close` button; (c) press Escape. After each, open the dialog again.

**Expected:** the dialog closes every time, and when reopened it shows no cards and `Submit` is disabled (the selection was dropped). Closing while something is uploading is different, see BG-02 and BG-03.

## UPL-09 Dropping files

**Steps:** with the dialog open, dispatch `dragover` and then `drop` events carrying `dialog-drop.png` on the dialog's body (the area above the footer). Then drop `notes.txt`.

**Expected**

- Both events are cancelled (`defaultPrevented` is true) so a real browser would not open the file.
- The dropped PNG gets a card and `Submit (1)`; the dropped text file is rejected with the toast `notes.txt: Unsupported file type` and gets no card.
- While an upload is running, dropping adds nothing.

## UPL-10 Progress with big files

**Steps:** give the dialog `big-1.mp4` and `big-2.mp4` (250 MB each, see [01-test-data.md](01-test-data.md)), wait for the cards, then click Submit and sample the cards about every 25 ms until the dialog closes.

**Expected**

- Cards show `250 MB` and, because the bytes are not a real video, a video icon with no preview, and they become ready within a few seconds (the preview step must not hang).
- The texts seen include `Preparing`, `Uploading N%`, `Finishing` and `Added`. Each card's progress bar value only increases and ends at 100; many different values are seen.
- At most 3 uploads in flight, `Library` and `Camera` disabled throughout, the dialog closes by itself and the toast reads `Added 2 items to the gallery`.

## UPL-11 Size labels

**Steps:** give the dialog zero-filled files of these sizes (type `image/jpeg`, except `video/mp4` for the 250 MB one, because images over 50 MB are rejected), read the label on each card, then cancel (nothing is uploaded).

**Expected:** below 1 KB the exact bytes; from 1 KB on, the largest unit that keeps the number at 1 or more (1 KB = 1024 bytes), with one decimal below 10 and a whole number from 10 up.

| Bytes     | Label    |
| --------- | -------- |
| 1         | `1 B`    |
| 999       | `999 B`  |
| 1023      | `1023 B` |
| 1024      | `1.0 KB` |
| 1536      | `1.5 KB` |
| 10240     | `10 KB`  |
| 1048576   | `1.0 MB` |
| 5242880   | `5.0 MB` |
| 52428800  | `50 MB`  |
| 262144000 | `250 MB` |

## UPL-12 The Library button

Opens the system file picker; an agent cannot drive it. See [11-manual-and-gaps.md](11-manual-and-gaps.md).

## UPL-13 The Camera button

**Steps:** replace `navigator.mediaDevices.getUserMedia` before opening the dialog: for `video` return the stream of a canvas that keeps repainting (`canvas.captureStream()`), for `audio` the stream of an `AudioContext` oscillator (`createMediaStreamDestination()`); remember each call's constraints. Open the dialog, press `Camera`, take two photos with `Take photo`, press the `Video` button, `Start recording`, wait 2.5 s, `Stop recording`, then `Done`. Do it in a desktop-sized window and again in the phone preset (UPL-14 adds what differs there).

**Expected**

- `Camera` opens a black view over the whole dialog with the live picture, a round shutter button, `Photo` and `Video` buttons and `Done`. The first `getUserMedia` call asks for video only (`facingMode` ideal `environment`, no audio).
- Each photo is added to the list as `camera-<timestamp>.jpg` (an image/jpeg, the timestamp has milliseconds so two photos never share a name).
- While recording a red timer counts up, the shutter turns into a red square and `Photo`, `Video` and `Done` are disabled. The audio is asked for at the first `Start recording` (a call with only `audio: true`). The result is added as `camera-<timestamp>.webm` (or `.mp4`) with a play badge and a duration.
- `Done` closes the camera view and leaves the dialog and its list as they are. Escape does the same (a second Escape closes the dialog). Closing the camera ends the stream: every track's `readyState` is `ended`.
- Refusing access (make `getUserMedia` reject with `NotAllowedError`) shows the toast `Allow camera access to take photos` and no camera view; `NotFoundError` shows `No camera found`.

## UPL-14 The Camera button on a phone

**Steps:** emulate a phone (mobile preset) and run UPL-13.

**Expected:** the camera view fills the whole screen, the same as on a computer: the controls sit at the bottom, clear of the home bar. No native file picker opens.
