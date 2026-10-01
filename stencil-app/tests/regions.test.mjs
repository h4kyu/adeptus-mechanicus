import test from 'node:test';
import assert from 'node:assert/strict';
import {detectRegions} from '../dist/regions.mjs';
const W=[255,255,255,255], R=[255,0,0,255], B=[0,0,255,255];
const run=(rows,options={})=>detectRegions(Uint8ClampedArray.from(rows.flat(2)),rows[0].length,rows.length,options);
test('equal colors remain separate when disconnected; touching different colors separate',()=>{
 const r=run([[R,B,R]],{tolerance:0});assert.equal(r.regions.length,3);assert.notEqual(r.labels[0],r.labels[2]);
});
test('silhouettes merge touching foreground colors and expose enclosed background holes',()=>{
 const r=run([[W,W,W,W,W],[W,R,B,R,W],[W,R,W,R,W],[W,R,R,R,W],[W,W,W,W,W]],{mode:'silhouette'});
 assert.equal(r.regions.length,3);assert.equal(r.labels[6],r.labels[7]);assert.notEqual(r.labels[0],r.labels[12]);
 assert.equal(r.regions[r.labels[12]].kind,'Background');assert.equal(r.regions[r.labels[6]].area,8);
});
test('seed-relative threshold prevents gradual color drift from swallowing a gradient',()=>{
 const row=Array.from({length:10},(_,i)=>[i*25,i*25,i*25,255]);
 const low=run([row],{tolerance:.1}), high=run([row],{tolerance:.5});
 assert.ok(low.regions.length>high.regions.length);assert.ok(low.regions.length>1);
});
test('minimum area hides small components without altering retained boundaries',()=>{
 const full=run([[R,R,B]],{tolerance:0}), filtered=run([[R,R,B]],{tolerance:0,minSize:2});
 assert.equal(filtered.regions.length,1);assert.equal(filtered.ignoredPixels,1);assert.equal(filtered.labels[2],-1);
 assert.deepEqual(filtered.regions[0].bounds,full.regions[0].bounds);
});
test('transparent RGB is ignored and alpha silhouettes preserve holes',()=>{
 const row=[[255,0,0,0],[0,255,0,0],R];
 const color=run([row],{tolerance:0});assert.equal(color.labels[0],color.labels[1]);assert.notEqual(color.labels[1],color.labels[2]);
 const sil=run([row],{mode:'silhouette',backgroundMode:'alpha'});assert.equal(sil.regions[sil.labels[2]].kind,'Foreground');
});
test('region bounds and edge map describe a filled area',()=>{
 const r=run([[R,R,R],[R,R,R],[R,R,R]],{tolerance:0});
 assert.deepEqual(r.regions[0].bounds,[0,0,2,2]);assert.equal(r.edges[4],0);assert.equal(r.edges[0],1);
});
