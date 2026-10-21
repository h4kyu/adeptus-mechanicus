import {selectSourceShape} from './shape-select.mjs';
self.onmessage=({data:{pixels,width,height,seed,tolerance}})=>{
  try{self.postMessage({shape:selectSourceShape(pixels,width,height,seed,tolerance)});}
  catch(error){self.postMessage({error:error.message});}
};
