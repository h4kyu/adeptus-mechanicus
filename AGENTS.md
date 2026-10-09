# User communication preferences

- Keep responses concise and efficient. Avoid repetitive explanations and unnecessary detail.
- As work progresses, explain the code and algorithms being implemented in simple, beginner-friendly terms. The user is learning this topic; briefly explain what an algorithm does and why it is being used, with a small concrete example when helpful.
- Balance these preferences: teach in short, relevant explanations rather than long lectures.

# Persistent project direction

- Read `docs/STENCIL_EDITOR_PLAN.md` before planning or extending the stencil editor. It records the current agreed workflow, implemented foundation, deferred features, and iPad considerations.
- The main planned editing surface is a translucent segmentation overlay on the original image. Manual shape interpretation and assignment among actual quantization groups take priority over matching source hues. Explicit unbleached treatment is separate from the palette.
- Preserve original image resolution, work in small reviewable stages, and keep the UI organized. Do not treat proposed iPad/native options or deferred roadmap items as authorization to implement them all at once.

- The first UI revamp is implemented. Preserve the refined neutral design, contextual tools, original-resolution canvas, and translucent overlay. The latest user direction is a fixed no-scroll drawing-app viewport with floating tool/settings islands and free pan/pinch zoom, superseding the previous page-scrolling design. The local project library, autosave, and portable import/export are implemented and ready for user review. The Layers island now provides per-treatment visibility, active-sheet selection, Solo active and Show all; see the plan.

- Assign starts unassigned. Automatic quantization groups are palette/geometry suggestions, not manual assignments. The grouping brush skips already-assigned pixels. Latest user correction: lasso includes already-assigned pixels, including explicitly unbleached, for deliberate reassignment.

- Run the editor with `node stencil-app/server.mjs`. Project autosave writes git-ignored files in `stencil-app/projects/`; IndexedDB is only retained as a source for explicit migration. Do not silently fall back to browser-only saving.

- Prepare and Assign now share one main canvas, with compact expandable islands on the right. Original is the default view; Show quantized and Show boundaries are rendering toggles. N quantized colors offer Unbleached plus N-1 intensities (darkest slot is unbleached). The whole-region grouping brush (B) is implemented, skips already-assigned regions, and commits each stroke as one undo step. Pixel lasso (L) is implemented: drag a loop or click corners and finish with Enter, then choose a treatment. Pixel-level brush editing remains deferred.

- Assigned regions behave as treatment unions: clicking one highlights all regions with its treatment, same-treatment internal boundaries disappear, and explicit reassignment/clear applies to the whole selected treatment. Keep original segmentation for undo; unassigned regions remain separate.

- Pixel lasso edits use per-pixel exceptions over original region assignments, persisted in project files and sharing undo history with region edits. Treatment unions and display boundaries use effective pixel assignments. Double-click isolates an original region for explicit reassignment.

- Refine includes post-assignment cleanup with threshold, unassigned-only/all-patches scopes, worker preview and atomic undoable Apply. It uses effective pixel treatments, preserves transparency, and merges only into assigned neighbors. Boundary smoothing and editable per-sheet bridging are implemented.
- Keep verification focused on newly changed features; the user explicitly wants to avoid unnecessary full-suite testing and usage.

- Refine → Smooth boundaries traces shared SVG curves with a source-pixel deviation limit and corner preservation. Keep smoothing saves a separate `boundaryRefinement` recipe; assignments stay unchanged. Reopen regenerates vectors, edits invalidate the preview, and Remove smoothing clears the recipe. Physical dimensions and per-sheet bridging are implemented; cutter-ready export remains future work.

- Each positive intensity has its own stencil sheet. Stencil & bridges controls an aspect-locked artwork long edge in inches (default 15), sheet margin and bridge widths in mm. Bridge (G) adds and edits per-layer retained strips; moving endpoints/body, width, enable/delete and separate bridge undo are supported. Assignment stays editable; unwanted islands can be assigned to the active intensity. Preserve bridges on assignment edits and flag them for review. Store all sheet/bridge state in `stencilPlan`; native-resolution connectivity analysis is not a production-cut validation.

- Auto bridge adds editable per-sheet bridge batches as one undo step, preserving existing bridges. It favors short low-area connections, caps width to local island thickness, and enforces configurable auto width limits (default 1.5–2 mm; skip connections too thin for the minimum); extra reinforcement stays manual. Single-pixel islands are ignored in bridge analysis/navigation without changing assignments. See the plan for algorithm limits.

- Selective overlap is configured per sheet in Layer overlap (`stencilPlan.sheetIncludes`). Each sheet can additionally cut any chosen positive treatments without changing their assignments or own sheets. Membership is direct/non-transitive; this simplifies bridging and is not a calculated bleach-buildup model. Trace/smooth the union, then analyze islands and bridges. Changes preserve and flag that sheet’s bridges for review.

- Read-only Mylar/bleach previews are available in Stencil & bridges. They use actual smoothed sheet unions and enabled bridge masks, with physical dimensions, sheet browsing, pass visibility and pan/zoom. The stylized bleach preview uses the strongest visible pass in overlaps, not additive-dose simulation. Preview state is transient; production export remains deferred.
