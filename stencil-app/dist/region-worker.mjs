import { detectRegions } from './regions.mjs';
self.onmessage = ({data: {revision, pixels, width, height, options}}) => {
  try {
    const result = detectRegions(pixels, width, height, options);
    self.postMessage({revision, ...result}, [result.labels.buffer, result.edges.buffer]);
  } catch (error) { self.postMessage({revision, error: error.message}); }
};
