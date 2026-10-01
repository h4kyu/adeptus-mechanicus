# Stencil region inspector

Current stage: inspect bounded color areas and silhouettes on the original colored image. No grayscale conversion, intensity controls, bridges or SVG export in the current UI.

## Run

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory stencil-app/dist
node --test stencil-app/tests/*.test.mjs
```

Open http://127.0.0.1:8765. Processing stays in the browser. PNG/JPEG/WebP files up to 25 MB are accepted and reduced to a longest dimension of 1000 pixels for inspection. Area sizes are measured at that working resolution.

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
