// Four-connected, seed-relative region growing. A fixed seed prevents a smooth
// gradient from chaining across its entire color range through tiny local steps.
export function detectRegions(data, width, height, options = {}) {
  const { mode = 'color', tolerance = 0.15, background = [255,255,255],
    backgroundMode = 'color', alphaCutoff = 0.1, minSize = 1 } = options;
  const size = width * height;
  const labels = new Int32Array(size).fill(-1);
  const queue = new Int32Array(size);
  const colors = new Float32Array(size * 4);
  const classes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const p = i * 4, a = data[p + 3] / 255;
    // Premultiplication makes invisible RGB irrelevant; alpha remains distinct.
    colors[p] = data[p] / 255 * a; colors[p+1] = data[p+1] / 255 * a;
    colors[p+2] = data[p+2] / 255 * a; colors[p+3] = a;
    const distance = Math.hypot((data[p]-background[0])*a,
      (data[p+1]-background[1])*a, (data[p+2]-background[2])*a) / (255*Math.sqrt(3));
    classes[i] = Number(a > alphaCutoff && (backgroundMode === 'alpha' || distance > tolerance));
  }
  const regions = [];
  let nextLabel = 0;
  for (let seed = 0; seed < size; seed++) {
    if (labels[seed] !== -1) continue;
    const rawId = nextLabel++, p = seed * 4;
    let head = 0, tail = 1, minX = width, maxX = 0, minY = height, maxY = 0;
    queue[0] = seed; labels[seed] = rawId;
    const visit = j => {
      if (labels[j] !== -1) return;
      let match;
      if (mode === 'silhouette') match = classes[j] === classes[seed];
      else {
        const q = j*4;
        match = Math.hypot(colors[q]-colors[p], colors[q+1]-colors[p+1],
          colors[q+2]-colors[p+2], colors[q+3]-colors[p+3]) / 2 <= tolerance;
      }
      if (match) { labels[j] = rawId; queue[tail++] = j; }
    };
    while (head < tail) {
      const i = queue[head++], x = i % width, y = Math.floor(i / width);
      minX = Math.min(minX,x); maxX = Math.max(maxX,x);
      minY = Math.min(minY,y); maxY = Math.max(maxY,y);
      if (x > 0) visit(i-1); if (x+1 < width) visit(i+1);
      if (y > 0) visit(i-width); if (y+1 < height) visit(i+width);
    }
    if (tail >= minSize) regions.push({rawId, area:tail, bounds:[minX,minY,maxX,maxY],
      kind: mode === 'silhouette' ? (classes[seed] ? 'Foreground' : 'Background') : 'Color area'});
  }
  regions.sort((a,b) => b.area-a.area);
  const remap = new Int32Array(nextLabel).fill(-1);
  regions.forEach((region,id) => { remap[region.rawId] = id; region.id = id; delete region.rawId; });
  let ignoredPixels = 0;
  for (let i=0;i<size;i++) { labels[i] = remap[labels[i]]; if(labels[i]<0) ignoredPixels++; }
  // Mark both sides of an interface so either neighboring region can highlight it.
  const edges = new Uint8Array(size);
  for (let i=0;i<size;i++) {
    if(labels[i]<0) continue;
    const x=i%width, y=Math.floor(i/width), id=labels[i];
    edges[i] = Number(x===0 || y===0 || x===width-1 || y===height-1 ||
      labels[i-1]!==id || labels[i+1]!==id || labels[i-width]!==id || labels[i+width]!==id);
  }
  return {labels, edges, regions, ignoredPixels};
}
