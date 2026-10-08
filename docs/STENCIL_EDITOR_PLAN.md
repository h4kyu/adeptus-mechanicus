# Stencil editor plan and project memory

Updated: 2026-10-07. This is the current direction; older README sections describe incremental experiments and may be historical.

## Vector boundary smoothing — implemented

- Refine now has collapsible **Clean up assignments** and **Smooth boundaries** sections. Build a preview using **Maximum deviation** (0–8 original-image pixels) and **Preserve sharp corners**. Zero traces the exact pixel geometry.
- Build a graph of pixel interfaces, trace shared chains between junctions, simplify within half the tolerance and round corners with quadratic curves using the remaining allowance. Adjacent treatments reuse exactly the same chains in reverse; holes use compound paths with even/odd fill. Strong corners and junctions are pinned. A spatial crossing check falls back to exact chains when necessary.
- A worker builds real SVG treatment fills and shared outlines, aligned with the original-resolution image and camera. **Show vector preview** compares with pixel assignments; Hold to compare still shows the original. Starting a canvas edit returns to pixel view. Cleanup previews and vector previews do not overlap.
- **Keep smoothing** saves an optional `boundaryRefinement` recipe in the portable project. Reopening regenerates curves from the saved assignments, without altering the raster source, segmentation or assignment undo history. **Remove smoothing** clears this independent output operation. Assignment edits invalidate displayed geometry and prompt a rebuild; the saved recipe remains reusable.
- Five feature-focused tests cover simplification/corners, shared-boundary coverage, holes/disconnected pieces/transparency, zero tolerance and recipe persistence. Browser verification covered build, save and restored SVG display; the full suite was not rerun.
- This is image-coordinate vector refinement. Physical dimensions, minimum cut widths, per-sheet composition, bridges and production SVG export remain next steps. Crossing checks are not a substitute for later physical cut validation.

## Post-assignment cleanup — implemented

- Refine now offers **Clean up assignments**: an area threshold in original-image pixels, **Unassigned leftovers only** (default), or **All small patches** (includes assigned intensities and Unbleached).
- Find four-connected components of effective pixel treatments, including lasso overrides and opaque pixels filtered out during Prepare. Process patches strictly smaller than the threshold, smallest first. Merge into the assigned neighboring treatment with the longest total shared border; coalesce touching pieces of that treatment before evaluating subsequent sizes. Ties use a deterministic treatment order.
- Transparent pixels are excluded and cannot connect patches. Unassigned is never a merge destination; isolated patches with no assigned neighbor remain unchanged and are reported.
- **Preview cleanup** runs in a background worker. Tint, unassigned hints and boundaries preview the result; amber highlights changed pixels. **Show cleanup preview** compares with current assignments. Preview is transient and never saved or added to undo history. Changing settings or assignments, starting a canvas edit, Cancel, Escape or closing Refine discards it; camera navigation can preserve a finished preview.
- **Apply cleanup** writes pixel exceptions as one undoable edit, using the existing repo autosave and portable project fields. Threshold and scope persist; older projects default to 20 pixels and unassigned-only. Original pixels and segmentation stay intact.
- Focused validation: four cleanup tests (ownership scopes, shared-border merging, threshold/transparency, pixel edits and atomic undo); browser preview/apply/undo check. Per user request, the full suite was not rerun.
- Agreed next sequence: post-assignment cleanup → vector tracing/boundary smoothing → bridges on each actual stencil sheet. Physical size and separate-versus-cumulative intensity sheets must be established for production geometry. Vector smoothing is now implemented as described above; bridging remains next.

## Pixel lasso — implemented, latest direction

- **Lasso (L)** selects actual source-resolution pixels independently of detected regions. Drag a closed loop and release; alternatively click corners and use Enter or **Finish lasso**. Choose a treatment afterward, or **Clear assignment** to release the selected pixels. Escape, Deselect and clicking outside the image discard the selection.
- Latest user correction: **include already-assigned pixels**, including Unbleached. Assigning a lasso deliberately reassigns all opaque pixels inside it. This supersedes the earlier protection rule for lasso only. Transparent pixels stay untouched; opaque pixels excluded by segmentation's minimum-area filter can be assigned.
- The path uses an even/odd scanline fill at pixel centers, supporting concave paths without resizing the image. Region defaults plus per-pixel exceptions preserve the original source and segmentation. Each applied selection is one undo step shared with region and brush history.
- Pick, treatment unions, tint, unassigned hints and merged boundaries use the effective pixel treatment. Double-click still explicitly reassigns the entire original region. The whole-region brush continues to fill only remaining unassigned pixels, preserving pixel exceptions.
- Pixel exceptions autosave in the optional typed-array `pixelAssignments` field in portable v1 project files; older projects need no conversion. Reopening preserves exceptions and starts fresh undo history. Use the current editor for projects containing lasso edits.
- Navigation, pointer cancellation and window blur cancel an unfinished path. A finished selection can be inspected while panning/zooming. Pixel brush and boundary refinement remain deferred.

## Assigned treatment unions — latest direction

- **Double-click** a region to temporarily select just that original region inside an assigned treatment. Show its individual outline and an **Individual region** label; reassign, clear, or mark unbleached affects only that region. Selection alone does not alter ownership. A normal click, deselection, brush activation or reopening exits individual mode.
- Clicking an assigned region selects and highlights **all regions with that treatment**, including disconnected pieces and Unbleached. Unassigned regions remain individually selectable. Clicking another member of the selected treatment toggles that group selection off.
- Display boundaries are derived from current assignments: touching regions with the same assigned treatment have no internal seam. Distinct unassigned regions, different treatments, transparent holes and filtered gaps retain boundaries. Selection outlines use the same derived union.
- Reassigning or clearing a selected treatment operates on all its member regions as one undoable action. The inspector identifies the selected treatment; clearing is labelled **Clear group assignment**.
- Original segmentation labels remain intact under this logical union. Assignment, brush completion, undo/redo, clear/reset and project reopen regenerate visible boundaries, preserving reversible edits and full-resolution source pixels.

## Grouping brush and assignment feedback — implemented

- Clicking empty canvas outside the artwork deselects region highlights. Panning/dragging does not clear selection accidentally.
- **Mark unassigned pixels** adds a light dotted overlay to visible, unassigned pixels (including regions filtered out by minimum area); assigned regions retain treatment tint, and Unbleached retains its distinct hatch. This display preference saves with the project and does not depend on assignment-overlay opacity. Hold to compare hides all hints.
- **Brush (B)** paints whole detected regions, not individual pixels. Choose a treatment in Assign and set the brush diameter in original-image pixels. The circular brush sweeps continuously between pointer events, including thin regions during fast strokes.
- Strokes only claim unassigned, eligible regions. Already-assigned regions, including explicitly Unbleached, are skipped. Use Pick for explicit reassignment, or Clear assignment before brushing again. Filtered-out and transparent regions are not brush targets.
- A stroke previews while dragging and commits on release as one undoable assignment operation; empty strokes add no history. Pointer cancellation, switching to navigation (including two-finger pan), Escape, and window blur cancel the pending preview. Original pixels and region geometry remain unchanged.
- Verified with algorithm tests for continuous coverage, brush footprint, off-image clipping, ownership protection and stroke undo; browser checks cover painting, protected regions, undo and background deselection. Actual iPad/Pencil testing remains outstanding.

## Unified editor and treatment palette — latest direction

- Prepare and Assign share one original-resolution editing canvas. They are compact, independently expandable floating islands on the right, no longer header stages. Optional before/after comparison remains an inspection view.
- The original image is the default base. Prepare offers **Show quantized** for the reduced-color preview; Assign offers **Show boundaries** for all selectable region outlines. Both toggles affect rendering only. Boundaries default off, and selecting a region still highlights its outline. Hold to compare temporarily shows the untouched original.
- The darkest quantization slot is the **Unbleached** treatment; remaining slots are **Intensity 1**, **Intensity 2**, etc. Three quantized colors mean exactly one unbleached plus two intensity choices. Unassigned remains separate, and new regions still begin unassigned. Legacy assignments to palette slot 0 are interpreted as unbleached when reopened.
- The whole-region **grouping brush** is now implemented as described above. Pixel lasso overrides are implemented; pixel-level brush and boundary editing remain later steps.

## Assignment ownership — latest direction

- New segmentation starts with every region unassigned, even when its automatic quantization group is known. Automatic groups provide palette choices and region geometry, not manual ownership. The Assign overlay colors only explicitly assigned regions.
- Assign to a group or mark explicitly unbleached; Clear assignment releases the region. Count explicitly assigned pixels, including those assigned to their original computed group. Undo/redo and project persistence preserve unassigned status. Existing saved projects retain their saved assignments; Reset assignments clears them.
- The grouping brush excludes assigned pixels, including explicitly unbleached pixels. Lasso includes assigned pixels for deliberate reassignment, per the latest user correction.

## Repo storage — latest direction

- The editor now runs with `node stencil-app/server.mjs`, serving the same loopback address on port 8765. Static-only preview servers cannot save projects.
- Autosave writes versioned `.stencil.json` files into `stencil-app/projects/`, ignored by Git. It syncs a temporary file before atomic replacement. Save errors retain the open editor state; no silent browser-storage fallback. Maximum save payload is 512 MB, with no image downsampling.
- The library offers **Copy browser projects to repo** for older IndexedDB projects at the same browser profile/address. Copying is explicit, retains browser copies, and never overwrites an existing repo project ID. Repeating migration can restore a previously deleted repo project from its old browser copy.
- The server is loopback-only, validates request host/origin and project data, limits file access to the project folder, and serves only editor assets. It does not expose the repo as a static website.

## Project library — implemented

- Startup opens a local project library with thumbnails, names and last-edited times. New project chooses an image; a sample is also available. New projects start in the unified editor with the default settings.
- The project-name menu opens the library, renames the current project, exports/imports a project file, and retries saving. Library cards open, rename or delete projects. Deletion names the project in an explicit confirmation; deleting the current project returns to the library.
- Debounced autosave stores full-resolution decoded source pixels, exact segmentation (including comparison data), palette, manual group/unbleached assignments, settings, stage, visibility and camera as portable files in the git-ignored `stencil-app/projects/` folder through `node stencil-app/server.mjs`. Switching or creating projects waits for pending segmentation and saving. Reopening restores saved segmentation without recomputing it. Undo/redo starts fresh; restored manual assignments still protect segmentation settings.
- Versioned `.stencil.json` export/import provides portable backups. Import validates pixel arrays, region maps, palette assignments and settings, and creates a separate project rather than replacing an existing ID. No cross-device sync; projects live on disk and survive clearing browser data. Git does not back up the ignored folder. A storage failure keeps the open project available, displays an error and allows export/retry.
- Checks: unit coverage for lossless project round trips, malformed data and restored-assignment protection; isolated browser checks for the legacy store, plus disk and HTTP tests for create/list/reopen/rename/delete, migration, failed-save preservation and access boundaries. UI checks covered sample creation, renaming, reload/reopen, restored unbleached assignment, and importing a complete project. Native backup download completion and actual iPad testing still need device verification.

## TODO — layers menu

- [ ] Add a dedicated layers menu with toggleable visibility. Keep it compact and consistent with the floating tools. This is a future UI task; do not implement it as part of project persistence.

## Canvas interaction update — latest user direction

The user explicitly replaced page scrolling with a drawing-app viewport: no page scroll, floating tool island, dismissible settings/palette islands, free pan and continuous zoom. This supersedes earlier requirements to expand the page when zoomed. Full native image resolution is still required. Implemented camera transforms keep the original and overlay aligned without rerendering or resampling them. Latest input split: trackpad two-finger scrolling pans and trackpad pinch zooms (Ctrl+wheel plus Safari GestureEvent support). Touchscreen two-finger dragging pans with no pinch zoom; single-finger taps pick, and one-finger dragging pans only in Pan mode. Zoom slider/+/- provide touchscreen zoom. V selects Pick, H selects Pan, Space temporarily pans from the canvas, and middle drag also pans. Fit and zoom buttons remain available. Only long floating inspectors scroll internally. Browser checks covered mouse pan/zoom, aligned selection and fixed tablet viewport bounds; real iPad/Pencil testing is still pending.

## Compact controls update

New visits open the project library; new projects use the unified editor. Default to Quantized mode and grayscale brightness, with 1–8 groups. Keep cards compact: no explanatory paragraphs, no Inspect regions section, no duplicate visibility controls, and assignment actions directly visible. Show boundaries is the single outline toggle. Show reduced colors and clickable palette swatches control Prepare rendering; hidden swatches carry a crossed-eye indicator. Compare is available only with quantized smoothing/cleanup, stays in place when toggled, and compares independent results. Numeric area fields commit on change so clearing a field does not insert a leading 1. **Filter small regions** toggles the minimum-area filter: off retains every region (effective minimum 1), disables the numeric field and remembers its threshold. The toggle persists per project; older projects default to enabled to preserve their existing settings. Preserve the fixed canvas and native image resolution.

## Latest decisions — supersede fixed-intensity details below

- Assign edits the actual quantization palette, not fixed Light/Medium/Strong output categories. Regions begin unassigned; swatches use computed colors/gray values. Assign regions explicitly, clear an assignment, or mark a region/current group explicitly unbleached. Boundaries remain unchanged. This correction is now implemented with undo/redo.
- Before project save/load, do a dedicated UI revamp. The user requests a modern, aesthetic, simple and refined interface, using suitable available frontend skills or MCP capabilities when that stage begins. Keep it organized, touch-friendly and uncluttered. The first UI revamp is now implemented: warm neutral palette, compact header, image-first workspace with right-side inspector, contextual disclosures, and responsive layouts.
- Revised order: actual-group assignment → UI revamp → project save/load → pixel selections and boundary editing. Physical bleach intensity mapping and stencil export remain later.

## Purpose and user priorities

Create stencils for spray-bottle bleaching on clothing, eventually exported as Cricut-friendly SVGs. Initial hardware/material: Cricut Explore Air 2, 7.5 mil Mylar, approximately 12 × 12 inches. Illustrations and text are primary inputs. Reusable Mylar requires bridges for islands; adhesive single-use stencils are a possible later alternative, not the current implementation target.

Preserve meaningful silhouettes and clear boundaries rather than reproducing every small hue difference. Images vary; no single automatic configuration will express the user's artistic intent. Automatic segmentation is an editable starting point, not the final authority.

Work incrementally. Keep explanations concise, with simple descriptions of the algorithms. Prioritize a coherent, uncluttered editing experience. No fabric-specific rendering or simulated bleach texture: a simple intensity view is sufficient. Retain the full decoded source resolution; never silently downsample. Fit and zoom affect display only. Avoid nested scrolling image windows.

## Implemented foundation

- Original-resolution raster loading and synchronized Fit/25–400% display zoom.
- Deterministic OKLab color quantization; optional grayscale conversion before the same pipeline. Currently 1–8 segmentation groups.
- Optional bilateral smoothing, connected-component detection, and optional smallest-first cleanup merging into the neighbor with the longest shared four-connected border.
- Cleanup preserves transparent gaps; minimum-area visibility filtering remains a separate operation.
- Original plus before/after comparison, independent region selection and layer visibility, cached rendering for hover performance.
- With cleanup enabled, comparison isolates before/after cleanup with smoothing and quantization held constant. Otherwise it compares before/after smoothing. Both segmented panels are already quantized.
- First Assign workspace implemented: original-aligned translucent overlay, opacity, hold-to-show-original, region assignment to unbleached/light/medium/strong, unassign, undo/redo and explicit discard protection.
- Projects now persist locally with a library and portable import/export. No drawing tools, bridging or SVG export yet.

## Agreed editing direction

Separate shape geometry from intended bleach intensity. A white source region may be assigned unbleached without changing its outline. Segmentation groups and output intensity buckets are different concepts.

The main editing view is ONE canvas: original image underneath, editable segmentation overlaid translucently, sharing the same pixel coordinates, zoom and pan. This replaces side-by-side as the default editing workflow; comparison remains an optional inspection tool.

Overlay design:
- Adjustable opacity so original detail remains visible.
- Clear selected-region outline and stronger tint; other regions remain subtle.
- A temporary show-original action, accessible without relying on hover.
- Assigned intensity visible in the overlay; unassigned and explicitly unbleached must be distinguishable.
- Tap/click a region on the original/overlay, then assign its output bucket.
- Future lasso and brush edits happen on this same aligned canvas.

## Staged roadmap

### 1. Focused Assign workspace — first slice implemented

Build a thin end-to-end slice using existing detected regions:
1. Open the current segmentation in the single translucent-overlay view.
2. Select a region and assign it to unbleached or one of up to three bleach intensities. Keep output count separate from segmentation group count and extensible later.
3. Assign background through the same interaction; never assume every white region is background. This changes the intended treatment, not source pixels.
4. Allow multiple regions to share an intensity without merging their geometry.
5. Add undo/redo for assignments and clear selection/assignment feedback.
6. Save/load a versioned local project preserving the source, segmentation/settings and manual assignments. Do not imply automatic cross-device sync.

First implementation slice: overlay, opacity, temporary original view, selection, bucket assignment and undo/redo. Follow immediately with durable project save/load before substantial manual editing work.

Keep manual decisions separate from generated segmentation. Never silently discard edits when settings change. Initially use an explicit re-segmentation/reset workflow with a warning when edits would be lost; automatic edit remapping is deferred.

Acceptance: changing a selected region's bucket changes only its intended treatment; outline stays fixed, original remains untouched, undo restores the prior assignment. Selection must work by touch and mouse, at every zoom. Source and overlay remain aligned at original resolution. Changing view/opacity must not recompute segmentation or lose assignments.

### 2. Pixel selection overrides

Pixel lasso is implemented as described above, including deliberate reassignment of existing treatments. A pixel-level brush remains deferred; the current brush assigns whole original regions while protecting already-assigned pixels. Keep undo/redo and non-destructive source handling.

### 3. Boundary refinement

Add/remove pixels from a region, split with a drawn line, and optionally snap edits to visible image edges. Automatic edge suggestions must be editable and overridable. Distinguish editing geometry from simply assigning intensity.

### 4. Local interpretation / zones

User-defined zones can be excluded from quantization or processed independently with a different group count. This addresses detailed portions and broad smooth portions needing different treatment. Later offer automatically suggested zones that the user can edit/remove. Exact ordering relative to boundary tools can follow real-image testing.

### 5. Physical stencil production

Set intended graphic dimensions; derive feasible feature sizes from physical cutting constraints rather than arbitrary image-pixel cutoffs. Trace and simplify boundaries, investigate cut offsets, identify islands and add editable bridges, export separate intensity SVGs and validate Cricut import. Do not implement these prematurely.

## UI organization and iPad direction

Proposed structure: Prepare → Assign → Refine. Prepare holds segmentation/cleanup with advanced settings collapsed; Assign emphasizes the image, intensity buckets and undo/redo; Refine exposes drawing tools only as needed. Avoid accumulating all controls in a long sidebar.

Recommended platform path, not yet a native-app commitment: continue the shared web app, test in iPad Safari, then support Home Screen installation/offline behavior as warranted. Native PencilKit is an alternative if real drawing tests justify a separate native interface.

Proposed gestures: Pencil edits; two fingers pan/zoom; provide explicit navigation for finger-only use. Essential actions must not depend on hover. Test actual Pencil/touch behavior and original-resolution performance on the user's device.

The iPad model, iPadOS version and Apple Pencil availability are still unknown. Ask when preparing device testing; do not block desktop-capable editing work. iPad access needs a reachable local-network address or hosting: Mac localhost is not accessible as iPad localhost. Do not publish or expose the current server as part of documentation work.

## Next recommended action

Review the project library and autosave with real artwork, including backup export/import on the intended browser. Review lasso on real artwork, then consider pixel brush and boundary editing in small stages. The dedicated layers menu is recorded above as a separate TODO. Preserve the fixed, no-scroll viewport, floating controls and original-resolution translucent overlay. Actual iPad/Pencil testing remains outstanding. Do not treat this roadmap as authorization to implement every stage at once.
