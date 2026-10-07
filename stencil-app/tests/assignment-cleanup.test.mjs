import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanupAssignments} from '../dist/assignment-cleanup.mjs';
import {createPixelAssignments} from '../dist/pixel-assignments.mjs';
const run=(values,width,minimum=2,scope='unassigned',alpha=new Uint8Array(values.length).fill(255))=>cleanupAssignments(Int16Array.from(values),alpha,width,values.length/width,minimum,scope);
test('fills missed unassigned holes, protects assigned details by default, and includes them in all scope',()=>{
 const values=[1,1,1,1,-1,1,1,1,1];const out=run(values,3);
 assert.deepEqual([...out.labels],Array(9).fill(1));assert.equal(out.changedPixels,1);assert.equal(out.changedPatches,1);assert.equal(values[4],-1);
 values[4]=-2;assert.equal(run(values,3).changedPixels,0);assert.equal(run(values,3,2,'all').labels[4],1);
});
test('uses total shared border per treatment and merges same-treatment pieces before reassessing area',()=>{
 // Three edges of treatment 2, one edge of treatment 1.
 assert.equal(run([1,2,2,2,-1,1,2,2,1],3).labels[4],2);
 assert.deepEqual([...run([1,1,2,1,1],5,3,'all').labels],[1,1,1,1,1]);
 // Disconnected treatment-2 neighbors together beat the single treatment-1 neighbor.
 assert.equal(run([2,-1,2],3).labels[1],2);
});
test('threshold is exclusive; transparent gaps and unassigned neighbors cannot absorb assignments',()=>{
 assert.deepEqual([...run([1,1,2,2],4,2,'all').labels],[1,1,2,2]);
 assert.deepEqual([...run([1,-1,-1,-2],2,10,'all',new Uint8Array([255,0,0,255])).labels],[1,-1,-1,-2]);
 const out=run([-1,-1,1,-1,-1],5,2,'all');assert.equal(out.changedPixels,0);assert.equal(out.remainingPatches,1);
});
test('cleanup reads pixel edits, previews without mutation, and applies multiple treatments as one undo step',()=>{
 const source=new Uint8ClampedArray(7*4).fill(255),regions=Int32Array.from([0,0,0,1,1,1,1]);
 const m=createPixelAssignments([0,1],3,regions,source);m.setMany([0],1);m.setMany([1],2);
 m.assignMask(new Uint8Array([0,1,0,0,0,1,0]),-1);
 const before=Int16Array.from(regions,(_,i)=>m.at(i)),preview=run(before,7);
 assert.deepEqual(Int16Array.from(regions,(_,i)=>m.at(i)),before);
 assert.equal(preview.changedPixels,2);assert.equal(m.assignPixels(preview.labels),true);
 assert.deepEqual(Array.from(regions,(_,i)=>m.at(i)),[1,1,1,2,2,2,2]);
 m.undo();assert.deepEqual(Int16Array.from(regions,(_,i)=>m.at(i)),before);
 m.redo();assert.equal(m.at(1),1);assert.equal(m.at(5),2);assert.equal(m.assignPixels(preview.labels),false);
});
