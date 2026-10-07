import test from 'node:test';
import assert from 'node:assert/strict';
import {lassoMask} from '../dist/lasso.mjs';
import {createPixelAssignments,INHERIT} from '../dist/pixel-assignments.mjs';
const point=(x,y)=>({x,y}),rectangle=(x,y,w,h)=>[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];
const pixels=n=>new Uint8ClampedArray(n*4).fill(255);
const fixture=()=>createPixelAssignments([0,1],3,Int32Array.from([0,0,0,1,1,1,-1,-1]),pixels(8));
const effective=m=>Array.from(m.overrides,(_,i)=>m.at(i));
const mask=(...indices)=>Uint8Array.from({length:8},(_,i)=>+indices.includes(i));
test('lasso fills pixel centers at original resolution and clips to the image',()=>{
 assert.deepEqual([...lassoMask(rectangle(1,1,2,2),4,3)],[0,0,0,0,0,1,1,0,0,1,1,0]);
 assert.deepEqual([...lassoMask(rectangle(-3,-3,5,5),3,3)],[1,1,0,1,1,0,0,0,0]);
 assert.equal(lassoMask(rectangle(0,0,3,3),3,3,i=>i!==4).reduce((a,b)=>a+b),8);
});
test('concave paths, reversed paths, self-crossing loops and degenerate paths have deterministic fills',()=>{
 const points=[point(0,0),point(3,0),point(3,1),point(1,1),point(1,3),point(0,3)];
 assert.deepEqual([...lassoMask(points,3,3)],[1,1,1,1,0,0,1,0,0]);
 assert.deepEqual(lassoMask(points,3,3),lassoMask(points.toReversed(),3,3));
 assert.deepEqual([...lassoMask([point(0,0),point(3,3),point(0,3),point(3,0)],3,3)],[1,1,0,0,0,0,1,1,0]);
 assert.equal(lassoMask([point(0,0),point(3,3)],3,3).some(Boolean),false);
});
test('lasso reassigns assigned and unbleached pixels, includes filtered pixels, and undoes in one step',()=>{
 const m=fixture();m.setMany([0],1);m.setMany([1],-2);const before=effective(m);
 assert.equal(m.assignMask(mask(1,4,6),2),true);
 assert.deepEqual(effective(m),[1,2,1,-2,2,-2,2,-1]);
 assert.deepEqual([...m.values],[1,-2]);
 m.undo();assert.deepEqual(effective(m),before);m.redo();assert.equal(m.at(4),2);
 m.undo();m.undo();assert.deepEqual(effective(m),[1,1,1,-1,-1,-1,-1,-1]);
});
test('whole-region brush fills remaining pixels and preserves pixel assignments',()=>{
 const m=fixture();m.assignMask(mask(1,4),-2);m.brush([0,1],1);
 assert.deepEqual(effective(m),[1,-2,1,1,-2,1,-1,-1]);
 m.undo();assert.deepEqual(effective(m),[-1,-2,-1,-1,-2,-1,-1,-1]);
});
test('treatment unions include pixel exceptions and filtered pixels; individual edit touches only its region',()=>{
 const m=fixture();m.setMany([0],1);m.assignMask(mask(1),2);m.assignMask(mask(4,6),1);
 m.setTreatment(1,-2);assert.deepEqual(effective(m),[-2,2,-2,-1,-2,-1,-2,-1]);
 m.setMany([0],2);assert.deepEqual(effective(m),[2,2,2,-1,-2,-1,-2,-1]);
 m.undo();assert.deepEqual(effective(m),[-2,2,-2,-1,-2,-1,-2,-1]);
 m.setTreatment(-2,-1);assert.deepEqual(effective(m),[-1,2,-1,-1,-1,-1,-1,-1]);
 m.undo();assert.equal(m.at(6),-2);
});
test('clearing a lasso creates unassigned holes, brush can refill them, and no-op edits add no history',()=>{
 const m=fixture();m.setMany([0],1);m.assignMask(mask(1),-1);assert.equal(m.at(1),-1);
 m.brush([0],2);assert.deepEqual(effective(m).slice(0,3),[1,2,1]);
 m.undo();assert.equal(m.at(1),-1);m.redo();
 assert.equal(m.assignMask(mask(1),2),false);m.undo();assert.equal(m.at(1),-1);
});
test('transparent source stays untouched and pixel maps restore without old undo history',()=>{
 const source=pixels(2);source[7]=0;
 const m=createPixelAssignments([0],2,Int32Array.from([0,-1]),source);m.assignMask(new Uint8Array([1,1]),1);
 assert.deepEqual([...m.overrides],[1,INHERIT]);
 const restored=createPixelAssignments([0],2,Int32Array.from([0,-1]),source);restored.values.set(m.values);restored.overrides.set(m.overrides);
 assert.equal(restored.at(0),1);assert.equal(restored.edited,true);assert.equal(restored.canUndo,false);
});
