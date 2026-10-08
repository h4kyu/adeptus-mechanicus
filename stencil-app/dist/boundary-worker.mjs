import {traceBoundaries} from './boundary-vectors.mjs';
self.onmessage=({data})=>{try{self.postMessage(traceBoundaries(data.treatments,data.alpha,data.width,data.height,data.recipe));}catch(error){self.postMessage({error:error.message});}};
