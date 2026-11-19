import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSheet} from '../dist/stencil-geometry.mjs';
import {suggestBridges} from '../dist/auto-bridges.mjs';

const width=40,height=40;
function fixture(neck,transpose=false){
 const cut=new Uint8Array(width*height).fill(1);
 const rect=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)cut[transpose?i*width+j:j*width+i]=0;};
 rect(0,0,8,40);rect(22,14,10,12);rect(8,18,14,neck);
 return cut;
}
const analyze=(cut,bridges=[],physicalFrame=false)=>analyzeSheet(cut,width,height,bridges,1,2,{physicalFrame});

test('1–2 px necks require bridging; 3–4 px necks connect, horizontally and vertically on both frame modes',()=>{
 for(const physical of [false,true])for(const transpose of [false,true])for(const neck of [1,2,3,4]){
   const cut=fixture(neck,transpose),before=cut.slice(),result=analyze(cut,[],physical);
   assert.equal(result.islands.length,neck<3?1:0,JSON.stringify({physical,transpose,neck}));
   assert.equal(result.minConnectionPx,3);
   // Every original retained pixel remains labelled, with unchanged cut geometry.
   for(let i=0;i<cut.length;i++)assert.equal(result.labels[i]>=0,!cut[i]);
   assert.deepEqual(cut,before);
 }
});

test('auto bridge reinforces a fragile neck, anchors inside solid material and does not repeat',()=>{
 for(const neck of [1,2]){
   const cut=fixture(neck),before=cut.slice(),result=analyze(cut);
   const bridges=suggestBridges(cut,width,height,result,1,2,3).map((b,i)=>({...b,id:`b${i}`}));
   assert.equal(bridges.length,1);
   for(const p of [bridges[0].a,bridges[0].b])assert.equal(result.core[Math.floor(p.y)*width+Math.floor(p.x)],1);
   const after=analyze(cut,bridges);assert.equal(after.islands.length,0);
   assert.equal(suggestBridges(cut,width,height,after,1,2,3).length,0);
   assert.deepEqual(cut,before);
 }
});

test('existing bridges must also provide 3 raster pixels of retained width',()=>{
 const cut=fixture(1),bridge={id:'manual',a:{x:4,y:19},b:{x:27,y:19},enabled:true};
 assert.equal(analyze(cut,[{...bridge,widthMm:2}]).islands.length,1);
 assert.equal(analyze(cut,[{...bridge,widthMm:3}]).islands.length,0);
});

test('thin isolated features remain selectable and single pixels remain ignored',()=>{
 const cut=new Uint8Array(width*height).fill(1);
 for(let x=12;x<20;x++)cut[20*width+x]=0;
 cut[10*width+10]=0;
 const result=analyze(cut);
 assert.equal(result.islands.length,1);assert.equal(result.islands[0].area,8);
 assert.equal(result.ignoredIslands,1);
 assert.equal(suggestBridges(cut,width,height,result,1,2,3).length,0);
});
