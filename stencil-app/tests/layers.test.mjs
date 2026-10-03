import test from 'node:test';
import assert from 'node:assert/strict';
import {groupLayers} from '../dist/layers.mjs';
import {quantize} from '../dist/quantize.mjs';
import {detectRegions} from '../dist/regions.mjs';
test('separated regions of the same color share one layer without losing identity',()=>{
 const data=Uint8ClampedArray.from([255,0,0,255,0,0,255,255,255,0,0,255]);
 const q=quantize(data,2), r=detectRegions(data,3,1,{mode:'quantized',colorLabels:q.labels});
 const layers=groupLayers(q.palette,r.regions);
 assert.equal(layers.length,2);assert.equal(layers[q.labels[0]].regionIds.length,2);
 assert.equal(layers[q.labels[0]].area,2);assert.notEqual(r.labels[0],r.labels[2]);
});
test('counts use retained regions only and transparency is not a color layer',()=>{
 const layers=groupLayers([[255,0,0],[0,0,255]], [{id:0,paletteIndex:0,area:12},{id:1,paletteIndex:-1,area:20}]);
 assert.deepEqual(layers[0].regionIds,[0]);assert.equal(layers[1].area,0);assert.deepEqual(layers[1].regionIds,[]);
});
