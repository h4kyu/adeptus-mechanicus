import test from 'node:test';
import assert from 'node:assert/strict';
import {assignmentEdges,selectionRegions} from '../dist/assignment-geometry.mjs';
import {createAssignments,UNBLEACHED} from '../dist/assignments.mjs';
const pixels=n=>new Uint8ClampedArray(n*4).fill(255);
test('nested regions assigned to one treatment lose internal boundaries without changing geometry',()=>{
 const labels=Int32Array.from([0,0,0,0,1,0,0,0,0]),original=labels.slice();
 assert.equal(assignmentEdges(labels,[1,1],3,3,pixels(9))[4],0);
 assert.equal(assignmentEdges(labels,[1,2],3,3,pixels(9))[4],1);
 assert.equal(assignmentEdges(labels,[-1,-1],3,3,pixels(9))[4],1);
 assert.equal(assignmentEdges(labels,[UNBLEACHED,UNBLEACHED],3,3,pixels(9))[4],0);
 assert.deepEqual(labels,original);
});
test('selection includes disconnected regions of the same treatment but not all unassigned regions',()=>{
 const values=[1,-1,2,1,-2,-2,-1];assert.deepEqual(selectionRegions(values,0),[0,3]);assert.deepEqual(selectionRegions(values,4),[4,5]);assert.deepEqual(selectionRegions(values,1),[1]);assert.deepEqual(selectionRegions(values,-1),[]);
});
test('transparent and filtered holes remain boundaries inside a treatment union',()=>{
 const labels=Int32Array.from([0,0,0,0,1,0,0,0,0]),source=pixels(9);source[1*4+3]=0;
 assert.equal(assignmentEdges(labels,[1,1],3,3,source)[4],1);
 labels[1]=-1;assert.equal(assignmentEdges(labels,[1,1],3,3,pixels(9))[4],1);
});
test('group-wide reassignment and clear undo atomically and recover original seams',()=>{
 const m=createAssignments([0,1,2],3);m.setMany([0,1],1);m.set(2,2);
 m.setMany(selectionRegions(m.values,0),2);assert.deepEqual([...m.values],[2,2,2]);m.undo();assert.deepEqual([...m.values],[1,1,2]);
 m.setMany(selectionRegions(m.values,0),-1);assert.deepEqual([...m.values],[-1,-1,2]);m.undo();assert.deepEqual([...m.values],[1,1,2]);
});

test('individual selection temporarily isolates one member without changing group ownership',()=>{
 const m=createAssignments([0,1,2],3);m.setMany([0,1,2],1);
 assert.deepEqual(selectionRegions(m.values,1,true),[1]);assert.deepEqual([...m.values],[1,1,1]);
 m.setMany(selectionRegions(m.values,1,true),2);assert.deepEqual([...m.values],[1,2,1]);
 m.undo();assert.deepEqual([...m.values],[1,1,1]);
 m.setMany(selectionRegions(m.values,1,true),-1);assert.deepEqual([...m.values],[1,-1,1]);
 m.undo();assert.deepEqual(selectionRegions(m.values,1),[0,1,2]);
});

test('pixel exceptions merge into treatment boundaries across original and filtered regions',()=>{
 const labels=Int32Array.from([0,0,0,0,-1,0,0,0,0]),overrides=new Int16Array(9).fill(-3),source=pixels(9);
 overrides[4]=1;assert.equal(assignmentEdges(labels,[1],3,3,source,overrides)[4],0);
 overrides[4]=2;assert.equal(assignmentEdges(labels,[1],3,3,source,overrides)[4],1);
 overrides[4]=-1;assert.equal(assignmentEdges(labels,[1],3,3,source,overrides)[4],0);
});
