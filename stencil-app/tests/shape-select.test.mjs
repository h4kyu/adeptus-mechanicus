import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSourceShape} from '../dist/shape-select.mjs';
import {preservedMask,shapeOwners,validateShapes,quantizeShapes} from '../dist/preserved-shapes.mjs';
import {decodeProject,encodeProject} from '../dist/projects.mjs';
import {detectRegions} from '../dist/regions.mjs';
const image=(w,h,fn)=>{const p=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)p.set(fn(x,y),4*(y*w+x));return p;};

test('one source click selects a connected color silhouette independent of quantization',()=>{
  const p=image(10,7,(x,y)=>x>=1&&x<=4&&y>=1&&y<=5||x===8&&y===3?[190,35,20,255]:[25,80,180,255]);
  const geometry=selectSourceShape(p,10,7,{x:2,y:3},.08),mask=preservedMask(geometry,10,7);
  assert.equal(geometry.pixelCount,20);assert.equal(geometry.points.length,4);assert.equal(mask[38],0);
  for(let y=0;y<7;y++)for(let x=0;x<10;x++)assert.equal(mask[y*10+x],Number(x>=1&&x<=4&&y>=1&&y<=5));
  const q=quantizeShapes(p,2,[{id:'source',...geometry}],10,7);assert.equal(q.palette.length,2);assert.notEqual(q.labels[32],q.labels[38]);
});

test('tolerance grows from the fixed seed; it cannot drift across a full gradient',()=>{
  const p=image(20,1,x=>[x*12,x*12,x*12,255]);
  const tight=selectSourceShape(p,20,1,{x:0,y:0},.03),wide=selectSourceShape(p,20,1,{x:0,y:0},.2);
  assert.ok(tight.pixelCount<wide.pixelCount);assert.ok(wide.pixelCount<20);
  assert.throws(()=>selectSourceShape(p,20,1,{x:0,y:0},.5));
});

test('source holes and transparent gaps survive tracing, manual hole editing and portable saves',()=>{
  const p=image(7,7,(x,y)=>x>=1&&x<=5&&y>=1&&y<=5&&!(x>=2&&x<=4&&y>=2&&y<=4)?[220,30,20,255]:[40,70,180,255]);
  p[0]=220;p[1]=30;p[2]=20;p[3]=0;
  const geometry=selectSourceShape(p,7,7,{x:1,y:1},0),shape={id:'ring',...geometry},mask=preservedMask(shape,7,7);
  assert.equal(shape.holes.length,1);assert.equal(shape.points.length,4);assert.equal(shape.holes[0].length,4);assert.equal(geometry.pixelCount,16);
  for(let i=0;i<49;i++)assert.equal(mask[i],Number(p[i*4]===220&&p[i*4+3]>0));
  const q=quantizeShapes(p,3,[shape],7,7),result={...detectRegions(p,7,7,{mode:'quantized',colorLabels:q.labels}),palette:q.palette,colorLabels:q.labels,shapeGroups:q.shapeGroups};
  const project={format:'stencil-studio',version:1,name:'Ring',source:{width:7,height:7,data:p},result,assignments:new Int16Array(result.regions.length).fill(-1),preservedShapes:[shape],settings:{mode:'quantized','color-count':'3'},view:{}};
  assert.deepEqual(decodeProject(encodeProject(project)).preservedShapes,[shape]);
  shape.holes[0]=[{x:3,y:2},{x:5,y:2},{x:5,y:5},{x:3,y:5}];
  assert.equal(preservedMask(shape,7,7)[3*7+2],1);assert.equal(shapeOwners([shape],p,7,7)[3*7+3],-1);
  assert.throws(()=>selectSourceShape(p,7,7,{x:0,y:0}),/opaque/);
  assert.throws(()=>validateShapes([{...shape,holes:[[{x:NaN,y:1}]]}],7,7));
});

test('exact contours match connected source pixels at corners, image edges and pinched holes',()=>{
  let state=17;
  for(let trial=0;trial<45;trial++){
    const w=9,h=8,p=image(w,h,()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%3?[230,230,230,255]:[0,0,0,255];});
    const expected=new Uint8Array(w*h),queue=[0];expected[0]=1;
    for(let k=0;k<queue.length;k++){const i=queue[k],neighbors=[];if(i%w)neighbors.push(i-1);if(i%w<w-1)neighbors.push(i+1);if(i>=w)neighbors.push(i-w);if(i+w<w*h)neighbors.push(i+w);for(const j of neighbors)if(!expected[j]&&p[j*4]===p[0]){expected[j]=1;queue.push(j);}}
    const geometry=selectSourceShape(p,w,h,{x:0,y:0},0);
    assert.deepEqual(preservedMask(geometry,w,h),expected);assert.equal(geometry.pixelCount,queue.length);
  }
});

test('worker returns geometry without modifying source and reports invalid clicks',async()=>{
  let reply;globalThis.self={postMessage:v=>{reply=v;}};
  try{
    await import('../dist/shape-select-worker.mjs');const p=image(3,3,()=>[100,90,80,255]),before=p.slice();
    self.onmessage({data:{pixels:p,width:3,height:3,seed:{x:1,y:1},tolerance:.12}});
    assert.equal(reply.error,undefined);assert.equal(reply.shape.pixelCount,9);assert.deepEqual(p,before);
    self.onmessage({data:{pixels:p,width:3,height:3,seed:{x:-1,y:1},tolerance:.12}});assert.match(reply.error,/Invalid/);
  }finally{delete globalThis.self;}
});
