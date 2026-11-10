// Investigation prototype only: the editor does not import this module.
import {validateProject} from '../projects.mjs';
const types={Uint8Array,Uint8ClampedArray,Int16Array,Int32Array,Float32Array};
export function decodeProjectFast(text){
  function restore(value){
    if(!value||typeof value!=='object')return value;
    if(value.$array){
      if(!Object.hasOwn(types,value.$array)||typeof value.data!=='string')throw Error('Invalid project array.');
      let bytes;
      if(typeof Uint8Array.fromBase64==='function')bytes=Uint8Array.fromBase64(value.data);
      else {const binary=atob(value.data);bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);}
      return new types[value.$array](bytes.buffer);
    }
    if(Array.isArray(value))return value.map(restore);
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,restore(item)]));
  }
  const project=restore(JSON.parse(text));validateProject(project);return project;
}
