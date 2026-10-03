// Group connected regions without joining their geometry or changing labels.
export function groupLayers(palette, regions) {
  const layers = palette.map((color, id) => ({id, color, regionIds: [], area: 0}));
  for (const region of regions) {
    const layer = layers[region.paletteIndex];
    if (!layer) continue; // Transparent regions have no color layer.
    layer.regionIds.push(region.id);
    layer.area += region.area;
  }
  return layers;
}
