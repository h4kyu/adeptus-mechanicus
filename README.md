# Stencil region inspector

Current stage: full-resolution color/grayscale segmentation, optional smoothing and small-region cleanup, and interactive comparison. Manual group assignment is available in the Assign workspace, with a local project library, autosave and portable project backups. Active-sheet SVG export includes smoothed boundaries, overlap, physical sizing and retained bridges; Cricut import validation is still pending. See [the current plan and project memory](docs/STENCIL_EDITOR_PLAN.md); the sections below also retain historical implementation notes.

## Run

```sh
node stencil-app/server.mjs
node --test stencil-app/tests/*.test.mjs
```

Open http://127.0.0.1:8765. Processing stays in the browser. PNG/JPEG/WebP files up to 25 MB are accepted at their original decoded resolution. Area sizes are measured in source image pixels; zoom changes only display size.

## Inspect

- **Color areas:** four-connected region growing, comparing pixels to a fixed seed in premultiplied RGB plus alpha. Euclidean distance is normalized by 2. Increasing tolerance generally produces broader groups; boundaries are seed/order dependent and not guaranteed to merge monotonically. Fixed seeds avoid neighbor-to-neighbor gradient chaining. Transparent RGB does not create phantom regions.
- **Silhouettes:** classify foreground using background color distance or transparency cutoff, then label connected foreground and background components separately. Internal foreground colors are ignored. Enclosed holes remain inspectable background regions.
- Hover highlights a region yellow. Click pins it pink. The area selector provides keyboard access to the 200 largest regions plus any clicked region. All regions remain available on the canvas. Escape or Clear selection clears the pin.
- Cyan outlines can be hidden; hover/selected outlines remain. Original colors are always retained under overlays.
- Minimum area hides small regions without merging them or changing the other regions. Hidden pixels remain visible in the original image but are not selectable; the status reports their count.
- Changing detection settings recomputes regions and clears selection because region identities change. Workers are cancelled on new settings to avoid stale results and keep the interface responsive.

Use Load color sample to compare touching red/blue solids, green letter holes, and a multicolor gradient. In Color areas, the red and blue rectangles separate; in Silhouettes with white background, they form one connected foreground region. The gradient splits in Color areas but forms one foreground region in Silhouettes.

This is an initial segmentation experiment, not semantic object recognition or vector tracing. Fine antialiasing and noisy backgrounds can create small components. Original stage 1/2 intensity and mask modules remain as isolated, tested experiments, but are not used by the current UI.

Later stages: refine segmentation based on image tests, trace/simplify contours, set physical dimensions, detect islands and add editable bridges, then export and validate SVGs for Cricut.

## Quantization comparison

Quantized colors is now the default, with 2–16 requested color groups (default 8). These are segmentation groups, not future stencil layers. Show reduced colors toggles the actual palette assignment beneath the same outlines. Seed tolerance retains the previous region grower; Silhouettes is unchanged. The minimum-area setting still filters rather than merges.

Implementation: sRGB is linearized and converted to OKLab. A canonical 32×32×32 RGB histogram stores alpha-weighted mean colors. Fixed-seed, weighted k-means++ initializes centers; weighted Lloyd updates run until converged or 30 iterations. The histogram bounds fitting cost; every visible pixel is subsequently assigned using its own OKLab color. Four-connected labeling splits each palette group into selectable regions. Fully transparent pixels never influence fitting and form a separate inspectable class; partial alpha weights fitting and is preserved in the display. Fewer palette colors may be returned when there are fewer occupied histogram bins. Sorting centers stabilizes palette IDs for identical inputs, but IDs and boundaries may change when settings change.

No smoothing, fragment merging, or resize changes were added to this comparison. Tests include deterministic textured two-color and gradient fixtures, transparency, disconnected regions and color-conversion checks. Real artwork still needs visual evaluation; synthetic tests cannot establish artistic quality.

## Color layers

In Quantized colors mode, each palette color has a layer containing its retained connected regions. The layer list shows a swatch and area count. Clicking a layer highlights its regions together; individual areas remain selectable. Visibility checkboxes replace that color's pixels (including filtered fragments) with checkerboard and disable their hit testing. Other color layers retain their positions; this is a disjoint segmentation, not a stack that reveals underlying artwork. Fully transparent regions do not create color layers. Counts and selected-layer pixel totals exclude minimum-area-filtered regions. Detection changes reset visibility and selection because palette identities can change. Toggling the original/reduced-color view preserves layer state.

## Optional bilateral smoothing

Quantized colors mode now offers Smooth before quantization (off by default), radius 1–5 working pixels and color strength 1–20 (OKLab Gaussian sigma 0.01–0.20). A single circular-neighborhood bilateral pass weights neighbors by spatial distance and OKLab color distance, averages OKLab colors and converts back to sRGB. It reads immutable input, renormalizes weights at image borders, weights neighbors by opacity and leaves every alpha byte unchanged. Transparent RGB cannot bleed into visible pixels. Strong edges are favored, not guaranteed: high strength can erase subtle detail. No fragment merging or contour simplification is performed.

The worker smooths before fitting the palette and assigning pixel colors. Original pixels remain intact. Image underneath boundaries switches between original and smoothed pixels without recomputing regions. Show reduced colors overrides that view; turn it off to compare smoothing. All overlays represent the current segmentation in either view. Changing filter settings recomputes and resets layer state; toggling only the displayed image does not. Seed tolerance and Silhouettes modes are unchanged. Radius uses the existing maximum-1000-pixel working resolution, not physical units.

Side-by-side comparison: the comparison checkbox enables smoothing if necessary and displays Original and Smoothed at equal scale without region overlays, palette substitution, or hidden-layer effects. Fit/100%/200%/400% zoom and synchronized scrolling support close inspection. A missing or pending filtered result is shown as an empty panel with a status message, never as a fake unchanged result. Turning comparison off restores the region inspector.

### Updated smoothing comparison

Side-by-side now always fits both columns and renders the full image height in normal page flow; no internal scrolling or zoom window. Both original and smoothed inputs are quantized independently using identical color-count and minimum-area settings, and each panel renders its own boundary map and retained area count. Separate toggles show boundaries and quantized colors. Turning quantized colors off shows original/filtered pixels under their respective boundaries. Layer hiding/highlighting is ignored in comparison. This supersedes the earlier raw-image/linked-scroll comparison. Palette fitting runs twice when smoothing is enabled, adding computation time.

### Grayscale and hover caching

Choose **Group by → Grayscale brightness** to remove chroma while retaining OKLab lightness, before smoothing and quantization. Brightness group count uses the same 2–16 control. The comparison keeps the original color image alongside the two grayscale segmentation results. Alpha remains unchanged.

Rendering caches the static images and cropped region highlights. Hover only composites changed views, without rebuilding quantized pixels or rendering the hidden single-image view. Detection or display changes invalidate the relevant cached view.

### Small-region cleanup

Enable **Merge small regions** in quantized color or grayscale mode. The threshold is an exclusive pixel-area cutoff on the resized working image. Cleanup operates on all components before the separate minimum-area visibility filter. It merges the smallest first into the adjacent opaque region with the longest shared four-connected border. Ties use stable initial component IDs (size order, then scan order). Touching components of the destination color coalesce immediately. Transparent regions and isolated opaque pieces are retained.

With cleanup enabled, comparison shows the same quantization before and after merging; smoothing is held constant. Disable cleanup to return to the smoothing comparison. Both views retain selection and layer visibility. Set the minimum-area display filter to 1 to inspect all fragments.

### Original resolution and zoom

Uploads now retain their full decoded pixel dimensions throughout processing; the previous 1,000-pixel reduction is removed. Radius and area thresholds use original image pixels. Fit columns scales only the display. Zoom offers 25%, 50%, 100%, 200%, and 400%; 100% maps one source pixel to one CSS pixel. All comparison panels share the zoom, and enlargement expands the page with ordinary page scrolling. No nested image scroll windows or additional resampling are introduced by zoom. Larger originals require more processing time and memory.

### Assign workspace

The default Assign view places a translucent editable segmentation over the original, at identical native pixel dimensions. Tap/click a region, then choose Unbleached, Light, Medium or Strong; Unassign restores the blue unassigned state. These output choices are separate from segmentation palette groups and do not alter geometry. Opacity affects the overlay only. Hold the original button (pointer or Space/Enter) for an unobstructed reference. Undo/redo buttons and Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z edit assignment history.

Prepare retains the existing inspection tools. Once assignments/history exist, segmentation controls lock; an explicit discard dialog is required to unlock them or replace the source. Cancel preserves edits. Navigation, zoom and display changes preserve assignments. Fully transparent and filtered-out pixels cannot be assigned through the image. There is no project persistence yet: the UI states this and leaving/reloading with edits requests a browser warning.

### Palette assignment correction

Assign now starts every region in its computed quantization group and offers that actual palette as swatches. Fixed Light/Medium/Strong categories have been removed. Change a region’s group or mark it unbleached; restore automatic group reverses its override. The selected-group action marks all regions currently assigned to that group unbleached in one undoable operation. Unbleached uses a dark hatch so it remains distinct from a black palette group. Source pixels and segmentation boundaries are unchanged. Seed-tolerance/silhouette modes have no quantization palette; use Quantized colors to edit palette groups.

The next planned stage is a simple, refined UI revamp before project save/load.

### Studio interface

The editor now uses a neutral light interface with a compact Prepare/Assign header, global image import and a right-hand inspector. Assign keeps palette choices visible and puts whole-group actions and guidance in disclosures. Undo/redo sits above the canvas; opacity, original visibility and hold-to-compare are together. Prepare groups smoothing/cleanup, layer visibility and region inspection into expandable controls. On narrow screens tools move below the Assign canvas. Full-resolution zoom still expands the page without nested scrolling windows.

Verified in the browser at desktop, 820px tablet and 390px narrow widths; this does not replace actual iPad/Pencil testing. Project persistence remains the next feature.

### Fixed canvas workspace (current)

The latest layout replaces page scrolling with a full-viewport drawing surface. Canvas tools and settings float above it. Tap/click selects; drag with the Pan tool, middle mouse, or Space to move. Touch drag pans and two-pointer pinch zooms around the gesture midpoint. Wheel zoom stays anchored to the pointer. Zoom buttons and Fit are available. The original and overlay share one camera transform and preserve their original raster dimensions. Floating inspectors can scroll; the page and canvas do not. This supersedes the earlier page-based zoom notes.

### Navigation input split

Trackpad scroll pans; trackpad pinch zooms at the pointer (Ctrl+wheel and Safari gesture events). Touchscreen two-finger movement only pans: changing finger separation does not change zoom. In Pick mode, a single-finger tap selects; a drag is not treated as a tap. Pan mode permits one-finger dragging. V/H switch Pick/Pan, and holding Space on the canvas temporarily pans. Zoom slider, +/− and Fit provide alternatives to pinching. Slider and gestures change only the shared camera, not segmentation or raster dimensions. Physical iPad and trackpad gesture testing is still pending.

### Project library (current)

Start with **New project**, **Try a sample**, or a saved thumbnail. The project-name dropdown opens **All projects**, Rename, Export project, Import project and Retry saving. Library cards provide Rename and Delete; deleting asks for confirmation.

Autosave stores the full-resolution original, exact region maps, palette, assignments, settings and view as `.stencil.json` files in `stencil-app/projects/`. Wait for **Saved in repo** before closing. Switching projects waits for pending processing and saving; reopening does not recompute segmentation. Undo history starts fresh when reopening. Storage failures preserve the open work and display an error.

Export a `.stencil.json` file for backups or transfers. Import creates a separate project. Project files live in the repo folder on this computer and are shared by browsers using the local server. Clearing browser data does not remove them. The project folder is git-ignored; Git does not back it up. There is no automatic cross-device sync. Portable files contain decoded full-resolution arrays and may be substantially larger than the original compressed image.

Run the Node test suite above; it includes isolated disk and localhost HTTP tests for saving, reopening, migration, deletion, failed writes and request access checks. The legacy `tests/projects.browser.html` checks browser storage only, retained for migration testing.

### Explicit assignment ownership (current)

New segmentations start unassigned in Assign. Select a region, then explicitly assign a palette group or mark it unbleached. **Clear assignment** makes it available again. Only assigned areas receive overlay color; the counter shows assigned regions. Existing saved projects keep their saved assignments; Reset assignments clears all of them. Future lasso/brush tools will skip already-assigned pixels by default, so overlapping selections cannot silently move them to another group.

### Repo project storage

The Node server is required for saving; the old `python3 -m http.server` command only serves static files and cannot save projects. Run `node stencil-app/server.mjs` from the repo root, then open `http://127.0.0.1:8765`. The server binds only to this computer. To choose another port, use `PORT=8767 node stencil-app/server.mjs`. Project paths are resolved relative to the server file, not the terminal's working directory.

Use **Copy browser projects to repo** once in the library to copy older IndexedDB projects from the same browser profile and site address. Browser copies remain intact, and existing repo project IDs are never overwritten. Repeating the copy skips existing IDs; because browser copies remain, copying again after deleting a repo project can restore that old browser copy. Other browser profiles or site addresses require exporting/importing or running the new server at the old address.

Saves write and sync a temporary file, then atomically replace the previous project. A failed save keeps the editor open and reports an error. Files currently use the portable JSON format and have a 512 MB per-project save limit; originals are never downsampled to fit. Back up `stencil-app/projects/` or export individual projects.

### Unified editor (current)

Prepare and Assign are independently expandable islands on the right of a single canvas. The original image is the default base; **Show quantized** in Prepare reveals the reduced-color preview. **Show boundaries** in Assign draws selectable region edges without recomputing segmentation. Hold to compare shows the original with previews and overlays temporarily hidden.

N quantized colors provide N treatment choices: **Unbleached** replaces the darkest slot, followed by N−1 intensities. Three colors therefore give Unbleached, Intensity 1, and Intensity 2. Regions still start unassigned. Older saved assignments to slot 0 reopen as unbleached. A future grouping brush will assign whole regions crossed by a stroke; it is not part of this change.

### Whole-region grouping brush

Choose **Brush** (B), select a treatment in Assign, and drag across the artwork. The brush assigns each whole detected region touched by its circular footprint; diameter is measured in original-image pixels. Assigned and Unbleached regions are protected. Use Pick to explicitly reassign them, or Clear assignment to release them for brushing. Minimum-area-filtered regions remain unavailable until filtering is disabled. One stroke is one undo step. Escape, cancelled input, losing window focus, or starting navigation cancels the pending stroke.

Unassigned pixels have a subtle dotted hint; assigned regions have treatment tint, with a separate hatch for Unbleached. Toggle **Mark unassigned pixels** to hide the hints. Clicking canvas outside the artwork deselects the current region.

### Assigned group selection

Clicking an assigned region highlights every region with the same treatment, including disconnected pieces. Touching regions in that treatment no longer show internal boundaries. Unassigned regions retain their own boundaries and individual selection. Reassign or **Clear group assignment** affects the whole selected treatment in one undo step. Original segmentation remains intact so undo, clearing and reopening can restore the appropriate boundaries.

## Export an active stencil sheet

1. In **Stencil & bridges**, select the active intensity and confirm **Finished size** fits the 29 × 59 cm working area. The artwork is centered; your full 24 × 12 inch Mylar stays intact.
2. Choose **Export active sheet SVG**. Review the final geometry, dimensions and any island/bridge notes.
3. Select **Download SVG**, then upload it as a cut image in Cricut Design Space.
4. Verify the imported width and height against the export panel, confirm the sheet fits your machine/mat's usable cut area, and inspect the bridges before a small test cut. Repeat for each active sheet.

The SVG cuts **only the stencil openings, with no outer sheet border**. Keep the compound shape together in Design Space. If import crops blank SVG space, use the review’s cut-outline size and top-left offsets from a common working-area origin to align all sheets; do not center each layer separately. Bridges are built into the outlines; the file uses no preview masks or embedded images. Export does not modify the saved artwork. Small-detail checks do not measure every narrow neck or certify cutability. Actual Design Space import and physical cutting remain to be validated; automatic tiling and batch export are not included.
