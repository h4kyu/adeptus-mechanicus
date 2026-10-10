import {buildStencilExport} from './stencil-export.mjs';
self.onmessage=({data})=>{try{self.postMessage(buildStencilExport(data));}catch(error){self.postMessage({error:error.message});}};
