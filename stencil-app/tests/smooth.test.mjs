import test from 'node:test';
import assert from 'node:assert/strict';
import {bilateral} from '../dist/smooth.mjs';
const rgba=values=>Uint8ClampedArray.from(values.flatMap(v=>[v,v,v,255]));
test('disabled radius preserves input exactly without mutation',()=>{
 const data=rgba([10,50,100]);const copy=data.slice();assert.deepEqual(bilateral(data,3,1,{radius:0}),copy);assert.deepEqual(data,copy);
});
test('fine alternating noise is reduced',()=>{
 const data=rgba(Array.from({length:81},(_,i)=>i%2?135:120));const original=data.slice();
 const out=bilateral(data,9,9,{radius:2,strength:.1});
 const spread=a=>a.filter((_,i)=>i%4===0).reduce((sum,v)=>sum+(v-127.5)**2,0);
 assert.ok(spread(out)<spread(data)*.4);assert.deepEqual(data,original);
});
test('strong border and narrow dark line survive modest color strength',()=>{
 const data=rgba([240,240,240,10,240,240,240]);
 const out=bilateral(data,7,1,{radius:3,strength:.06});assert.deepEqual(out,data);
});
test('alpha and hidden RGB are preserved and transparent colors cannot bleed',()=>{
 const data=Uint8ClampedArray.from([255,0,0,0,0,0,255,255,0,0,255,80]);
 assert.deepEqual(bilateral(data,3,1,{radius:2,strength:.2}),data);
});
test('mirroring input mirrors output; borders stay normalized',()=>{
 const data=rgba([100,120,110,200,230]);
 const out=bilateral(data,5,1,{radius:2,strength:.1});
 const reversed=rgba([230,200,110,120,100]);const other=bilateral(reversed,5,1,{radius:2,strength:.1});
 for(let i=0;i<5;i++)assert.deepEqual(out.slice(i*4,i*4+4),other.slice((4-i)*4,(5-i)*4));
 const flat=rgba([120,120,120]);assert.deepEqual(bilateral(flat,3,1),flat);
});
