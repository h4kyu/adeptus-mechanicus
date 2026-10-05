# User communication preferences

- Keep responses concise and efficient. Avoid repetitive explanations and unnecessary detail.
- As work progresses, explain the code and algorithms being implemented in simple, beginner-friendly terms. The user is learning this topic; briefly explain what an algorithm does and why it is being used, with a small concrete example when helpful.
- Balance these preferences: teach in short, relevant explanations rather than long lectures.

# Persistent project direction

- Read `docs/STENCIL_EDITOR_PLAN.md` before planning or extending the stencil editor. It records the current agreed workflow, implemented foundation, deferred features, and iPad considerations.
- The main planned editing surface is a translucent segmentation overlay on the original image. Manual shape interpretation and assignment among actual quantization groups take priority over matching source hues. Explicit unbleached treatment is separate from the palette.
- Preserve original image resolution, work in small reviewable stages, and keep the UI organized. Do not treat proposed iPad/native options or deferred roadmap items as authorization to implement them all at once.

- The first UI revamp is implemented. Preserve the refined neutral design, contextual tools, original-resolution canvas, and translucent overlay. The latest user direction is a fixed no-scroll drawing-app viewport with floating tool/settings islands and free pan/pinch zoom, superseding the previous page-scrolling design. Project save/load is next after user review; see the plan.
