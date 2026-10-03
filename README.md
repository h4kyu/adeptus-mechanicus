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
