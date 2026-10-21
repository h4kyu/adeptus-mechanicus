import test from 'node:test';
import assert from 'node:assert/strict';
import {quantizeShapes,reservedGroupKeys,validateShapeBudget,paletteGroupOptions} from '../dist/preserved-shapes.mjs';
import {mergeSmallRegions} from '../dist/cleanup.mjs';
import {detectRegions} from '../dist/regions.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
const box=(id,x,group)=>({id,points:[{x,y:1},{x:x+1,y:1},{x:x+1,y:2},{x,y:2}],...group});
const pixels=()=>{const p=new Uint8ClampedArray(8*4*4);for(let i=0;i<32;i++)p.set(i%8<4?[40,40,40,255]:[220,220,220,255],i*4);return p;};

test('separate outlines can share one preserved slot without increasing the color budget',()=>{
  const p=pixels(),shapes=[box('a',1,{groupId:'shared'}),box('b',6,{groupId:'shared'})],q=quantizeShapes(p,3,shapes,8,4);
  assert.equal(reservedGroupKeys(shapes).length,1);assert.equal(q.palette.length,3);
  assert.equal(q.shapeGroups[0].group,q.shapeGroups[1].group);assert.equal(q.labels[9],q.labels[14]);
  assert.ok(q.groupOptions.some(g=>g.key==='reserved:shared'));
  const many=Array.from({length:12},(_,i)=>box('shape'+i,i%7,{groupId:'shared'}));
  assert.doesNotThrow(()=>quantizeShapes(p,2,many,8,4));
});

test('a manual shape can join an automatic slot and its pixels survive cleanup and filtering',()=>{
  const p=pixels(),shapes=[box('a',1,{paletteGroup:1})],q=quantizeShapes(p,2,shapes,8,4);
  const target=q.groupOptions.find(g=>g.key==='auto:1').group;
  assert.equal(reservedGroupKeys(shapes).length,0);assert.equal(q.labels[9],target);assert.equal(q.labels[9],q.labels[7]);
  const cleanup=mergeSmallRegions(p,8,4,q.labels,100,new Set(q.preservedGroups),q.protectedPixels);
  assert.equal(cleanup.labels[9],target);
  const r=detectRegions(p,8,4,{mode:'quantized',colorLabels:cleanup.labels,minSize:100,protectedPixels:q.protectedPixels});
  assert.ok(r.labels[9]>=0);
  assert.throws(()=>validateShapeBudget(shapes,1),/automatic/);
});

test('shared and automatic memberships round trip and legacy independent groups retain their identity',()=>{
  const p=pixels(),shapes=[box('a',1,{groupId:'together'}),box('b',2,{groupId:'together'}),box('c',6,{paletteGroup:0})],q=quantizeShapes(p,3,shapes,8,4);
  const result={...detectRegions(p,8,4,{mode:'quantized',colorLabels:q.labels}),colorLabels:q.labels,palette:q.palette,shapeGroups:q.shapeGroups,groupOptions:q.groupOptions};
  const project={format:'stencil-studio',version:1,name:'Shared',source:{width:8,height:4,data:p},result,assignments:new Int16Array(result.regions.length).fill(-1),preservedShapes:shapes,settings:{mode:'quantized','color-count':'3'},view:{}};
  assert.deepEqual(decodeProject(encodeProject(project)).preservedShapes,shapes);
  assert.equal(reservedGroupKeys([box('a',1,{}),box('b',6,{})]).length,2);
  const legacy={palette:[[10,10,10],[80,80,80],[200,200,200]],shapeGroups:[{id:'old',group:1}]};
  assert.deepEqual(paletteGroupOptions(legacy,[box('old',1,{})]).map(g=>g.key),['auto:0','reserved:old','auto:1']);
  const all={id:'all',points:[{x:0,y:0},{x:8,y:0},{x:8,y:4},{x:0,y:4}],paletteGroup:1};
  const flat=quantizeShapes(new Uint8ClampedArray(8*4*4).fill(255),2,[all],8,4);assert.equal(flat.palette.length,2);assert.ok(flat.labels.every(v=>v===flat.shapeGroups[0].group));
});
