import test from 'node:test';
import assert from 'node:assert/strict';
import {grayscale} from '../dist/grayscale.mjs';
import {toLab,quantize} from '../dist/quantize.mjs';

test('grayscale preserves lightness and alpha without mutating the source',()=>{
  const input=new Uint8ClampedArray([255,0,0,255,0,255,0,128,9,70,220,0,80,80,80,255]);
  const copy=input.slice(), output=grayscale(input);
  assert.deepEqual(input,copy);
  for(const i of [0,4,12]) {
    assert.equal(output[i],output[i+1]);assert.equal(output[i+1],output[i+2]);
    assert.equal(output[i+3],input[i+3]);
    assert.ok(Math.abs(toLab(...input.slice(i,i+3))[0]-toLab(...output.slice(i,i+3))[0])<.003);
  }
  assert.deepEqual(output.slice(8,12),input.slice(8,12));
  assert.deepEqual(output.slice(12),input.slice(12));
});

test('grayscale grouping produces neutral ordered levels and excludes transparent pixels',()=>{
  const pixels=grayscale(new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,255,255,0,0]));
  const result=quantize(pixels,3);
  assert.equal(result.palette.length,3);assert.equal(result.labels[3],-1);
  for(const color of result.palette)assert.ok(Math.max(...color)-Math.min(...color)<=1);
  assert.ok(result.labels[2]<result.labels[0]);assert.ok(result.labels[0]<result.labels[1]);
});
