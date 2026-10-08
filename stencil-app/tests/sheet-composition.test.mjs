import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetLayers,buildSheetGeometry} from '../dist/sheet-composition.mjs';
import {newStencilPlan,validateStencilPlan} from '../dist/stencil-plan.mjs';
import {rasterizeCutPath,analyzeSheet} from '../dist/stencil-geometry.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
function fixture(){
 const width=20,height=20,treatments=new Int16Array(400).fill(-2),alpha=new Uint8Array(400).fill(255);
 for(let y=2;y<18;y++)for(let x=2;x<18;x++)treatments[y*width+x]=x>=7&&x<13&&y>=7&&y<13?2:1;
 return {width,height,treatments,alpha,plan:newStencilPlan()};
}
test('overlap merges adjacent openings and removes the island without changing assignments',()=>{
 const f=fixture(),before=f.treatments.slice(),separate=buildSheetGeometry(f),cut=rasterizeCutPath(separate.cutPath,20,20);
 assert.equal(analyzeSheet(cut,20,20,[],1,2).islands.length,1);
 f.plan.sheetIncludes={1:[2]};const merged=buildSheetGeometry(f),union=rasterizeCutPath(merged.cutPath,20,20);
 assert.equal(analyzeSheet(union,20,20,[],1,2).islands.length,0);assert.equal(union[10*20+10],1);
 assert.equal((merged.cutPath.match(/M/g)||[]).length,1);assert.deepEqual(f.treatments,before);
 f.plan.activeLayer=2;const highlight=rasterizeCutPath(buildSheetGeometry(f).cutPath,20,20);
 assert.equal(highlight[10*20+10],1);assert.equal(highlight[3*20+3],0);
});
test('sheet membership supports arbitrary groups, is direct rather than recursive, and ignores visibility',()=>{
 const f=fixture();f.plan.sheetIncludes={1:[2,4],2:[3]};f.plan.hiddenLayers=[2];
 assert.deepEqual(sheetLayers(f.plan),[1,2,4]);assert.deepEqual(sheetLayers(f.plan,2),[2,3]);assert.deepEqual(sheetLayers(f.plan,3),[3]);
 f.treatments[10*20+10]=3;const cut=rasterizeCutPath(buildSheetGeometry(f).cutPath,20,20);
 assert.equal(cut[10*20+10],0);assert.equal(cut[9*20+9],1);
});
test('merged geometry retains transparency, unassigned material, smoothing, and reusable cache',()=>{
 const f=fixture();f.plan.sheetIncludes={1:[2]};f.recipe={tolerance:2,preserveCorners:false};f.alpha[10*20+10]=0;f.treatments[9*20+9]=-1;
 const geometry=buildSheetGeometry(f),cut=rasterizeCutPath(geometry.cutPath,20,20);assert.equal(cut[10*20+10],0);assert.equal(cut[9*20+9],0);
 assert.deepEqual(buildSheetGeometry({...f,treatments:null,alpha:null,paths:geometry.paths,cachedCutPath:geometry.cutPath}),geometry);
});
test('overlap configuration round-trips and rejects invalid membership while accepting legacy plans',()=>{
 const f=fixture(),plan={...f.plan,sheetIncludes:{1:[2,3],3:[1]}};
 const p={format:'stencil-studio',version:1,name:'Overlap',source:{width:20,height:20,data:new Uint8ClampedArray(1600).fill(255)},result:{labels:new Int32Array(400),edges:new Uint8Array(400),regions:[{id:0,area:400,bounds:[0,0,19,19],paletteIndex:0}],ignoredPixels:0,palette:[[0,0,0],[80,80,80],[160,160,160],[255,255,255]],colorLabels:new Int16Array(400)},assignments:new Int16Array([1]),settings:{},view:{},stencilPlan:plan};
 assert.deepEqual(decodeProject(encodeProject(p)).stencilPlan,plan);
 const legacy={...plan};delete legacy.sheetIncludes;assert.doesNotThrow(()=>validateStencilPlan(legacy,20,20,4));
 for(const sheetIncludes of [null,[],{1:[1]},{1:[2,2]},{0:[1]},{1:[-2]},{1:[8]},{1:'2'}])assert.throws(()=>validateStencilPlan({...plan,sheetIncludes},20,20,4));
});
