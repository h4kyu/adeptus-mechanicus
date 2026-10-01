// A shared foreground mask, independent of tonal thresholds and inversion.
export function silhouette(data, width, height, {
  mode = 'color', background = [255, 255, 255], tolerance = 0.12,
  alphaCutoff = 0.1, keepHoles = true,
} = {}) {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    const alpha = data[p + 3] / 255;
    if (alpha <= alphaCutoff) continue;
    // Composite soft edges over the selected background before comparing.
    const distance = Math.hypot(
      (data[p] - background[0]) * alpha,
      (data[p + 1] - background[1]) * alpha,
      (data[p + 2] - background[2]) * alpha,
    ) / (255 * Math.sqrt(3));
    mask[i] = Number(mode === 'alpha' || distance > tolerance);
  }
  if (keepHoles) return mask;
  // Fill only background components disconnected from the image border.
  const outside = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0, tail = 0;
  const visit = i => {
    if (!mask[i] && !outside[i]) { outside[i] = 1; queue[tail++] = i; }
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (x > 0) visit(i - 1);
    if (x + 1 < width) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i + width < mask.length) visit(i + width);
  }
  for (let i = 0; i < mask.length; i++) mask[i] = Number(!outside[i]);
  return mask;
}

export function silhouetteLevels(data, mask, thresholds, invert, solid = false) {
  const levels = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4;
    const gray = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
    const intensity = invert ? 1 - gray : gray;
    // Every foreground pixel belongs to at least band 1. Thresholds can
    // repartition the interior but never erase or expand the silhouette.
    levels[i] = solid ? 1 : 1 + thresholds.reduce((n, t) => n + Number(intensity >= t), 0);
  }
  return levels;
}
