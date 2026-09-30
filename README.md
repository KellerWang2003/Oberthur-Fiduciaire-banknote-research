# Banknote Ergo Research

One canvas for two studies of how people use banknotes:
- **Eye flow:** the order in which each observer noticed elements on the front and back.
- **Touch:** where three people held the notes, measured with invisible UV ink on their hands.

```bash
npm install
npm run dev
```

## Using the canvas

**Layout** is the switch at the top centre (key `G` cycles):
- **Single:** one note.
- **All notes:** every denomination of the currency side by side, with one button to flip them all.
- **Combined:** all denominations stacked in one frame.

The docked sidebar on the left (like Figma's design panel) holds the rest, as flat sections:

1. **Eye flow** (key `E`), a main layer switch: where people looked, in order. Show it as **Markers** (numbered points and paths) or as a **Heatmap** (key `H`). The heatmap's colour shows how early an area was looked at, and it includes the path between points. In Combined with markers, **All flows equally** shows every observer at full strength instead of focusing the selected one.
2. **Touch** (key `T`), a main layer switch: where people held the note.
3. **General:** **UV photo** (key `U`) shows the straightened UV photo above each note, or a row of photos in Combined; it needs Touch on. **B&W note** (key `B`) shows the artwork in black and white, so only the data has colour.
4. **Selected note:** details for the note (viewing order, quote, touched share). It starts collapsed; click its heading to expand it.

The gradient legends (eye-flow heatmap, touch) sit right under their layer switch while the layer is on, so they're always visible. Markers don't need one: their numbers give the order.

The sidebar scrolls as one column. Drag its right edge to resize it; double-click the edge to reset. The width is remembered.

More controls:
- **Zoom** controls are in the top-right corner, with the **Edit** menu under them. It groups the data-correction tools: **Eye-flow points** (in-place editing) and, when running locally, **Touch extraction**.
- **Flip:** each note has its own button under it (key `F`). In Combined, one button flips the whole stack.
- **Bottom:** currency tabs for Euro, Swiss Franc, Russian Ruble and British Pound (keys `1`–`4`) sit above the denomination dock (keys `←` `→`). The dock lists every denomination; notes without an eye-flow recording are labelled "No eye flow", and while eye flow is on they carry a **No eye-flow data** badge on the canvas (Combined notes how many of its notes have eye flow). The US dollar eye-flow data is kept in `flows.json` but hidden, as it has no touch data.
- **Colours:** when eye flow and touch are both shown, touch heat turns violet so it reads apart from the gaze colours. With eye flow off, touch uses its yellow-to-red scale.
- **Moving around:** scroll to pan, ⌘/Ctrl + scroll or pinch to zoom, and drag empty space to pan.
- **Links:** the URL keeps the currency, denomination, layout and switches, so you can share a link to a specific view.

## Gaze order colours

Markers and lines go from warm and solid for the first things noticed to cool and transparent for later ones: 1 red → 2 orange → 3 amber → 4 teal → 5 blue → 6+ indigo. A given step always has the same colour, so notes can be compared. The scale is defined in `src/lib/order.ts`.

## Data

- `src/data/flows.json`: one entry per observer and note, each with ordered `front` / `back` points. `x` and `y` are fractions (0–1) of the image size.
- `src/data/touch.json`: one entry per UV photo with its extraction settings. Masks and straightened photos are in `public/touch/`. All three people are combined, and fronts and backs are kept separate.
- `public/notes/`: images resized from `Banknote reference images` (GBP uses the Elizabeth II series).

## Edit mode

Choose **Edit → Eye-flow points** in the top-right corner (available when eye flow is shown as markers on a note with a recording). The button changes to **Editing eye flow · Done**. Save, Export and Discard are pinned to the bottom of the sidebar.

- Click the note to add a point, and drag a marker to move it. Dragging elsewhere pans the canvas.
- In the list, rename, reorder or delete points.
- Use **Flip** to edit the other side.
- **Save** writes `src/data/flows.json`. This only works while `npm run dev` is running.
- **Export** downloads the JSON, and **Discard** reverts unsaved edits.
- Unsaved point edits are kept in the browser until you save or discard them.

## Re-extracting touch areas

The source photos come from the PDFs in `UV ink/`:

```bash
swift scripts/render-uv.swift "../../UV ink" uv-source
```

Then, with `npm run dev` running, choose **Edit → Touch extraction** (or open `#/touch/extract`). It's dev only. For each page it:

1. Rotates the photo upright, choosing the rotation that best matches the reference artwork.
2. Finds the note's corners. You can drag them if they're off.
3. Detects ink by colour against that note's own base colour under UV, so a green note isn't mistaken for cyan ink. The sliders fine-tune it, and **Auto-calibrate** resets the colour ranges for the current note.

**Save page** writes the mask and photo. **Auto-process unsaved** and **Re-run all** process pages in bulk. Reload the study afterwards to see changes.

Page order note: for the 200 and 2000 ruble notes, the PDF has the back before the front. `touch.json` already maps these correctly.
