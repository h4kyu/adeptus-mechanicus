import test from 'node:test';
import assert from 'node:assert/strict';
import { silhouette, silhouetteLevels } from '../dist/silhouette.mjs';

const pixels = values => Uint8ClampedArray.from(values.flatMap(v => [v, v, v, 255]));

test('solid and every band configuration preserve exactly the same foreground', () => {
  const data = pixels([255, 220, 180, 120, 60, 0, 255]);
  const mask = silhouette(data, 7, 1);
  assert.deepEqual([...mask], [0, 1, 1, 1, 1, 1, 0]);
  assert.deepEqual([...silhouetteLevels(data, mask, [], true, true)], [...mask]);
  for (const thresholds of [[], [.5], [.33, .67], [.01, .99]]) {
    for (const invert of [true, false]) {
      const levels = silhouetteLevels(data, mask, thresholds, invert);
      assert.deepEqual([...levels].map(v => Number(v > 0)), [...mask]);
      assert.ok(levels.every(v => v <= thresholds.length + 1));
    }
  }
});

test('holes can be preserved or filled without filling exterior gaps', () => {
  const data = pixels([
    255,255,255,255,255,
    255,0,0,0,255,
    255,0,255,0,255,
    255,0,0,0,255,
    255,255,255,255,255,
  ]);
  const withHole = silhouette(data, 5, 5);
  const filled = silhouette(data, 5, 5, {keepHoles: false});
  assert.equal(withHole[12], 0);
  assert.equal(filled[12], 1);
  assert.equal(filled.reduce((a, b) => a + b), 9);
  // Opening the ring connects its center to the exterior again.
  data.set([255,255,255,255], 7 * 4);
  assert.equal(silhouette(data, 5, 5, {keepHoles: false})[12], 0);
});

test('transparency ignores RGB and cutoff trims soft edges', () => {
  const data = Uint8ClampedArray.from([0,0,0,0, 255,255,255,255, 0,0,0,20]);
  assert.deepEqual([...silhouette(data, 3, 1, {mode: 'alpha'})], [0,1,0]);
  assert.deepEqual([...silhouette(data, 3, 1, {mode: 'alpha', alphaCutoff: 0})], [0,1,1]);
});

test('background selection and tolerance determine the boundary independently', () => {
  const data = pixels([0,20,100,255]);
  assert.deepEqual([...silhouette(data, 4, 1, {background: [0,0,0], tolerance: .1})], [0,0,1,1]);
  assert.deepEqual([...silhouette(data, 4, 1, {background: [0,0,0], tolerance: .5})], [0,0,0,1]);
});
