import { detectRegions } from './regions.mjs';
import { quantize } from './quantize.mjs';
self.onmessage = ({data: {revision, pixels, width, height, options}}) => {
  try {
    const quantized = options.mode === 'quantized' ? quantize(pixels, options.colorCount) : null;
    const result = detectRegions(pixels, width, height, {...options, colorLabels:quantized?.labels});
    const transfers = [result.labels.buffer, result.edges.buffer];
    if(quantized) transfers.push(quantized.labels.buffer);
    self.postMessage({revision, ...result, palette:quantized?.palette, colorLabels:quantized?.labels}, transfers);
  } catch (error) { self.postMessage({revision, error: error.message}); }
};
