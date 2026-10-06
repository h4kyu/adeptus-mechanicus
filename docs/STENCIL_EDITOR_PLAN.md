# Stencil editor plan and project memory

Updated: 2026-10-05. This is the current direction; older README sections describe incremental experiments and may be historical.

## Canvas interaction update — latest user direction

The user explicitly replaced page scrolling with a drawing-app viewport: no page scroll, floating tool island, dismissible settings/palette islands, free pan and continuous zoom. This supersedes earlier requirements to expand the page when zoomed. Full native image resolution is still required. Implemented camera transforms keep the original and overlay aligned without rerendering or resampling them. Latest input split: trackpad two-finger scrolling pans and trackpad pinch zooms (Ctrl+wheel plus Safari GestureEvent support). Touchscreen two-finger dragging pans with no pinch zoom; single-finger taps pick, and one-finger dragging pans only in Pan mode. Zoom slider/+/- provide touchscreen zoom. V selects Pick, H selects Pan, Space temporarily pans from the canvas, and middle drag also pans. Fit and zoom buttons remain available. Only long floating inspectors scroll internally. Browser checks covered mouse pan/zoom, aligned selection and fixed tablet viewport bounds; real iPad/Pencil testing is still pending.

## Compact controls update

New visits and refreshes start in Prepare. Default to Quantized mode and grayscale brightness, with 1–8 groups. Keep cards compact: no explanatory paragraphs, no Inspect regions section, no duplicate visibility controls, and assignment actions directly visible. Show boundaries is the single outline toggle. Show reduced colors and clickable palette swatches control Prepare rendering; hidden swatches carry a crossed-eye indicator. Compare is available only with quantized smoothing/cleanup, stays in place when toggled, and compares independent results. Numeric area fields commit on change so clearing a field does not insert a leading 1. Preserve the fixed canvas and native image resolution.

## Latest decisions — supersede fixed-intensity details below

- Assign edits the actual quantization palette, not fixed Light/Medium/Strong output categories. Regions begin in their automatic group; swatches use computed colors/gray values. Reassign regions among these groups, restore automatic assignment, or mark a region/current group explicitly unbleached. Boundaries remain unchanged. This correction is now implemented with undo/redo.
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
- Assignments currently live only in the tab. No project save/load, drawing tools, bridging or SVG export yet.

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

Lasso and brush select pixels independently of detected regions. Assign or reassign selected pixels to a bucket, joining a silhouette conceptually even if texture produced many automatic fragments. Include undo/redo and non-destructive source handling.

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

Review the revamped UI with real artwork, then implement durable project save/load. The revamp preserves full-resolution page-based zoom and the original-aligned translucent editing workflow. Browser checks covered desktop, tablet-width and narrow layouts; actual iPad/Pencil testing remains outstanding. Lasso/brush overrides and boundary editing follow persistence. Do not treat this roadmap as authorization to implement every stage at once.
