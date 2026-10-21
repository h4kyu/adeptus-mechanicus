import test from 'node:test';
import assert from 'node:assert/strict';
import {quantizeShapes,validateShapes,validateShapeBudget} from '../dist/preserved-shapes.mjs';
import {detectRegions} from '../dist/regions.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
const shape=(id,x,fields={})=>({id,points:[{x,y:1},{x:x+1,y:1},{x:x+1,y:2},{x,y:2}],...fields});
const source=()=>{const p=new Uint8ClampedArray(8*4*4);for(let i=0;i<32;i++){const gray=[30,80,150,220][Math.floor((i%8)/2)];p.set([gray,gray,gray,255],i*4);}return p;};

test('choosing Group 3 means final slot 3 when releasing a preserved group changes automatic ranks',()=>{
  const p=source(),before=quantizeShapes(p,4,[shape('detail',2)],8,4);
  const choice=before.groupOptions.find(g=>g.group===2);assert.equal(choice.key,'auto:1');
  const oldBehavior=quantizeShapes(p,4,[shape('detail',2,{paletteGroup:1})],8,4);
  assert.equal(oldBehavior.shapeGroups[0].group,1); // Reproduces the reported Group 3 -> Group 2 jump.
  const fixed=quantizeShapes(p,4,[shape('detail',2,{targetGroup:2})],8,4);
  assert.equal(fixed.shapeGroups[0].group,2);assert.equal(fixed.labels[10],2);
});

test('different source colors can share any numbered group without source-color averaging',()=>{
  const p=source(),shapes=[shape('dark',0,{targetGroup:2}),shape('light',7,{targetGroup:2})],q=quantizeShapes(p,4,shapes,8,4);
  assert.deepEqual(q.shapeGroups.map(s=>s.group),[2,2]);assert.equal(q.labels[8],2);assert.equal(q.labels[15],2);
  assert.deepEqual(q.palette[2],[150,150,150]);assert.equal(q.preservedGroups.length,0);
  const changed=quantizeShapes(p,4,shapes.map(s=>({...s,targetGroup:0})),8,4);
  assert.deepEqual(changed.shapeGroups.map(s=>s.group),[0,0]);assert.equal(changed.labels[8],0);assert.equal(changed.labels[15],0);
});

test('explicit slots persist and remain selectable even when automatic fitting finds fewer unique colors',()=>{
  const p=new Uint8ClampedArray(8*4*4).fill(255),shapes=[shape('a',1,{targetGroup:3}),shape('b',6,{targetGroup:3})],q=quantizeShapes(p,4,shapes,8,4);
  assert.equal(q.palette.length,4);assert.deepEqual(q.shapeGroups.map(s=>s.group),[3,3]);
  const result={...detectRegions(p,8,4,{mode:'quantized',colorLabels:q.labels}),palette:q.palette,colorLabels:q.labels,shapeGroups:q.shapeGroups,groupOptions:q.groupOptions};
  const project={format:'stencil-studio',version:1,name:'Explicit slots',source:{width:8,height:4,data:p},result,assignments:new Int16Array(result.regions.length).fill(-1),preservedShapes:shapes,settings:{mode:'quantized','color-count':'4'},view:{}};
  assert.deepEqual(decodeProject(encodeProject(project)).preservedShapes,shapes);
  assert.throws(()=>validateShapeBudget(shapes,3));assert.throws(()=>validateShapes([shape('a',1,{targetGroup:2,paletteGroup:0})],8,4));
});
