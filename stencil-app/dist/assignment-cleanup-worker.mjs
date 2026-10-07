import {cleanupAssignments} from './assignment-cleanup.mjs';
self.onmessage=({data})=>{
  try{const result=cleanupAssignments(data.treatments,data.alpha,data.width,data.height,data.minimum,data.scope);self.postMessage(result,[result.labels.buffer]);}
  catch(error){self.postMessage({error:error.message});}
};
