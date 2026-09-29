# Banknote Visual Flow

Shows, for each currency and observer, the order in which each person noticed elements on the front and back of the note.

```bash
npm install
npm run dev
```

## Using the canvas

- **Left column**, top to bottom:
  - **Studies:** page navigation between Visual Flow and Touch Heatmap.
  - **View:** the layouts listed as buttons (key `G` cycles through them), then **Options** (switches).
  - **Details** for the selected note. It scrolls if it's long and can be collapsed.

  Drag the column's right edge to resize all three panels together; double-click the edge to reset. The width is remembered.
- **Zoom** controls sit in the top-right corner, with the **Edit** switch (Visual Flow) under them.
- **B&W** option (key `B`) on both pages shows the banknote artwork in black and white, so only the data (flow or touch heat) carries colour.
- **Layouts:**
  - **Single:** one note at a time.
  - **All 4:** the four notes side by side.
  - **Overlay:** the four notes stacked and faded, with every flow drawn on top. The selected observer's flow is in focus; turn on *Show all flows equally* in the details panel to see all four at full strength.
  - **Overlay heatmap** (key `H`): all four observers combined into one heatmap. Colour shows how early an area was looked at (red = seen first, blue = seen later), and stronger colour means more attention there. The path the eye travelled between points is included as a lighter trail, so the heatmap shows the route as well as the stops.
- **Flip:** each note has its own **Flip** button under its bottom centre, which moves with the note as you pan. In All 4, every note can be flipped separately; in the overlay layouts, one button flips the whole stack. Key `F` flips the selected note.
- **Bottom:** currency tabs (keys `1`–`5`) sit above the denomination dock (keys `←` `→`).
- **Moving around:** scroll to pan, ⌘/Ctrl + scroll or pinch to zoom, and drag empty space to pan. The zoom buttons in the top-right corner zoom and re-fit.
- **Links:** the URL keeps the current currency, denomination and layout, so you can share a link to a specific note.

## Gaze order colours

Markers and lines go from warm and solid for the first things noticed to cool and transparent for later ones: 1 red → 2 orange → 3 amber → 4 teal → 5 blue → 6+ indigo. A given step always has the same colour, so notes can be compared. The scale is defined in `src/lib/order.ts`.

## Data

- `src/data/flows.json`: one entry per observer and note, each with ordered `front` / `back` points. `x` and `y` are fractions (0–1) of the image size.
- `public/notes/`: images resized from `Banknote reference images` (GBP uses the Elizabeth II series).

## Edit mode

Turn on **Edit** under the zoom controls in the top-right corner. Save, Export and Discard are at the bottom of the Details panel.

- Click the note to add a point, and drag a marker to move it. Dragging elsewhere pans the canvas.
- In the list, rename, reorder or delete points.
- Use **Flip** to edit the other side.
- **Save** writes `src/data/flows.json`. This only works while `npm run dev` is running.
- **Export** downloads the JSON, and **Discard** reverts unsaved edits.
- Unsaved point edits are kept in the browser until you save or discard them.

## Touch Heatmap page

Open it from **Studies** in the left column, or go to `#/touch`. This page shows where people held the notes, measured with invisible UV ink on three participants' hands. All three are combined, and fronts and backs are kept separate.

- **Currencies:** Euro, Swiss Franc, Ruble and Pound (keys `1`–`4`).
- **Layouts** (key `G`):
  - **Single:** one note with its touch heat.
  - **All notes:** every denomination side by side.
  - **Combined:** all denominations stacked; colour shows on how many of the notes a spot was touched.
- **UV photo** toggle (key `U`): shows the actual UV photo, straightened to match the note, above each note (in Combined, a row of all the photos above the stack).
- **B&W** toggle (key `B`): shows the banknote artwork in black and white, so only the ink heat carries colour.
- **Data:** `src/data/touch.json` (one entry per page, with its extraction settings), plus masks and straightened photos in `public/touch/`.

### Re-extracting touch areas

The source photos come from the PDFs in `UV ink/`:

```bash
swift scripts/render-uv.swift "../../UV ink" uv-source
```

Then, with `npm run dev` running, open `#/touch/extract`. It's dev only, and the details panel links to it. For each page it:

1. Rotates the photo upright, choosing the rotation that best matches the reference artwork.
2. Finds the note's corners. You can drag them if they're off.
3. Detects ink by colour against that note's own base colour under UV, so a green note isn't mistaken for cyan ink. The sliders fine-tune it, and **Auto-calibrate** resets the colour ranges for the current note.

**Save page** writes the mask and photo. **Auto-process unsaved** and **Re-run all** process pages in bulk. Reload the Touch Heatmap page afterwards to see changes.

Page order note: for the 200 and 2000 ruble notes, the PDF has the back before the front. `touch.json` already maps these correctly.
# Oberthur-Fiduciaire-banknote-research
