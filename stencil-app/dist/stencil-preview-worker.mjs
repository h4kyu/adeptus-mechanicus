import {buildPreviewSheets} from './stencil-preview.mjs';
self.onmessage=({data})=>{try{self.postMessage(buildPreviewSheets(data));}catch(error){self.postMessage({error:error.message});}};
