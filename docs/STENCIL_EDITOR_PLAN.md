# Stencil editor plan and project memory

Updated: 2026-10-20. This is the current direction; older README sections describe incremental experiments and may be historical.

## Minimum retained connection width — implemented

- Island/bridge analysis now requires a 3-source-pixel retained connection. Label four-connected cores that contain a full retained 3 × 3 neighborhood, then grow their labels over the original retained pixels without merging. Thus 1–2 pixel necks between substantial areas produce separate islands; straight 3-pixel necks remain connected. The square footprint is conservative around diagonal necks/corners. This is analysis only: assignments, cut paths, smoothing, physical scale and saved bridges are unchanged.
- Completely thin features with no core remain selectable for manual review rather than disappearing; existing single-pixel island exclusion remains. This is a raster strength heuristic, not a complete physical minimum-width certification or a reason to resize artwork.
- Auto bridge anchors on the solid cores and checks a 3 × 3 retained corridor through each proposed capsule. It can reinforce existing fragile necks, respects existing millimeter width limits, and skips candidates that cannot satisfy the connection rule. Existing manual bridges also participate in the same island analysis.
- Focused connection-width, stencil, auto-bridge and two-piece layout checks pass (25 tests). Covers horizontal/vertical 1–4 pixel necks, both frame modes, reinforcing narrow necks without repeated suggestions, manual bridge width, unchanged masks and preservation of thin features. No full suite or physical cut verification performed.

## Two-piece Mylar layout — implemented

- Oversized artwork can use two Mylar pieces per intensity, with suggested joins that favor Unbleached areas. The editor runs on the standard port 8765 and uses the existing local project library.
- **Stencil & bridges → Finished size → Mylar pieces per intensity → Two overlapping sheets** preserves physical scale and source resolution. A shared straight vertical/horizontal join, sheet orientation, 1–100 mm working-area overlap (default 10), manual join position and **Suggest join through unbleached areas** apply across all intensity layers. Each intensity has its own A/B pair; three intensities may therefore require six physical pieces. This first version assumes aligning/taping each pair together before spraying. Separate sequential spraying and curved joins are deferred.
- The suggestion worker scans effective pixel assignments once, builds row/column prefix sums, then searches feasible joins in both stock orientations. Minimize positive-treatment pixels in the overlap plus 2 mm clearance (also include the uncut joining borders when keeping full stock), penalize unassigned pixels, then prefer a balanced position on ties. All positive treatments count, including direct layer overlaps. Transparency stays retained. This is a straight-band heuristic; smoothing, mechanical strength and physical application still require review. Bonsai at 15 in fits two pieces; its suggested horizontal band still crosses openings and is explicitly flagged.
- **Active physical piece** selects A or B for manual/auto bridges, islands and SVG export. **Fit both pieces** shows the shared assembly. Native-scale connectivity uses the selected working-area rectangle and does not join disconnected sides through a virtual outer frame. New bridges store `piece: 0 | 1` as well as intensity; existing bridges retain global coordinates, are shared where they intersect, and are flagged for review after layout/size changes. Deleting/resetting a shared bridge on one piece preserves its other-piece instance. Bridge undo remains separate; assignments and lasso history remain unchanged.
- `stencilPlan.layout` is optional `{mode,axis,orientation,overlapMm,split,activePiece,trimJoin}`; old files use a single sheet and missing `trimJoin` means false. Layout saves with existing disk autosave and portable v1 projects. Original pixels and effective assignments are unchanged. Assignment, smoothing and sizing edits invalidate join advice and geometry; invalid sizes remain blocked rather than silently resized.
- Trace/smooth the treatment union in global artwork coordinates first. Clip its bridge-subtracted vector openings to each full 290 × 590 mm working rectangle. Duplicate overlap openings in both pieces so overlapping stock does not cover a cutout. Export one openings-only compound path per selected piece, with A/B filename, physical dimensions, local cut offsets and assembly working-origin offsets. Do not cut stock edges, the join line or registration marks. A piece with no openings needs uncut shielding, not an empty cut file. Join-opening warnings use actual final vector geometry. Align working areas consistently across layers; offsets do not refer to raw stock edges or cropped cut bounds.
- **Full stock is the default.** The physical 24 × 12 in stock extends beyond a centered 590 × 290 mm working area by 9.8 mm on each long-axis end and 7.4 mm on each short-axis side. These uncut joining borders can block the neighboring piece's openings outside the usable overlap. Exports test the actual final vector openings against those border bands and block affected pieces. Move the join into retained material, or explicitly choose **Manually trim the joining stock edges**. That option requires centering/marking the working area and manually trimming only the two facing stock edges before taping; the SVG never cuts those trim lines. Remaining stock stays for shielding. The bleach preview includes blocked bands when stock is untrimmed. No claim is made that a join across openings will be invisible.
- Read-only Mylar preview browses A/B; bleach preview clips each piece-specific bridge to its own stock bounds. Native connectivity has a 12-million-pixel working-area memory limit; vector export can still proceed with an explicit missing-connectivity warning, retaining vector island checks. The user stock extends beyond the working area, so working-area connectivity remains a conservative aid rather than a physical cut certification.
- Focused geometry/export/preview/bridge tests and browser review cover fitting, feasible limits, safe/unavoidable join bands, per-piece bridges, reconstructed overlap coverage, physical units/placement, legacy validation, persistence and A/B exports on Bonsai. Cricut import, working-area placement against real stock, tape positioning, seam visibility and test cuts remain unverified. No full suite was run.

## Project load/save and assignment performance — implemented

- Project save/load, import/export and migration encoding/validation use a reusable worker. JSON decoding restores binary arrays with an indexed loop; project format and original resolution are unchanged. Worker failures reject visibly, and retry replaces a failed worker. Existing autosave serialization and flush-before-switch behavior remain in place.
- Assignment updates paint once after clearing cleanup state, and cache the assigned-pixel count alongside brush eligibility. Incremental canvas tiles/selection caches remain deferred; large edits can still take visible time.
- Run `node stencil-app/server.mjs`. Project files default to `stencil-app/projects/`. An optional `STENCIL_PROJECTS_DIR` overrides the project folder for a separate instance.
- Focused project/worker/cleanup and disk/HTTP checks pass. Browser trial opened Bonsai, saved a zoom through the worker, verified unchanged source/segmentation/assignments/recipes on disk, and reopened. See `docs/STENCIL_PERFORMANCE_INVESTIGATION.md` for baseline measurements and remaining rendering limits.

## Explicit numbered color groups — fixes group-choice drift

- An explicit **Color group → Group N** choice stores `targetGroup: N-1`, meaning the final numbered palette slot. It is forced for every effective opaque pixel in that shape, regardless of original color. Multiple differently colored shapes can freely target the same slot; their source colors do not average into a reserved swatch. New separate group remains the optional source-derived preserved-group workflow.
- Root cause of the previous jump: displayed palette indices were translated to automatic fitting ranks (`paletteGroup`) or source-derived reserved IDs, then releasing a reservation changed the automatic fit count and brightness sorting renumbered the chosen group. Explicit choices now bypass that mapping. The only slot constraint is staying inside the requested total group count; referenced slots remain present even when a flat image supplies fewer distinct colors. Legacy memberships remain readable and convert to an explicit numbered slot when selected again.
- Three focused regression tests reproduce the old Group 3 → Group 2 jump, check fixed Group 3 and multiple dark/light shapes without source averaging, and check slot persistence/flat palettes/invalid-slot bounds. Browser verification assigned the red and blue sample rectangles to Group 3, confirmed both shape labels remain Group 3 after refitting, and saw the same quantized gray after Done. No unrelated test suites rerun.

## Preserve shapes — revised finish, group and history workflow

- **Preserve (P)** shows the original image for selection/editing. Main flow: **Auto select** or **Draw lasso** → choose **Color group** → **Done — show quantized**. **Adjust outline** contains the shape selector, tolerance, Reselect, Redraw and Delete. While editing, hide unrelated Mode / Group by controls so the group selector and Done stay visible; keep the total color-count slider available. Auto selection remains the default for an ordinary click on an unpreserved source area; clicking an existing shape edits it. Auto select explicitly arms a new pick inside existing shapes too.
- Done is available for an already committed auto/freehand shape. For a clicked-corner lasso it says **Finish shape & view quantized**, closes/commits a valid loop, then exits Preserve, removes the original-only override, switches to Pick and enables Show quantized. Enter does the same. Fewer than three corners or no opaque interior produces an explicit message instead of silently losing the draft. Cancel outline discards unfinished work. Opening Assign or enabling Show quantized also completes/exits Preserve when valid. Visibility toggles and tool changes must never leave a stale `.preserving` class hiding the quantized canvas.
- A shape's geometry and color-group membership are separate. **Color group** offers **New separate group** and existing automatic/preserved groups. Multiple disconnected or touching shapes can share one preserved group, or join an existing automatic group. Only distinct preserved groups reserve slots: four requested colors plus three shapes sharing one preserved group means one preserved group and three automatic groups. Source fitting can change fitted swatches, but explicit choices retain their final numbered palette slot. Changing a selected shape's group is immediately undoable. New shapes can choose their group before finishing or change it afterward.
- Shared preserved groups average their effective source pixels into one swatch. Automatic-target shapes take the chosen automatic slot's fitted swatch and do not reserve another slot. All manually included opaque pixels are forced into that membership, independent of source hue/brightness. Later shapes win overlaps. Prepare smoothing/cleanup/filtering respects protected source pixels, including shapes targeting automatic groups. Assigned treatment unions remain a later Assign decision; preservation does not automatically assign bleach treatments.
- Optional per-shape `targetGroup` identifies an explicitly chosen final numbered slot; `groupId` identifies a source-derived preserved group. Legacy `paletteGroup` identifies an automatic fitting rank and is no longer written for explicit dropdown choices. Missing fields retain each legacy shape's independent group. Optional `holes` and `autoSelect: {x,y,tolerance}` persist. `result.groupOptions` describes the current mapping to palette indices and `result.shapeGroups` maps each shape. At most 128 outlines, 10,000 vertices per shape, and eight total groups; keep at least one automatic slot and all referenced automatic slots. Slider minimum follows distinct group requirements, not outline count. Covered preserved groups retain their reservation until membership/deletion releases it.
- Use the existing main **Undo / Redo** buttons and Cmd/Ctrl Z for shape creation, edits, grouping, deletion and retracing, including after Done in the quantized view. No extra shape undo buttons. While assignments/history exist, the main controls route to assignment history and existing explicit assignment-reset protection prevents segmentation changes. Shape history starts fresh on project reopen. Bridge history remains separate as before; no other history system is expanded here.

## One-click source selection and editable contours

- A cancellable worker grows a four-connected region using OKLab distance to the fixed clicked original source color, default tolerance 12%, adjustable 0–40%. It uses original color even under grayscale quantization, before smoothing/quantization/cleanup. This follows connected source colors rather than recognizing multicolor objects semantically. Fixed-seed comparison prevents gradient drift; transparency is excluded.
- Reuse the existing boundary tracer at zero deviation, removing only collinear vertices. Preserve exact source-pixel silhouettes, including enclosed holes. Outlines over 10,000 total vertices report an error suggesting tolerance adjustment/manual lasso rather than dropping detail. Selection/reselection is atomic and cancellable; stale workers cannot overwrite another source or subsequent editing.
- Drag vertices to reshape, drag the body to move all contours, double-click an edge to insert a point, Alt-click a point to remove it (at least three per ring). Handle spacing follows zoom without changing stored geometry. **Reselect** deliberately replaces manual adjustments using the original source click/current tolerance, retaining shape identity and color membership. **Redraw** replaces the outline manually. Manual lasso retains drag-loop and click-corner creation using the original-resolution even/odd pixel-center fill. Original resolution, camera controls, holes and transparency remain intact.
- Verification for this revision is focused on changed behavior: three new shared-group tests cover shared slot budgets/many outlines, automatic targets/protected pixels, persistence/legacy identities and fully covered source fallback. Related previously run preserve/source/project checks passed before the user's request to avoid unnecessary testing; no unrelated/full-suite reruns. Browser verification covers clicked-corner completion, shared-group selection/save/reopen, joining an automatic group, quantized view restoration from Done and opening Assign, main undo/redo after Done, and the compact controls. Source auto selection, holes, editing and save/reopen were verified in the preceding implementation; real iPad/Pencil testing remains pending.

## Full Mylar shielding — latest direction

- User stock is 24 × 12 inches; user-supplied Cricut working limit is 29 × 59 cm. Use a fixed 590 × 290 mm working area (rotated for portrait artwork), center the original-aspect artwork, and keep its chosen physical scale. Leave the full stock intact; previews show the working area, not a trim instruction.
- Export **only opening contours**, including bridge subtraction. Never add an outer rectangular cut for sizing or registration. The sheet material rectangle exists only in previews and connectivity checks. This supersedes the earlier outer-frame export requirement.
- Replace the margin input with the stock/working-area explanation. Legacy `marginMm` remains in project files for compatibility but no longer sets sheet geometry. Independent horizontal/vertical padding drives previews and bridge bounds. Oversize artwork is called out and export is blocked without silently shrinking it.
- SVG viewBox/physical dimensions retain the common working area. Export review and SVG description include actual cut bounding dimensions and top-left placement offsets because an importer may crop empty space. Keep one common working-area origin across layers; do not center each layer's cut bounds independently. Design Space import/placement remains unverified.
- Focused export, sheet geometry and preview checks: 21 pass, including no outer contour, landscape/portrait bounds, oversized artwork, old padding independence and extended bridge anchoring. `image(1)` fits at its saved 21.5 × 6.87 inch artwork size. Browser verification opened its active Intensity 2 export, confirmed the larger retained area, dimensions/placement readout and enabled download link; Design Space import and physical cutting remain pending.

## Active-sheet SVG export — implemented, Cricut import validation pending

- **Stencil & bridges → Export active sheet SVG** builds a read-only review in a cancellable worker, then offers **Download SVG**. Select another active intensity to export its sheet. Export leaves assignments, bridges, smoothing, dimensions and project data unchanged.
- Uses the actual sheet membership union and saved smoothing. Convert quadratic curves to vector line segments with deviation at most 0.005 mm or 0.05 source pixels, whichever is smaller. Subtract enabled round-capped bridge polygons (same approximation tolerance), merging intersections. This never rasterizes/retraces the export geometry. Original-resolution raster analysis remains only a bridge-review aid.
- A single plain compound SVG path represents **openings only**. The outer sheet rectangle is never exported as a cut contour. A shared working-area viewBox plus explicit cut bounds/offsets supports manual placement across sheets. Coordinates/viewBox are in millimeters, with explicit mm width/height and a size-bearing filename. No masks, clipping paths, raster images, strokes or text cut objects are exported. Holes use even/odd fill with consistently oriented polygon rings.
- Export review reports disconnected retained pieces from the final vector geometry (including single-pixel specks that bridge navigation ignores), existing bridge problems/review flags, bridges under 2 mm, cut contours with bounding width/height under 1 mm, and unassigned pixels retained as material. These are review notes, not manufacturing certification or a complete minimum-feature-width check; narrow necks, touching-point connections and material strength still require inspection. Empty/fully bridged sheets and bridge endpoints outside the sheet cannot export.
- Export uses the locally vendored MIT polygon-clipping 0.15.7 bundle and included dependency licenses. No installation or runtime CDN access is required. Complex geometry errors are shown without downloading incomplete output; closing/reopening cancels pending workers and ignores stale results.
- Ten focused geometry tests cover physical dimensions, unchanged inputs, compound paths, overlapping/disabled/other-sheet bridges, nested holes/islands, direct overlap, transparency/unassigned pixels, cached curves, approximation bounds, fractional widths, scaling, empty/invalid sheets and deterministic irregular/diagonal coverage. Browser checks covered empty-sheet handling, successful worker completion, exact size display and an actual manually drawn bridge appearing in the final vector preview. The export uses a direct Blob download link, with its URL revoked on close/reset. The in-app browser download event timed out for both the initial scripted download and the direct link, so file delivery there is unverified. Normal-browser download, actual Cricut Design Space import and a physical test cut remain to validate. The full suite was not rerun.
- Next: verify a sheet in Design Space against its displayed dimensions and the user's Cricut/mat, then consider batch export. The user-supplied 29 × 59 cm limit is enforced. Tiling, registration marks and all-sheet export are not implemented.

## Mylar and finished bleach previews — implemented

- **Stencil & bridges → Preview sheets & bleach result** opens a separate read-only preview with **Mylar sheets** and **Bleached result** modes, pan, zoom and Fit. Returning to the editor leaves assignments, sheet configuration and bridges intact. Closing terminates pending preview work.
- Mylar mode shows uniform pale sheet material against a dark surface, with actual vector cutouts, enabled bridges in the same material, physical sheet margin and dimensions. A selector and previous/next buttons browse each sheet. No source image, treatment tint, island highlights or editing handles appear.
- Bleached result uses warm brown-to-cream tones on charcoal fabric with subtle weave. Each sheet's actual smoothed/overlapping opening is masked by its enabled bridges. The strongest visible pass wins in overlaps; this intentionally does not calculate cumulative exposure, chemistry, order, or real fabric color. Individual pass toggles are preview-only; all start visible regardless of editor layer visibility.
- A background worker builds the sheets using the same membership/smoothing geometry as bridging, reusing available path caches. SVG masks preserve vector detail and physical bridge widths. Preview controls are transient and do not modify project data. Cutter-ready export remains separate future work.
- Four focused tests cover overlap and enabled bridges, material/opening masks and physical widths, strongest-pass composition/visibility, and cached smoothing. Browser verification used a disposable copy of the current artwork for both renderings, sheet switching, pass visibility, zoom and return to editor.

## Separate stencil sheets and editable bridges — implemented

- One independent sheet per positive intensity; Unbleached has no cut sheet. By default only the active intensity is cut out. Per-sheet Layer overlap can include additional intensity regions (see below). Other assignments, unassigned pixels and transparent source areas are retained sheet material. Unassigned counts remain visible instead of silently assigning them.
- **Stencil & bridges → Finished size** controls the artwork's longest edge in inches (default 15; supports 10–20 and beyond) with locked image aspect ratio. Artwork is centered in the full 29 × 59 cm working area (rotated for portrait); both artwork and working-area dimensions are shown. The old configurable margin is superseded. Bridge widths are in millimeters, default 3 mm, and retain their physical width when artwork size changes.
- A worker derives the active cut path from the saved smoothing recipe, or exact pixel boundaries when none is saved. Curves are rasterized at original image resolution for four-connected retained-material analysis. Retained components touching the image boundary connect to the surrounding frame; other components are highlighted as islands. Connectivity checks are resolution-limited, not manufacturing certification.
- **Bridge (G)** plus **Add bridge** enters continuous drawing mode: each drag adds a retained-material strip across an opening as one undo step. **Stop drawing bridges**, Escape, selecting an existing bridge from the list, or switching tools exits drawing mode. Select a bridge and drag its endpoints or body; change width, disable/re-enable, delete, and use separate **Undo bridge / Redo bridge** controls (or Cmd/Ctrl Z in Bridge mode). A cancelled pointer gesture restores the prior bridge. Endpoint anchoring, crossing an opening and staying on the sheet are checked.
- **Reset bridges on this sheet** removes all active-sheet bridges (including disabled ones) as one undoable edit and cancels an in-flight automatic pass. Other sheets and width settings stay intact; assignments are unchanged.
- Assignment tools remain available throughout bridging. **Next island** focuses a remaining disconnected component, and **Assign island to active intensity** removes that unwanted retained detail as one ordinary assignment undo step. Assignment edits and changes to smoothing/size preserve bridges, invalidate analysis and mark affected geometry for review. Mark reviewed or editing a bridge clears its review flag, but geometric problems still appear.
- **Layers** supplies visibility controls for intensity treatments, Unbleached and unassigned hints, plus the source-image toggle, Solo active and Show all. Selecting an intensity activates its sheet. Other visible treatments appear faintly as context in the sheet preview; hiding the active intensity exits sheet preview. Visibility never changes ownership or the sheet's cut definition.
- The portable `stencilPlan` stores physical dimensions, active layer, visibility and editable per-layer bridges with review flags. Older projects default to a fresh plan. Restore regenerates geometry; worker results from stale edits are discarded. Bridge history starts fresh on reopen, independently of assignment history.
- Feature-focused checks cover retained islands, bridges, curved holes, physical scaling, bridge history and project round trips. Browser checks used an isolated ring fixture for add/move/resize/delete/undo, save/reopen and island reassignment with assignment undo. Automatic bridges are implemented below; cutter-ready SVG export remains deferred; previews are not exported as masking-based cut files.

## Selective sheet overlap — implemented

- **Stencil & bridges → Layer overlap** lets each sheet also cut any chosen positive intensity regions. This is independent overlap for simpler stencil geometry, not a calculated cumulative bleach/intensity workflow. Application order and bleach strengths remain the user's choice.
- Example: background sheet 1 can cut treatments 1+3 while highlight sheet 3 still cuts only treatment 3. Any subset/pair/group is supported. Inclusion is direct, not transitive: sheet 1 including treatment 2 never inherits sheet 2's inclusion choices. Unbleached/unassigned/transparent areas are not selectable overlap targets.
- Merge memberships before tracing the sheet boundary, then apply the saved smoothing recipe to the union. Internal cut seams disappear; island detection and automatic/manual bridging all use the combined opening geometry. Original assignments and original treatment preview paths remain intact. Geometry is cached by included set and invalidated on assignment/smoothing changes.
- Changing overlap flags only that sheet's existing bridges for review, keeps them editable, and cancels stale worker results. **Use only this intensity** returns the active sheet to separate mode. Active-sheet labels list added intensities; Solo active shows all included treatments. Visibility never changes sheet membership.
- Optional `stencilPlan.sheetIncludes` stores per-sheet membership in project saves/exports. Legacy projects remain separate by default. Focused tests cover geometry union, reduced islands, independent/non-transitive membership, smoothing/transparency, caching and persistence/validation. Browser verification covered a ring plus highlight, eliminating its island and switching back to an unchanged highlight sheet.

## Automatic bridges — implemented

- Single-pixel retained islands are ignored in highlights, navigation and automatic bridging. They are counted separately in status; assignments and cut geometry are unchanged.
- **Auto bridge** works on the active sheet and preserves existing bridges. It adds an editable batch as one bridge undo step, using separate configurable **Auto minimum / maximum width** limits (default **1.5–2 mm**). Limits persist per project; older projects receive these defaults. Existing bridges are preserved, and manual width editing stays independent. Generated bridges save through the existing project format.
- A multi-source raster wavefront finds nearby retained-component pairs, including the surrounding frame. Each candidate is a straight capsule; width is capped by the island's bounding short dimension and local thickness perpendicular to the bridge. Width is not arbitrarily reduced to lower the area score.
- Sort candidate connections by approximate strip area (length × width), then choose a minimum spanning forest and keep only networks reaching the frame. This is a practical nearby-candidate heuristic, not a global geometric optimum. Islands can support neighboring islands; extra reinforcement is left to manual editing.
- Four-connected capsule checks reject connections too thin to be represented reliably at native resolution. No suggestion is below the configured minimum or above the configured maximum. If local island thickness cannot accommodate the minimum, skip that connection rather than making an undersized bridge. Suggestions below 2 mm are called out for strength review; unconnected islands remain highlighted for manual work. Worker cancellation/generation guards prevent stale results from overwriting subsequent edits.
- Focused tests cover ignored specks, short ring bridges, width caps, island networks, preserving existing bridges, frame anchoring, batch undo, minimum/maximum enforcement and legacy plan validation. Browser check covers generation, ignored speck reporting and undo/editing.

## Vector boundary smoothing — implemented

- Refine now has collapsible **Clean up assignments** and **Smooth boundaries** sections. Build a preview using **Maximum deviation** (0–8 original-image pixels) and **Preserve sharp corners**. Zero traces the exact pixel geometry.
- Build a graph of pixel interfaces, trace shared chains between junctions, simplify within half the tolerance and round corners with quadratic curves using the remaining allowance. Adjacent treatments reuse exactly the same chains in reverse; holes use compound paths with even/odd fill. Strong corners and junctions are pinned. A spatial crossing check retries conflicting chains at half, quarter, eighth and sixteenth of the requested deviation before falling back to exact geometry. Every retry rechecks the whole boundary network; unrelated chains retain their requested smoothing. This is adaptive per-chain retry, not segment-local fallback.
- A worker builds real SVG treatment fills and shared outlines, aligned with the original-resolution image and camera. **Show vector preview** compares with pixel assignments; Hold to compare still shows the original. Starting a canvas edit returns to pixel view. Cleanup previews and vector previews do not overlap.
- **Keep smoothing** saves an optional `boundaryRefinement` recipe in the portable project. Reopening regenerates curves from the saved assignments, without altering the raster source, segmentation or assignment undo history. **Remove smoothing** clears this independent output operation. Assignment edits invalidate displayed geometry and prompt a rebuild; the saved recipe remains reusable.
- Six feature-focused tests cover simplification/corners, shared-boundary coverage, holes/disconnected pieces/transparency, zero tolerance, recipe persistence and adaptive 5 px retry on a narrow jagged strip while preserving an unrelated boundary. Browser verification covered build, save and restored SVG display; the full suite was not rerun.
- The preview reports how many boundaries needed reduced deviation and the smallest value used, separately from any boundaries that still required exact geometry. Rebuild existing previews to use the adaptive algorithm; saved recipes need no migration.
- This is image-coordinate vector refinement. Physical dimensions, separate-sheet composition and editable bridges are implemented above; minimum cut-width validation and production SVG export remain next steps. Crossing checks are not a substitute for later physical cut validation.

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

## Layers menu — implemented

- [x] Compact Layers island with treatment/source visibility, active intensity selection, Solo active and Show all; see the stencil-sheet section above.

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
