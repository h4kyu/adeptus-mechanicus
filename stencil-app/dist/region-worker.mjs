import { mergeSmallRegions } from './cleanup.mjs';
import { detectRegions } from './regions.mjs';
import { bilateral } from './smooth.mjs';
import { grayscale } from './grayscale.mjs';
import {quantizeShapes} from './preserved-shapes.mjs';
self.onmessage = ({data: {revision, pixels, width, height, options}}) => {
  try {
    const prepared=options.mode==='quantized' && options.colorSpace==='grayscale' ? grayscale(pixels) : pixels;
    const smoothed = options.mode === 'quantized' && options.smoothing ? bilateral(prepared,width,height,{radius:options.smoothRadius,strength:options.smoothStrength}) : null;
    const input = smoothed || prepared;
    const fit=p=>quantizeShapes(p,options.colorCount,options.preservedShapes,width,height,prepared);
    const quantized = options.mode === 'quantized' ? fit(input) : null;
    const protectedGroups=new Set(quantized?.preservedGroups||[]);
    const protectedPixels=quantized?.protectedPixels;
    const detectionOptions={...options,protectedGroups,protectedPixels};
    const cleanup=quantized && options.cleanup ? mergeSmallRegions(input,width,height,quantized.labels,options.cleanupSize,protectedGroups,protectedPixels) : null;
    const finalColors=cleanup?.labels || quantized?.labels;
    const result = detectRegions(input, width, height, {...detectionOptions, colorLabels:finalColors});
    // Compare two complete pipelines with identical settings, not the same
    // boundaries drawn over different source images.
    let baseline = null;
    if(cleanup) {
      baseline={...detectRegions(input,width,height,{...detectionOptions,colorLabels:quantized.labels}),palette:quantized.palette,colorLabels:quantized.labels};
    } else if(smoothed) {
      const originalColors=fit(prepared);
      baseline={...detectRegions(prepared,width,height,{...options,protectedGroups:new Set(originalColors.preservedGroups||[]),protectedPixels:originalColors.protectedPixels,colorLabels:originalColors.labels}),
        palette:originalColors.palette,colorLabels:originalColors.labels};
    }
    const transfers = [result.labels.buffer, result.edges.buffer];
    if(baseline) transfers.push(baseline.labels.buffer,baseline.edges.buffer,baseline.colorLabels.buffer);
    if(prepared!==pixels)transfers.push(prepared.buffer);
    if(smoothed) transfers.push(smoothed.buffer);
    if(finalColors) transfers.push(finalColors.buffer);
    self.postMessage({revision, ...result, baseline, comparison:cleanup?'cleanup':'smoothing', cleanup:cleanup?{merges:cleanup.merges,changedPixels:cleanup.changedPixels}:null, smoothed, prepared:prepared!==pixels?prepared:null, palette:quantized?.palette, shapeGroups:quantized?.shapeGroups,groupOptions:quantized?.groupOptions, colorLabels:finalColors}, transfers);
  } catch (error) { self.postMessage({revision, error: error.message}); }
};
