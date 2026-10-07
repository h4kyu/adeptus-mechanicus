# Stencil editor plan and project memory

Updated: 2026-10-06. This is the current direction; older README sections describe incremental experiments and may be historical.

## Assigned treatment unions — latest direction

- **Double-click** a region to temporarily select just that original region inside an assigned treatment. Show its individual outline and an **Individual region** label; reassign, clear, or mark unbleached affects only that region. Selection alone does not alter ownership. A normal click, deselection, brush activation or reopening exits individual mode.
- Clicking an assigned region selects and highlights **all regions with that treatment**, including disconnected pieces and Unbleached. Unassigned regions remain individually selectable. Clicking another member of the selected treatment toggles that group selection off.
- Display boundaries are derived from current assignments: touching regions with the same assigned treatment have no internal seam. Distinct unassigned regions, different treatments, transparent holes and filtered gaps retain boundaries. Selection outlines use the same derived union.
- Reassigning or clearing a selected treatment operates on all its member regions as one undoable action. The inspector reports treatment, region count and combined area; clearing is labelled **Clear group assignment**.
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
- The whole-region **grouping brush** is now implemented as described above. Pixel-level lasso/brush overrides and boundary editing remain later steps.

## Assignment ownership — latest direction

- New segmentation starts with every region unassigned, even when its automatic quantization group is known. Automatic groups provide palette choices and region geometry, not manual ownership. The Assign overlay colors only explicitly assigned regions.
- Assign to a group or mark explicitly unbleached; Clear assignment releases the region. Count explicitly assigned regions, including those assigned to their original computed group. Undo/redo and project persistence preserve unassigned status. Existing saved projects retain their saved assignments; Reset assignments clears them.
- Future lasso/brush tools must exclude already-assigned pixels by default, including explicitly unbleached pixels. Explicit reassignment remains possible; no implicit reassignment through overlapping selections.

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

Lasso and brush select pixels independently of detected regions. By default, exclude pixels already assigned to any group or explicitly unbleached; a broad selection must never implicitly move them into another group. Reassignment requires an explicit action (or clearing their assignment first). This lets users build groups from the remaining unassigned pixels, joining a silhouette even if texture produced many automatic fragments. Include undo/redo and non-destructive source handling. These tools remain deferred.

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

Review the project library and autosave with real artwork, including backup export/import on the intended browser. Then proceed to lasso/brush pixel overrides and boundary editing in small stages. The dedicated layers menu is recorded above as a separate TODO. Preserve the fixed, no-scroll viewport, floating controls and original-resolution translucent overlay. Actual iPad/Pencil testing remains outstanding. Do not treat this roadmap as authorization to implement every stage at once.
