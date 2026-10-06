import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeProject,decodeProject,validateProject} from '../dist/projects.mjs';
import {detectRegions} from '../dist/regions.mjs';
import {quantize} from '../dist/quantize.mjs';
import {createAssignments} from '../dist/assignments.mjs';
function fixture(){
  const source={width:3,height:2,data:new Uint8ClampedArray([255,0,0,255,0,0,255,128,0,0,0,0,255,0,0,255,0,0,255,255,0,0,0,0])};
  const q=quantize(source.data,2),result={...detectRegions(source.data,3,2,{mode:'quantized',colorLabels:q.labels}),palette:q.palette,colorLabels:q.labels};
  const assignments=Int16Array.from(result.regions,r=>r.paletteIndex);assignments[0]=-2;
  return {format:'stencil-studio',version:1,name:'Artwork',source,result,assignments,settings:{mode:'quantized'},view:{camera:{x:12,y:-43,scale:2}}};
}
test('project round trip preserves source alpha, exact regions, palette, overrides and camera',()=>{
  const p=fixture();p.result.baseline=structuredClone(p.result);p.result.prepared=p.source.data.slice();p.result.smoothed=p.source.data.slice();
  const restored=decodeProject(encodeProject(p));assert.deepEqual(restored,p);
  restored.source.data[0]=0;assert.equal(p.source.data[0],255);
});
test('rejects unsupported versions, broken pixel maps, invalid groups and bounds',()=>{
  for(const change of [p=>p.version=2,p=>p.source.width=4,p=>p.result.labels[0]=999,p=>p.result.regions[0].bounds[2]=100,p=>p.assignments[0]=8,p=>p.result.colorLabels[0]=8,p=>p.result.palette[0][0]=NaN,p=>p.view.camera.scale=0,p=>p.result.smoothed=new Uint8ClampedArray(2)]){
    const p=fixture();change(p);assert.throws(()=>validateProject(p));
  }
  assert.throws(()=>decodeProject('{broken'));
  assert.throws(()=>decodeProject('{"$array":"Object","data":"AAAA"}'));
});
test('non-quantized projects retain null group identities and restore without invented groups',()=>{
  const p=fixture();p.result=detectRegions(p.source.data,3,2);p.assignments=new Int16Array(p.result.regions.length).fill(-1);assert.deepEqual(decodeProject(encodeProject(p)),p);
});
test('restored overrides protect segmentation without restoring old undo history',()=>{
  const p=fixture(),m=createAssignments(p.result.regions.map(r=>r.paletteIndex),p.result.palette.length);m.values.set(p.assignments);
  assert.equal(m.edited,true);assert.equal(m.canUndo,false);m.set(0,0);assert.equal(m.canUndo,true);m.undo();assert.equal(m.values[0],-2);
});

test('unassigned quantized regions survive save/load alongside explicit assignments',()=>{
 const p=fixture();p.assignments[1]=-1;assert.deepEqual(decodeProject(encodeProject(p)),p);
 const m=createAssignments(p.result.regions.map(r=>r.paletteIndex),p.result.palette.length);
 m.values.fill(-1);assert.equal(m.edited,false);
 m.values[0]=m.automatic[0];assert.equal(m.edited,true);
});
