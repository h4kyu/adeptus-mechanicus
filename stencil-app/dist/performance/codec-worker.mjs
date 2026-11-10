import {encodeProject,validateProject} from '../projects.mjs';
import {decodeProjectFast} from './codec-prototype.mjs';
self.onmessage=({data})=>{
  const start=performance.now();
  try {
    const value=data.action==='decode'?decodeProjectFast(data.value):(validateProject(data.value),encodeProject(data.value));
    self.postMessage({value,computeMs:performance.now()-start});
  }catch(error){self.postMessage({error:error.message});}
};
