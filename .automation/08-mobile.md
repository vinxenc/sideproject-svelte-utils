# 08 · Phone-sized viewport

The same gallery in a 375 × 812 viewport (the built-in pane's "mobile" preset, or `resize_window`). The viewport emulation also reports a touch phone to the page. **Reset the viewport to desktop when the file is done.**

**Needs for the whole file:** [04-upload.md](04-upload.md) done, the QA account signed in. Reload the page after resizing so layout decisions made at load time are redone. Click by element reference or from the page (coordinate clicks are unreliable here, see the README).

## MOB-01 Layout

**Steps:** open `Photo & video` at 375 px wide, scroll through the grid, take a screenshot.

**Expected**

- Two columns with blocks of three: the first tile fills both columns and two rows, the next two are side by side, then the next block starts. An 8 px gap, no holes.
- The page does not scroll sideways (the document is no wider than the viewport).
- The round add button sits in the bottom-right corner, 16 px from the right and bottom edges (more where the device has a safe-area inset), 56 px across, above the tiles.
- The sidebar is not on screen; the header shows the menu toggle, a separator and the page name only (the `Settings` breadcrumb part is hidden).

## MOB-02 The menu closes after choosing a page

**Steps**

1. Click the menu toggle (accessible name `Toggle Sidebar`, top-left). A sheet with the page list slides in over the page.
2. Choose `Home`, wait for the sheet's exit animation (wake a hidden pane with a screenshot), then repeat the open-and-choose with `Photo & video`.

**Expected:** each choice switches the page (title and header text follow) **and** closes the sheet: after the animation no sheet is left and the page is usable again (pointer events are not locked). On a desktop-width window the same choice does **not** hide the sidebar, which is a permanent column there.

## MOB-03 The upload dialog

**Steps:** open the dialog, choose three small images and one video, take a screenshot, then `Cancel`.

**Expected**

- The dialog is about 343 px wide with 16 px on each side, and fits in the viewport.
- The cards are in **two** columns, each preview fills its card, names and sizes are readable over the preview.
- The footer buttons are stacked: `Submit (4)` above `Cancel`, both full width.
- Cancelling drops the selection (the dialog reopens empty).

## MOB-04 Things to repeat at this size

Run GAL-02, UPL-03 and LBX-01 to LBX-03 once with the phone viewport. Only the layout differs; the behaviour is the same. (Not verified separately at this size so far.)
