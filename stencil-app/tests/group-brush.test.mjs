import test from 'node:test';
import assert from 'node:assert/strict';
import {collectBrushRegions} from '../dist/group-brush.mjs';
import {createAssignments,UNASSIGNED,UNBLEACHED} from '../dist/assignments.mjs';
const sweep=(labels,width,height,from,to,radius,eligible=()=>true)=>collectBrushRegions({labels:Int32Array.from(labels),width,height,from,to,radius,eligible});
test('fast strokes collect thin intervening regions and merge repeated hits',()=>{
 const hits=sweep([0,0,1,2,2],5,1,{x:.5,y:.5},{x:4.5,y:.5},.5);assert.deepEqual([...hits],[0,1,2]);
});
test('circular footprint excludes corners; clipped off-image strokes are safe',()=>{
 const labels=[0,1,2,3,4,5,6,7,8];assert.deepEqual([...sweep(labels,3,3,{x:1.5,y:1.5},{x:1.5,y:1.5},1)],[1,3,4,5,7]);
 assert.deepEqual([...sweep(labels,3,3,{x:-5,y:.5},{x:5,y:.5},.4)],[0,1,2]);
 assert.equal(sweep(labels,3,3,{x:-5,y:-5},{x:-4,y:-4},.5).size,0);
});
test('brush skips filtered pixels, unbleached, and assigned regions; a stroke is one undo',()=>{
 const m=createAssignments([0,1,2,2,-1],3);m.set(0,UNBLEACHED);m.set(1,2);
 const hits=sweep([0,1,2,-1,3,4],6,1,{x:.5,y:.5},{x:5.5,y:.5},.5,id=>m.automatic[id]>=0&&m.values[id]===UNASSIGNED);
 assert.deepEqual([...hits],[2,3]);assert.ok(m.brush(hits,1));assert.deepEqual([...m.values],[-2,2,1,1,-1]);
 m.undo();assert.deepEqual([...m.values],[-2,2,-1,-1,-1]);m.redo();assert.deepEqual([...m.values],[-2,2,1,1,-1]);
 assert.equal(m.brush([0,1,2,3,4],UNBLEACHED),false);
});
test('eligibility is rechecked at commit and a no-op stroke adds no undo entry',()=>{
 const m=createAssignments([0,1],2);m.set(0,1);assert.equal(m.brush([0],UNBLEACHED),false);m.undo();assert.deepEqual([...m.values],[-1,-1]);
});
