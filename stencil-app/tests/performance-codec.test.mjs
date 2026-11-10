import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
import {decodeProjectFast} from '../dist/performance/codec-prototype.mjs';
import {detectRegions} from '../dist/regions.mjs';
function fixture(){
  const source={width:2,height:2,data:new Uint8ClampedArray([255,0,0,255,0,0,255,128,0,0,0,0,255,0,0,255])};
  const result=detectRegions(source.data,2,2);
  return {format:'stencil-studio',version:1,name:'Codec check',source,result,assignments:new Int16Array(result.regions.length).fill(-1),settings:{},view:{}};
}
test('loop decoding is identical for all existing array types and subviews',()=>{
  const p=fixture();
  p.extra={nested:[new Uint8Array([0,127,128,255]),new Int16Array([-32768,-3,-2,-1,32767]),new Int32Array([-2147483648,2147483647]),new Float32Array([.125,-1.5,Infinity,NaN]),new Uint8Array([99,0,255,88]).subarray(1,3)],empty:new Int16Array()};
  const text=encodeProject(p),expected=decodeProject(text),actual=decodeProjectFast(text);
  assert.deepEqual(actual,expected);assert.equal(encodeProject(actual),text);
});
test('loop decoding retains project validation and rejects malformed data',()=>{
  assert.throws(()=>decodeProjectFast('{broken'));
  for(const array of [{$array:'Object',data:'AAAA'},{$array:'Int32Array',data:'AA=='},{$array:'Uint8Array',data:'!bad'},{$array:'Uint8Array',data:4}]){
    const p=fixture();p.extra=array;assert.throws(()=>decodeProjectFast(encodeProject(p)));
  }
  for(const mutate of [p=>p.version=2,p=>p.result.labels[0]=999,p=>p.source.width=3]){
    const p=fixture();mutate(p);assert.throws(()=>decodeProjectFast(encodeProject(p)));
  }
});
