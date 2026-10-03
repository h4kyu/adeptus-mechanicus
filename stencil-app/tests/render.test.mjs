import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderer} from '../dist/render.mjs';

test('hover reuses static pixels and cropped masks; unchanged views are not redrawn',()=>{
  const previousDocument=globalThis.document, previousImageData=globalThis.ImageData;
  const uploads=[], blits=[];
  function canvas() {
    const target={width:0,height:0};
    target.getContext=()=>({
      createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData:data=>uploads.push({target,data}),clearRect:()=>{},
      drawImage:buffer=>blits.push({target,buffer})
    });return target;
  }
  globalThis.document={createElement:canvas};
  globalThis.ImageData=class {constructor(data){this.data=data;}};
  try {
    const render=createRenderer(),target=canvas(), pixels=new Uint8ClampedArray(4*4*4).fill(255);
    const segmentation={labels:new Int32Array(16).fill(-1),edges:new Uint8Array(16),regions:[{bounds:[1,1,2,2],paletteIndex:0}]};
    for(const i of [5,6,9,10]){segmentation.labels[i]=0;segmentation.edges[i]=1;}
    const options={pixels,segmentation,width:4,height:4};
    render(target,options);assert.equal(uploads.length,1);
    render(target,{...options,hover:0});assert.equal(uploads.length,2);
    assert.equal(uploads[1].target.width,2);assert.equal(uploads[1].target.height,2);
    const count=blits.length;render(target,{...options,hover:0});assert.equal(blits.length,count);
    render(target,options);render(target,{...options,hover:0});assert.equal(uploads.length,2);
    render(target,{...options,hidden:new Set([0]),hover:0});assert.equal(uploads.length,3);
  } finally {globalThis.document=previousDocument;globalThis.ImageData=previousImageData;}
});
