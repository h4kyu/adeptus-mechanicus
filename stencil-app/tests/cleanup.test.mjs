import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSmallRegions} from '../dist/cleanup.mjs';
import {detectRegions} from '../dist/regions.mjs';
function run(values,width,minimum) {
 const labels=Int16Array.from(values),pixels=new Uint8ClampedArray(values.length*4).fill(255);
 return mergeSmallRegions(pixels,width,values.length/width,labels,minimum);
}
test('merges interior speck into surrounding region without changing input',()=>{
 const values=[0,0,0,0,1,0,0,0,0];
 assert.deepEqual([...run(values,3,2).labels],Array(9).fill(0));
 assert.equal(values[4],1);assert.equal(run(values,3,2).changedPixels,1);
});
test('longest shared border wins over neighbor size',()=>{
 const values=[0,1,1,0,0, 1,1,2,0,0, 1,1,1,0,0, 0,0,0,0,0];
 assert.equal(run(values,5,2).labels[7],1);
});
test('joining equal-colored neighbors updates sizes before subsequent merges',()=>{
 const values=[0,0,1,0,0];
 const out=run(values,5,3);
 assert.deepEqual([...out.labels],[0,0,0,0,0]);assert.equal(out.changedPixels,1);
});
test('transparent gaps and isolated pieces remain intact; diagonals do not count',()=>{
 const values=[0,-1,-1,1];
 assert.deepEqual([...run(values,2,10).labels],values);
 assert.deepEqual([...run([-1,0,-1],3,10).labels],[-1,0,-1]);
});
test('threshold is exclusive and ties produce reproducible output',()=>{
 assert.deepEqual([...run([0,0,1,1],4,2).labels],[0,0,1,1]);
 const values=[0,0,1,2,2];
 assert.deepEqual(run(values,5,2),run(values,5,2));
 assert.deepEqual([...run(values,5,1).labels],values);
});
test('a textured fixture collapses fragments into a complete, gap-free labeling',()=>{
 const values=Array.from({length:1600},(_,i)=>(i%40<20?0:1)+(i%37===0?2:0));
 const out=run(values,40,3);
 const detected=detectRegions(new Uint8ClampedArray(6400).fill(255),40,40,{mode:'quantized',colorLabels:out.labels,minSize:1});
 assert.equal(detected.regions.length,2);assert.equal(detected.ignoredPixels,0);
 assert.deepEqual(run(values,40,3),out);
});
