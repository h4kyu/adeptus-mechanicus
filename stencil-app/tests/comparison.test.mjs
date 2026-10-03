import test from 'node:test';
import assert from 'node:assert/strict';
import {grayscale} from '../dist/grayscale.mjs';
import {bilateral} from '../dist/smooth.mjs';
import {quantize} from '../dist/quantize.mjs';
import {detectRegions} from '../dist/regions.mjs';
test('worker returns independently computed original boundaries for smoothing comparison',async()=>{
 let message;globalThis.self={postMessage:value=>{message=value;}};
 try {
  await import('../dist/region-worker.mjs');
  const width=12,height=12,pixels=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++){const v=i%2?135:120;pixels.set([v,v,v,255],i*4);}
  const options={mode:'quantized',colorCount:2,smoothing:true,smoothRadius:2,smoothStrength:.1,minSize:1};
  self.onmessage({data:{revision:7,pixels,width,height,options}});
  assert.equal(message.error,undefined);assert.equal(message.revision,7);
  const q=quantize(pixels,2), original=detectRegions(pixels,width,height,{...options,colorLabels:q.labels});
  assert.deepEqual(message.baseline.labels,original.labels);assert.deepEqual(message.baseline.edges,original.edges);
  const filtered=quantize(message.smoothed,2), after=detectRegions(message.smoothed,width,height,{...options,colorLabels:filtered.labels});
  assert.deepEqual(message.labels,after.labels);assert.deepEqual(message.edges,after.edges);
  assert.notDeepEqual(message.smoothed,pixels);
  for(let i=0;i<pixels.length;i+=4)pixels.set([i%256,90,180,255],i);
  options.colorSpace='grayscale';
  self.onmessage({data:{revision:8,pixels,width,height,options}});
  assert.equal(message.error,undefined);
  const gray=grayscale(pixels),grayQ=quantize(gray,2);
  assert.deepEqual(message.prepared,gray);
  assert.deepEqual(message.baseline.colorLabels,grayQ.labels);
  assert.deepEqual(message.smoothed,bilateral(gray,width,height,{radius:2,strength:.1}));
 } finally {delete globalThis.self;}
});
