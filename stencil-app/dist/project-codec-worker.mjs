import {encodeProject,decodeProject,validateProject} from './projects.mjs';
export function processProjectJob({id,action,value}){
  try{
    if(action==='encode'){validateProject(value);return {id,value:encodeProject(value)};}
    if(action==='decode')return {id,value:decodeProject(value)};
    throw Error('Unknown project codec operation.');
  }catch(error){return {id,error:error.message};}
}
if(typeof self!=='undefined')self.onmessage=({data})=>self.postMessage(processProjectJob(data));
