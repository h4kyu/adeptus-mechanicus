import test from 'node:test';
import assert from 'node:assert/strict';
import {quantize,toLab,toRGB} from '../dist/quantize.mjs';
import {detectRegions} from '../dist/regions.mjs';
test('OKLab conversion handles known primaries and round trips',()=>{
 const red=toLab(255,0,0);assert.ok(Math.abs(red[0]-.627955)<.00001);
 for(const rgb of [[0,0,0],[255,255,255],[255,0,0],[0,255,0],[0,0,255],[123,64,200]])assert.deepEqual(toRGB(toLab(...rgb)),rgb);
});
test('transparent RGB does not consume palette colors; opacity preserved separately',()=>{
 const data=Uint8ClampedArray.from([255,0,0,255,0,0,255,128,42,200,10,0]);
 const q=quantize(data,8);assert.equal(q.palette.length,2);assert.equal(q.labels[2],-1);assert.notEqual(q.labels[0],q.labels[1]);
 assert.equal(quantize(new Uint8ClampedArray(16)).palette.length,0);
});
test('textured two-color fixture groups texture, preserving the central boundary',()=>{
 const data=new Uint8ClampedArray(80*40*4);
 for(let y=0;y<40;y++)for(let x=0;x<80;x++){
  const p=(y*80+x)*4,noise=((x*17+y*31)%19)-9;
  data.set(x<40?[200+noise,45+noise,40+noise,255]:[35+noise,80+noise,210+noise,255],p);
 }
 const q=quantize(data,2), again=quantize(data,2);assert.deepEqual(q,again);
 const regions=detectRegions(data,80,40,{mode:'quantized',colorLabels:q.labels});
 assert.equal(regions.regions.length,2);assert.equal(regions.regions[0].area,1600);
 assert.equal(q.labels[0],q.labels[39]);assert.notEqual(q.labels[39],q.labels[40]);
 // Reordering pixels leaves this canonical-histogram palette unchanged.
 const reversed=new Uint8ClampedArray(data.length);
 for(let i=0;i<data.length/4;i++)reversed.set(data.slice(i*4,i*4+4),data.length-4-i*4);
 assert.deepEqual(quantize(reversed,2).palette,q.palette);
});
test('disconnected areas retain separate region identities despite shared palette',()=>{
 const data=Uint8ClampedArray.from([255,0,0,255,0,0,255,255,255,0,0,255]);
 const q=quantize(data,2);assert.equal(q.labels[0],q.labels[2]);
 assert.equal(detectRegions(data,3,1,{mode:'quantized',colorLabels:q.labels}).regions.length,3);
});
test('gradient uses bounded reproducible palette without requesting nonexistent colors',()=>{
 const data=Uint8ClampedArray.from(Array.from({length:256},(_,i)=>[i,i,255-i,255]).flat());
 for(const k of [2,8,16]){const q=quantize(data,k);assert.equal(q.palette.length,k);assert.ok(q.labels.every(x=>x>=0&&x<k));}
 const flat=Uint8ClampedArray.from([20,40,80,255,20,40,80,255]);assert.equal(quantize(flat,16).palette.length,1);
});
