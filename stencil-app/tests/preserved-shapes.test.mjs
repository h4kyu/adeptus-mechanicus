import test from 'node:test';
import assert from 'node:assert/strict';
import {quantizeShapes,shapeOwners,validateShapes} from '../dist/preserved-shapes.mjs';
import {quantize} from '../dist/quantize.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
import {detectRegions} from '../dist/regions.mjs';
const box=(id,x,y,w,h)=>({id,points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]});
function fixture(){const data=new Uint8ClampedArray(8*6*4);for(let i=0;i<48;i++)data.set([i%8<4?80:200,80,100,255],i*4);return data;}

test('reserved shapes are exclusive groups within the existing budget, including identical colors',()=>{
  const data=fixture(),shapes=[box('eye',1,1,2,2)],q=quantizeShapes(data,3,shapes,8,6);
  const group=q.shapeGroups[0].group,owners=shapeOwners(shapes,data,8,6);
  assert.equal(q.palette.length,3);assert.deepEqual(q,quantizeShapes(data,3,shapes,8,6));
  for(let i=0;i<48;i++)assert.equal(q.labels[i]===group,owners[i]===0);
  assert.notEqual(q.labels[9],q.labels[0]);assert.deepEqual(data,fixture());
  const flat=new Uint8ClampedArray(4*4*4).fill(255),same=quantizeShapes(flat,2,[box('a',1,1,1,1)],4,4);
  assert.equal(same.palette.length,2);assert.notEqual(same.labels[0],same.labels[5]);
  assert.deepEqual(quantizeShapes(data,3,[],8,6),quantize(data,3));
});

test('later shapes own overlaps; transparency is excluded; covered shapes have no active group',()=>{
  const data=fixture();data[9*4+3]=0;
  const shapes=[box('a',0,0,3,3),box('b',0,0,4,4)],owners=shapeOwners(shapes,data,8,6),q=quantizeShapes(data,3,shapes,8,6);
  assert.equal(owners[9],-1);assert.equal(q.labels[9],-1);assert.equal(owners[0],1);
  assert.equal(q.shapeGroups[0].group,null);assert.notEqual(q.shapeGroups[1].group,null);
  const all=quantizeShapes(data,2,[box('all',0,0,8,6)],8,6);assert.equal(all.palette.length,1);
});

test('invalid geometry and insufficient group budgets fail explicitly',()=>{
  assert.throws(()=>quantizeShapes(fixture(),1,[box('a',0,0,1,1)],8,6),/automatic group/);
  for(const shapes of [[box('a',-1,0,1,1)],[box('a',0,0,1,1),box('a',1,1,1,1)],[{id:'a',points:[{x:NaN,y:0}]}]])assert.throws(()=>validateShapes(shapes,8,6));
});

test('worker protects native-resolution geometry from smoothing, cleanup, filtering and comparison',async()=>{
  let message;globalThis.self={postMessage:v=>{message=v;}};
  try{
    await import('../dist/region-worker.mjs?preserved-test');
    const data=fixture(),shapes=[box('eye',1,1,1,1)];data[10*4+3]=0;
    const options={mode:'quantized',colorSpace:'grayscale',colorCount:3,preservedShapes:shapes,smoothing:true,smoothRadius:2,smoothStrength:.1,cleanup:true,cleanupSize:100,minSize:100};
    self.onmessage({data:{revision:1,pixels:data,width:8,height:6,options}});
    assert.equal(message.error,undefined);const group=message.shapeGroups[0].group;
    assert.equal(message.regions.length,1);assert.equal(message.regions[0].area,1);assert.equal(message.labels[9],0);
    for(let i=0;i<48;i++){assert.equal(message.colorLabels[i]===group,i===9);assert.equal(message.baseline.colorLabels[i]===group,i===9);}
    assert.equal(message.colorLabels[10],-1);
    options.cleanup=false;self.onmessage({data:{revision:2,pixels:data,width:8,height:6,options}});
    assert.equal(message.error,undefined);assert.ok(message.baseline.labels[9]>=0);
    const beforeGroup=message.baseline.colorLabels[9];for(let i=0;i<48;i++)assert.equal(message.baseline.colorLabels[i]===beforeGroup,i===9);
  }finally{delete globalThis.self;}
});

test('editable shapes survive portable project round trip and legacy projects remain valid',()=>{
  const data=fixture(),shapes=[box('a',1,1,2,2)],q=quantizeShapes(data,3,shapes,8,6),r={...detectRegions(data,8,6,{mode:'quantized',colorLabels:q.labels}),palette:q.palette,colorLabels:q.labels,shapeGroups:q.shapeGroups};
  const p={format:'stencil-studio',version:1,name:'Shapes',source:{width:8,height:6,data},result:r,assignments:new Int16Array(r.regions.length).fill(-1),preservedShapes:shapes,settings:{mode:'quantized','color-count':'3'},view:{}};
  assert.deepEqual(decodeProject(encodeProject(p)).preservedShapes,shapes);
  delete p.preservedShapes;assert.equal(decodeProject(encodeProject(p)).preservedShapes,undefined);
  p.preservedShapes=[];p.settings.mode='color';assert.deepEqual(decodeProject(encodeProject(p)).preservedShapes,[]);
  p.preservedShapes=shapes;assert.throws(()=>decodeProject(encodeProject(p)));
});
