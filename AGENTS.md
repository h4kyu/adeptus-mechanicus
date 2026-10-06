# User communication preferences

- Keep responses concise and efficient. Avoid repetitive explanations and unnecessary detail.
- As work progresses, explain the code and algorithms being implemented in simple, beginner-friendly terms. The user is learning this topic; briefly explain what an algorithm does and why it is being used, with a small concrete example when helpful.
- Balance these preferences: teach in short, relevant explanations rather than long lectures.

# Persistent project direction

- Read `docs/STENCIL_EDITOR_PLAN.md` before planning or extending the stencil editor. It records the current agreed workflow, implemented foundation, deferred features, and iPad considerations.
- The main planned editing surface is a translucent segmentation overlay on the original image. Manual shape interpretation and assignment among actual quantization groups take priority over matching source hues. Explicit unbleached treatment is separate from the palette.
- Preserve original image resolution, work in small reviewable stages, and keep the UI organized. Do not treat proposed iPad/native options or deferred roadmap items as authorization to implement them all at once.

- The first UI revamp is implemented. Preserve the refined neutral design, contextual tools, original-resolution canvas, and translucent overlay. The latest user direction is a fixed no-scroll drawing-app viewport with floating tool/settings islands and free pan/pinch zoom, superseding the previous page-scrolling design. The local project library, autosave, and portable import/export are implemented and ready for user review. A layers menu with toggleable visibility is recorded as a TODO; see the plan.

- Assign starts unassigned. Automatic quantization groups are palette/geometry suggestions, not manual assignments. Future lasso/brush selections must skip already-assigned (including explicitly unbleached) pixels unless reassignment is explicitly requested.

- Run the editor with `node stencil-app/server.mjs`. Project autosave writes git-ignored files in `stencil-app/projects/`; IndexedDB is only retained as a source for explicit migration. Do not silently fall back to browser-only saving.
