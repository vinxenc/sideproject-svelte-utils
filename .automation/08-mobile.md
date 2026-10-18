# 08 · Phone-sized viewport

The same gallery in a 375 × 812 viewport (the built-in pane's "mobile" preset, or `resize_window`). The viewport emulation also reports a touch phone to the page. **Reset the viewport to desktop when the file is done.**

**Needs for the whole file:** [04-upload.md](04-upload.md) done, the QA account signed in. Reload the page after resizing so layout decisions made at load time are redone. Click by element reference or from the page (coordinate clicks are unreliable here, see the README).

## MOB-01 Layout

**Steps:** open `Photo & video` at 375 px wide, scroll through the grid, take a screenshot.

**Expected**

- Two columns (the masonry of GAL-01 at its narrowest): an 8 px gap (it is 8 px below 576 px of grid width), each tile keeps its photo's aspect ratio, tiles go to the shorter column, columns end at nearly the same height.
- The page does not scroll sideways (the document is no wider than the viewport).
- The round add button sits in the bottom-right corner, 16 px from the right and bottom edges (more where the device has a safe-area inset), 56 px across, above the tiles.
- The sidebar is not on screen; the header shows the menu toggle, a separator and the page name `Photo & video` (there is no `Settings` crumb any more).
- Above the grid the `Albums` section is one row that scrolls sideways (see ALB-17).

## MOB-02 The menu closes after choosing a page

**Steps**

1. Click the menu toggle (accessible name `Toggle Sidebar`, top-left). A sheet with the page list slides in over the page.
2. Choose `Home`, wait for the sheet's exit animation (wake a hidden pane with a screenshot), then repeat the open-and-choose with `Photo & video` and with `Passwords`.

**Expected:** each choice switches the page (the address, title and header text follow: `/dashboard`, `/photo-video`, `/passwords`) **and** closes the sheet: after the animation no sheet is left and the page is usable again (pointer events are not locked). On a desktop-width window the same choice does **not** hide the sidebar, which is a permanent column there.

## MOB-03 The upload dialog

**Steps:** open the dialog, choose three small images and one video, take a screenshot, then `Cancel`.

**Expected**

- The dialog fits in the viewport and the previews take the space between its header and the buttons row.
- The cards are in **two** columns, each preview fills its card, names and sizes are readable over the preview.
- The dialog fills the whole screen (no side margins, no rounded corners) and its footer buttons sit side by side on one row, `Cancel` on the left and `Submit (4)` on the right, each taking half of the width (as UPL-01 says; this line used to say "stacked").
- Cancelling drops the selection (the dialog reopens empty).

## MOB-04 Things to repeat at this size

Run GAL-02, UPL-03 and LBX-01 to LBX-03 once with the phone viewport. Only the layout differs; the behaviour is the same. (Not verified separately at this size so far.)

## MOB-05 Where the other phone cases are

The files after this one hold their own phone-sized cases, because they need the data those files build: DEL-03 and DEL-13 (press and hold, the selection bar with icons only), ALB-17 (album strip, cards, albums page) and PWD-11 (the vault: swipe row, tab strip, add sheet). Run them in their files; do not skip them for lack of a case here.
