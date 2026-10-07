import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssignments,UNBLEACHED,treatmentGroups} from '../dist/assignments.mjs';
test('starts unassigned while preserving automatic groups for region eligibility',()=>{
 const input=[0,7,15,-1],m=createAssignments(input,16);
 assert.deepEqual([...m.values],[-1,-1,-1,-1]);assert.equal(m.edited,false);
 assert.ok(m.set(0,15));assert.deepEqual(input,[0,7,15,-1]);assert.equal(m.automatic[0],0);
 assert.ok(m.restore(0));assert.equal(m.values[0],-1);
});
test('unbleached group actions undo atomically',()=>{
 const m=createAssignments([0,0,1],2);
 m.setMany([0,1],UNBLEACHED);assert.deepEqual([...m.values],[-2,-2,-1]);
 m.undo();assert.deepEqual([...m.values],[-1,-1,-1]);m.redo();assert.deepEqual([...m.values],[-2,-2,-1]);
 m.restore(0);assert.deepEqual([...m.values],[-1,-2,-1]);assert.equal(m.canRedo,false);
});
test('undo reaches the unassigned state and new edits discard redo',()=>{
 const m=createAssignments([0,1],3);m.set(0,2);m.set(1,0);m.undo();m.undo();
 assert.deepEqual([...m.values],[-1,-1]);assert.equal(m.canUndo,false);assert.equal(m.canRedo,true);
 m.redo();m.set(1,UNBLEACHED);assert.equal(m.canRedo,false);
});
test('invalid groups and transparent regions cannot be assigned',()=>{
 const m=createAssignments([0,-1],2);
 for(const [id,to] of [[-1,0],[2,0],[0,2],[0,-1],[.5,1],[0,1.5],[1,0]])assert.equal(m.set(id,to),false);
 assert.equal(m.edited,false);assert.equal(m.undo(),false);assert.equal(m.redo(),false);
});

test('assigning the automatic color is still an explicit assignment and clearing releases it',()=>{
 const m=createAssignments([0,1],2);assert.ok(m.set(0,0));assert.equal(m.edited,true);
 assert.ok(m.restore(0));assert.equal(m.values[0],-1);m.undo();assert.equal(m.values[0],UNBLEACHED);
});

test('N quantized groups produce one unbleached slot and N-1 intensities',()=>{
 for(const count of [1,3,8]){const groups=treatmentGroups(Array.from({length:count},(_,i)=>[i,i,i]));
 assert.equal(groups.length,count);assert.equal(groups[0].value,UNBLEACHED);assert.equal(groups[0].label,'Unbleached');
 assert.deepEqual(groups.slice(1).map(g=>g.label),Array.from({length:count-1},(_,i)=>`Intensity ${i+1}`));}
 const m=createAssignments([0,1,2],3);m.set(0,0);assert.equal(m.values[0],UNBLEACHED);m.set(1,2);assert.equal(m.values[1],2);
});
