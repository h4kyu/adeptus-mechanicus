import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssignments,UNBLEACHED} from '../dist/assignments.mjs';
test('initializes from actual groups without editing the automatic assignments',()=>{
 const input=[0,7,15,-1],m=createAssignments(input,16);
 assert.deepEqual([...m.values],input);assert.equal(m.edited,false);
 assert.ok(m.set(0,15));assert.deepEqual(input,[0,7,15,-1]);assert.equal(m.automatic[0],0);
 assert.ok(m.restore(0));assert.equal(m.values[0],0);
});
test('unbleached is separate from the darkest group; group actions undo atomically',()=>{
 const m=createAssignments([0,0,1],2);
 m.setMany([0,1],UNBLEACHED);assert.deepEqual([...m.values],[-2,-2,1]);
 m.undo();assert.deepEqual([...m.values],[0,0,1]);m.redo();assert.deepEqual([...m.values],[-2,-2,1]);
 m.restore(0);assert.deepEqual([...m.values],[0,-2,1]);assert.equal(m.canRedo,false);
});
test('undo reaches the automatic state and new edits discard redo',()=>{
 const m=createAssignments([0,1],3);m.set(0,2);m.set(1,0);m.undo();m.undo();
 assert.deepEqual([...m.values],[0,1]);assert.equal(m.canUndo,false);assert.equal(m.canRedo,true);
 m.redo();m.set(1,UNBLEACHED);assert.equal(m.canRedo,false);
});
test('invalid groups and transparent regions cannot be assigned',()=>{
 const m=createAssignments([0,-1],2);
 for(const [id,to] of [[-1,0],[2,0],[0,2],[0,-1],[.5,1],[0,1.5],[0,0],[1,0]])assert.equal(m.set(id,to),false);
 assert.equal(m.edited,false);assert.equal(m.undo(),false);assert.equal(m.redo(),false);
});
