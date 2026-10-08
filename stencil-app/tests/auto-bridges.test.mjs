import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSheet,rasterizeCutPath} from '../dist/stencil-geometry.mjs';
import {suggestBridges} from '../dist/auto-bridges.mjs';
import {createBridgeHistory,validateStencilPlan,newStencilPlan} from '../dist/stencil-plan.mjs';
const analyze=(cut,w,h,bridges=[])=>analyzeSheet(cut,w,h,bridges,1,2);
const auto=(cut,w,h,bridges=[],mm=3)=>suggestBridges(cut,w,h,analyze(cut,w,h,bridges),1,2,mm).map((b,i)=>({...b,id:`auto-${i}`,layer:1}));
const rect=(cut,w,x,y,dx,dy,value=0)=>{for(let j=y;j<y+dy;j++)for(let i=x;i<x+dx;i++)cut[j*w+i]=value;};
test('single-pixel islands are not highlighted, navigated or bridged; assignments stay untouched',()=>{
 const cut=new Uint8Array(400).fill(1);cut[3*20+3]=0;rect(cut,20,9,9,2,2);const original=cut.slice(),result=analyze(cut,20,20);
 assert.equal(result.ignoredIslands,1);assert.equal(result.islands.length,1);assert.equal(result.islands[0].id,1);assert.equal(result.labels[63],-2);
 const bridges=auto(cut,20,20);assert.equal(bridges.length,1);assert.equal(analyze(cut,20,20,bridges).islands.length,0);assert.deepEqual(cut,original);
});
test('ring gets one short editable bridge with no duplicate on a second run',()=>{
 const cut=rasterizeCutPath('M2 2L38 2L38 38L2 38ZM15 15L25 15L25 25L15 25Z',40,40),bridges=auto(cut,40,40);
 assert.equal(bridges.length,1);assert.equal(bridges[0].widthMm,3);assert.ok(Math.hypot(bridges[0].a.x-bridges[0].b.x,bridges[0].a.y-bridges[0].b.y)<=14);
 const result=analyze(cut,40,40,bridges);assert.equal(result.islands.length,0);assert.equal(result.bridgeStatus[0].reason,'');assert.equal(auto(cut,40,40,bridges).length,0);
 const plan={...newStencilPlan(),bridges};validateStencilPlan(plan,40,40,2);const history=createBridgeHistory();history.commit([],bridges);assert.deepEqual(history.undo(bridges),[]);assert.deepEqual(history.redo([]),bridges);
});
test('island thickness caps width and nearby islands share a short network to the frame',()=>{
 const cut=new Uint8Array(60*30).fill(1);rect(cut,60,0,0,60,2);rect(cut,60,20,7,2,6);rect(cut,60,20,17,2,6);
 const bridges=auto(cut,60,30,[],5);assert.equal(bridges.length,2);assert.ok(bridges.every(b=>b.widthMm<=2));assert.equal(analyze(cut,60,30,bridges).islands.length,0);
 // The two-island network is shorter than giving each island its own frame bridge.
 assert.ok(bridges.reduce((sum,b)=>sum+Math.hypot(b.a.x-b.b.x,b.a.y-b.b.y),0)<15);
});
test('preserves existing bridges and handles frame-only anchoring',()=>{
 const cut=new Uint8Array(30*30).fill(1);rect(cut,30,10,10,5,5);
 const existing=[{id:'existing',layer:1,a:{x:12.5,y:12.5},b:{x:12.5,y:-1},widthMm:2,enabled:true,needsReview:false}],before=structuredClone(existing);
 assert.equal(auto(cut,30,30,existing).length,0);assert.deepEqual(existing,before);
 const bridges=auto(cut,30,30);assert.equal(bridges.length,1);assert.equal(analyze(cut,30,30,bridges).islands.length,0);
 assert.ok(bridges[0].a.x<0||bridges[0].a.y<0||bridges[0].b.x<0||bridges[0].b.y<0);
});
test('automatic widths default to 1.5–2 mm and skip islands too thin for the minimum',()=>{
 const cut=new Uint8Array(30*30).fill(1);rect(cut,30,10,10,5,5);
 const result=analyze(cut,30,30),defaults=suggestBridges(cut,30,30,result,1,2);
 assert.equal(defaults.length,1);assert.equal(defaults[0].widthMm,2);
 const custom=suggestBridges(cut,30,30,result,1,2,3,2.5);assert.equal(custom.length,1);assert.equal(custom[0].widthMm,3);
 const thin=new Uint8Array(30*30).fill(1);rect(thin,30,10,10,1,5);const thinResult=analyze(thin,30,30);
 assert.equal(suggestBridges(thin,30,30,thinResult,1,2).length,0);
 assert.equal(thinResult.islands.length,1);
 // A former 0.45 mm suggestion must not sneak through after unit conversion.
 assert.equal(suggestBridges(thin,30,30,thinResult,2,2,2,1.5).length,0);
});
test('width limits persist, accept older plans, and reject invalid ranges',()=>{
 const plan=newStencilPlan();assert.equal(plan.autoBridgeMinMm,1.5);assert.equal(plan.autoBridgeMaxMm,2);
 const custom={...plan,autoBridgeMinMm:2,autoBridgeMaxMm:4};assert.deepEqual(validateStencilPlan(JSON.parse(JSON.stringify(custom)),30,30,2),custom);
 const legacy={...plan};delete legacy.autoBridgeMinMm;delete legacy.autoBridgeMaxMm;assert.doesNotThrow(()=>validateStencilPlan(legacy,30,30,2));
 for(const limits of [{autoBridgeMinMm:3,autoBridgeMaxMm:2},{autoBridgeMinMm:0},{autoBridgeMaxMm:26},{autoBridgeMinMm:null},{autoBridgeMaxMm:NaN}])assert.throws(()=>validateStencilPlan({...plan,...limits},30,30,2));
});
