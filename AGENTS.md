# User communication preferences

- Keep responses concise and efficient. Avoid repetitive explanations and unnecessary detail.
- As work progresses, explain the code and algorithms being implemented in simple, beginner-friendly terms. The user is learning this topic; briefly explain what an algorithm does and why it is being used, with a small concrete example when helpful.
- Balance these preferences: teach in short, relevant explanations rather than long lectures.

# Persistent project direction

- Read `docs/STENCIL_EDITOR_PLAN.md` before planning or extending the stencil editor. It records the current agreed workflow, implemented foundation, deferred features, and iPad considerations.
- The main planned editing surface is a translucent segmentation overlay on the original image. Manual shape interpretation and assignment among actual quantization groups take priority over matching source hues. Explicit unbleached treatment is separate from the palette.
- Preserve original image resolution, work in small reviewable stages, and keep the UI organized. Do not treat proposed iPad/native options or deferred roadmap items as authorization to implement them all at once.

- The first UI revamp is implemented. Preserve the refined neutral design, contextual tools, original-resolution canvas, and translucent overlay. The latest user direction is a fixed no-scroll drawing-app viewport with floating tool/settings islands and free pan/pinch zoom, superseding the previous page-scrolling design. The local project library, autosave, and portable import/export are implemented and ready for user review. A layers menu with toggleable visibility is recorded as a TODO; see the plan.

- Assign starts unassigned. Automatic quantization groups are palette/geometry suggestions, not manual assignments. The grouping brush skips already-assigned pixels. Latest user correction: lasso includes already-assigned pixels, including explicitly unbleached, for deliberate reassignment.

- Run the editor with `node stencil-app/server.mjs`. Project autosave writes git-ignored files in `stencil-app/projects/`; IndexedDB is only retained as a source for explicit migration. Do not silently fall back to browser-only saving.

- Prepare and Assign now share one main canvas, with compact expandable islands on the right. Original is the default view; Show quantized and Show boundaries are rendering toggles. N quantized colors offer Unbleached plus N-1 intensities (darkest slot is unbleached). The whole-region grouping brush (B) is implemented, skips already-assigned regions, and commits each stroke as one undo step. Pixel lasso (L) is implemented: drag a loop or click corners and finish with Enter, then choose a treatment. Pixel-level brush editing remains deferred.

- Assigned regions behave as treatment unions: clicking one highlights all regions with its treatment, same-treatment internal boundaries disappear, and explicit reassignment/clear applies to the whole selected treatment. Keep original segmentation for undo; unassigned regions remain separate.

- Pixel lasso edits use per-pixel exceptions over original region assignments, persisted in project files and sharing undo history with region edits. Treatment unions and display boundaries use effective pixel assignments. Double-click isolates an original region for explicit reassignment.

- Refine includes post-assignment cleanup with threshold, unassigned-only/all-patches scopes, worker preview and atomic undoable Apply. It uses effective pixel treatments, preserves transparency, and merges only into assigned neighbors. Next planned work is boundary smoothing followed by per-sheet bridging; these are not implemented yet.
- Keep verification focused on newly changed features; the user explicitly wants to avoid unnecessary full-suite testing and usage.
