import { mergeSmallRegions } from './cleanup.mjs';
import { detectRegions } from './regions.mjs';
import { bilateral } from './smooth.mjs';
import { grayscale } from './grayscale.mjs';
import { quantize } from './quantize.mjs?v=compact-4';
self.onmessage = ({data: {revision, pixels, width, height, options}}) => {
  try {
    const prepared=options.mode==='quantized' && options.colorSpace==='grayscale' ? grayscale(pixels) : pixels;
    const smoothed = options.mode === 'quantized' && options.smoothing ? bilateral(prepared,width,height,{radius:options.smoothRadius,strength:options.smoothStrength}) : null;
    const input = smoothed || prepared;
    const quantized = options.mode === 'quantized' ? quantize(input, options.colorCount) : null;
    const cleanup=quantized && options.cleanup ? mergeSmallRegions(input,width,height,quantized.labels,options.cleanupSize) : null;
    const finalColors=cleanup?.labels || quantized?.labels;
    const result = detectRegions(input, width, height, {...options, colorLabels:finalColors});
    // Compare two complete pipelines with identical settings, not the same
    // boundaries drawn over different source images.
    let baseline = null;
    if(cleanup) {
      baseline={...detectRegions(input,width,height,{...options,colorLabels:quantized.labels}),palette:quantized.palette,colorLabels:quantized.labels};
    } else if(smoothed) {
      const originalColors=quantize(prepared,options.colorCount);
      baseline={...detectRegions(prepared,width,height,{...options,colorLabels:originalColors.labels}),
        palette:originalColors.palette,colorLabels:originalColors.labels};
    }
    const transfers = [result.labels.buffer, result.edges.buffer];
    if(baseline) transfers.push(baseline.labels.buffer,baseline.edges.buffer,baseline.colorLabels.buffer);
    if(prepared!==pixels)transfers.push(prepared.buffer);
    if(smoothed) transfers.push(smoothed.buffer);
    if(finalColors) transfers.push(finalColors.buffer);
    self.postMessage({revision, ...result, baseline, comparison:cleanup?'cleanup':'smoothing', cleanup:cleanup?{merges:cleanup.merges,changedPixels:cleanup.changedPixels}:null, smoothed, prepared:prepared!==pixels?prepared:null, palette:quantized?.palette, colorLabels:finalColors}, transfers);
  } catch (error) { self.postMessage({revision, error: error.message}); }
};
