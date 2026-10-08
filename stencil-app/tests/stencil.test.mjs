import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterizeCutPath,analyzeSheet,sheetScale} from '../dist/stencil-geometry.mjs';
import {newStencilPlan,validateStencilPlan,createBridgeHistory} from '../dist/stencil-plan.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
const ring='M2 2L18 2L18 18L2 18ZM7 7L13 7L13 13L7 13Z';
const bridge=(extra={})=>({id:'bridge',layer:1,a:{x:10,y:10},b:{x:10,y:0},widthMm:2,enabled:true,needsReview:false,...extra});
test('a separate sheet identifies retained islands, then a bridge connects them to the frame',()=>{
 const cut=rasterizeCutPath(ring,20,20),before=cut.slice();
 assert.equal(analyzeSheet(cut,20,20,[],1,2).islands.length,1);
 const connected=analyzeSheet(cut,20,20,[bridge()],1,2);assert.equal(connected.islands.length,0);assert.equal(connected.bridgeStatus[0].reason,'');assert.deepEqual(cut,before);
 assert.equal(analyzeSheet(cut,20,20,[bridge({enabled:false})],1,2).islands.length,1);
 assert.equal(analyzeSheet(cut,20,20,[bridge({a:{x:4,y:10},b:{x:4,y:3}})],1,2).bridgeStatus[0].reason,'Extend both ends onto retained material');
});
test('source-resolution rasterization handles curves and preserves holes',()=>{
 const mask=rasterizeCutPath('M2 2L18 2Q20 2 20 4L20 18L2 18ZM7 7L13 7L13 13L7 13Z',22,20);
 assert.equal(mask[10*22+10],0);assert.equal(mask[4*22+4],1);assert.equal(mask[0],0);
});
test('size preserves aspect ratio and bridge widths remain physical millimeters',()=>{
 const s=sheetScale(1200,600,15);assert.equal(s.widthInches,15);assert.equal(s.heightInches,7.5);
 assert.equal(sheetScale(1200,600,10).pxPerMm,2*sheetScale(1200,600,20).pxPerMm);
 const cut=rasterizeCutPath(ring,20,20);
 assert.match(analyzeSheet(cut,20,20,[bridge({b:{x:10,y:-5}})],1,2).bridgeStatus[0].reason,/Outside/);
 assert.match(analyzeSheet(cut,20,20,[bridge({needsReview:true})],1,2).bridgeStatus[0].reason,/Review/);
});
test('editing bridge endpoints, width and removal undo independently in whole operations',()=>{
 const h=createBridgeHistory(),a=[bridge()],b=[bridge({widthMm:4,b:{x:0,y:10}})];h.commit([],a);h.commit(a,b);
 assert.deepEqual(h.undo(b),a);assert.deepEqual(h.redo(a),b);h.commit(b,[]);assert.deepEqual(h.undo([]),b);
});
test('plans persist with per-layer bridges, visibility and review flags; malformed bridges are rejected',()=>{
 const plan={...newStencilPlan(),bridges:[bridge()],hiddenLayers:[-2,2],showSheet:true};
 const p={format:'stencil-studio',version:1,name:'Bridge test',source:{width:20,height:20,data:new Uint8ClampedArray(1600).fill(255)},result:{labels:new Int32Array(400),edges:new Uint8Array(400),regions:[{id:0,area:400,bounds:[0,0,19,19],paletteIndex:0}],ignoredPixels:0,palette:[[0,0,0],[128,128,128]],colorLabels:new Int16Array(400)},assignments:new Int16Array([1]),settings:{},view:{},stencilPlan:plan};
 assert.deepEqual(decodeProject(encodeProject(p)).stencilPlan,plan);
 for(const change of [p=>p.bridges[0].widthMm=-1,p=>p.bridges[0].a.x=Infinity,p=>p.longEdgeInches=0,p=>p.bridges.push({...p.bridges[0]})]){const bad=structuredClone(plan);change(bad);assert.throws(()=>validateStencilPlan(bad,20,20,2));}
});
