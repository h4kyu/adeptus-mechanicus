// Intensity 0 is untouched fabric; 1..N are separate exposure regions.
export function classify(r, g, b, alpha, thresholds, invert = true) {
  const opacity = alpha / 255;
  const gray = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // Transparent pixels always represent no exposure, even when inverted.
  const exposure = (invert ? 1 - gray : gray) * opacity;
  return thresholds.reduce((level, threshold) => level + Number(exposure >= threshold), 0);
}

export function separate(data, thresholds, invert) {
  const levels = new Uint8Array(data.length / 4);
  for (let i = 0; i < levels.length; i++) {
    const p = i * 4;
    levels[i] = classify(data[p], data[p + 1], data[p + 2], data[p + 3], thresholds, invert);
  }
  return levels;
}
