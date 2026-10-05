import test from 'node:test';
import assert from 'node:assert/strict';
import {zoomAt,fitCamera} from '../dist/camera.mjs';
test('zoom keeps the image point underneath the pointer fixed',()=>{
 const start={scale:.5,x:40,y:80},x=220,y=160;
 const next=zoomAt(start,2,x,y);
 assert.equal((x-next.x)/next.scale,(x-start.x)/start.scale);
 assert.equal((y-next.y)/next.scale,(y-start.y)/start.scale);
 assert.deepEqual(start,{scale:.5,x:40,y:80});
});
test('fit preserves aspect ratio inside portrait and landscape viewports',()=>{
 for(const [w,h] of [[820,1180],[1280,720],[390,844]]){
  const c=fitCamera(1200,1800,w,h);
  assert.ok(c.scale>0);assert.ok(1200*c.scale<=w-100+1e-6);
  assert.ok(1800*c.scale<=h-230+1e-6);
 }
});
test('zoom limits stay positive and still preserve the anchor',()=>{
 const c={scale:1,x:0,y:0};
 for(const factor of [1e-10,1e10]){const next=zoomAt(c,factor,100,200);assert.ok(next.scale>=.01&&next.scale<=32);assert.ok(Math.abs((100-next.x)/next.scale-100)<1e-6);}
});

test('trackpad scroll translates the camera without zooming',async()=>{
 const {wheelCamera}=await import('../dist/camera.mjs');
 assert.deepEqual(wheelCamera({scale:2,x:100,y:200},{deltaX:30,deltaY:-40},0,0),{scale:2,x:70,y:240});
 assert.deepEqual(wheelCamera({scale:2,x:100,y:200},{deltaY:2,deltaMode:1},0,0),{scale:2,x:100,y:168});
});
test('trackpad pinch zooms around its anchor',async()=>{
 const {wheelCamera}=await import('../dist/camera.mjs'),start={scale:1,x:10,y:20};
 const next=wheelCamera(start,{ctrlKey:true,deltaY:-20},200,300);
 assert.ok(next.scale>1);
 assert.ok(Math.abs((200-next.x)/next.scale-190)<1e-8);
 assert.ok(Math.abs((300-next.y)/next.scale-280)<1e-8);
});
test('two-finger touchscreen movement ignores changes in finger separation',async()=>{
 const {panBetween}=await import('../dist/camera.mjs');
 assert.deepEqual(panBetween({scale:2,x:10,y:20},{x:100,y:200,d:40},{x:120,y:190,d:90}),{scale:2,x:30,y:10});
});
