import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, separate } from '../dist/intensity.mjs';

test('transparent pixels remain untouched in both directions', () => {
  for (const invert of [true, false]) {
    assert.equal(classify(0, 0, 0, 0, [.25, .5, .75], invert), 0);
    assert.equal(classify(255, 255, 255, 0, [.25, .5, .75], invert), 0);
  }
});
test('three thresholds produce untouched plus three distinct layers', () => {
  const pixels = new Uint8ClampedArray([255,255,255,255, 170,170,170,255, 100,100,100,255, 0,0,0,255]);
  assert.deepEqual([...separate(pixels, [.25,.5,.75], true)], [0,1,2,3]);
  assert.deepEqual([...separate(pixels, [.25,.5,.75], false)], [3,2,1,0]);
});
test('one-layer boundaries and partial transparency', () => {
  assert.equal(classify(0,0,0,255,[.5],true), 1);
  assert.equal(classify(255,255,255,255,[.5],true), 0);
  assert.equal(classify(0,0,0,128,[.25,.5,.75],true), 2);
});
