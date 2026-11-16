import {suggestSheetJoin} from './sheet-layout.mjs';
self.onmessage=({data})=>{try{self.postMessage(suggestSheetJoin(data));}catch(error){self.postMessage({error:error.message});}};
