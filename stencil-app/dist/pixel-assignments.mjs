import {UNASSIGNED,UNBLEACHED} from './assignments.mjs';
export const INHERIT=-3;
// Region defaults plus pixel exceptions preserve original segmentation for undo.
export function createPixelAssignments(initial=[],paletteCount=0,labels=new Int32Array(),source=new Uint8ClampedArray()){
  const automatic=Int16Array.from(initial),values=new Int16Array(initial.length).fill(UNASSIGNED),overrides=new Int16Array(labels.length).fill(INHERIT),past=[],future=[];
  const inherited=i=>labels[i]>=0?values[labels[i]]:UNASSIGNED;
  const at=i=>overrides[i]===INHERIT?inherited(i):overrides[i];
  const normalize=to=>to===0?UNBLEACHED:to;
  const valid=to=>Number.isInteger(to)&&(to===UNASSIGNED||paletteCount>0&&(to===UNBLEACHED||to>0&&to<paletteCount));
  function apply(edit,forward){for(let i=0;i<edit.ids.length;i++){const array=edit.kind[i]?overrides:values;array[edit.ids[i]]=forward?edit.to[i]:edit.from[i];}}
  // Two scans keep large edits in compact typed arrays rather than millions of objects.
  function commit(nextValues,pixelValue){
    let count=0;
    for(let i=0;i<values.length;i++)if(values[i]!==nextValues[i])count++;
    for(let i=0;i<overrides.length;i++)if(overrides[i]!==pixelValue(i))count++;
    if(!count)return false;
    const edit={kind:new Uint8Array(count),ids:new Int32Array(count),from:new Int16Array(count),to:new Int16Array(count)};let pos=0;
    function record(kind,id,from,to){edit.kind[pos]=kind;edit.ids[pos]=id;edit.from[pos]=from;edit.to[pos++]=to;}
    for(let i=0;i<values.length;i++)if(values[i]!==nextValues[i])record(0,i,values[i],nextValues[i]);
    for(let i=0;i<overrides.length;i++){const to=pixelValue(i);if(overrides[i]!==to)record(1,i,overrides[i],to);}
    apply(edit,true);past.push(edit);future.length=0;return true;
  }
  function setMany(ids,to,{protect=false}={}){
    to=normalize(to);if(!valid(to))return false;
    const targets=new Set([...ids].filter(id=>Number.isInteger(id)&&id>=0&&id<values.length&&automatic[id]>=0)),nextValues=values.slice();
    for(const id of targets)if(!protect||values[id]===UNASSIGNED)nextValues[id]=to;
    return commit(nextValues,i=>{
      if(!targets.has(labels[i]))return overrides[i];
      const next=protect&&at(i)!==UNASSIGNED?at(i):to;
      return next===nextValues[labels[i]]?INHERIT:next;
    });
  }
  return {automatic,values,overrides,at,setMany,
    setTreatment(from,to){to=normalize(to);if(!valid(to)||from===UNASSIGNED)return false;
      const nextValues=Int16Array.from(values,v=>v===from?to:v);
      return commit(nextValues,i=>{const base=labels[i]>=0?nextValues[labels[i]]:UNASSIGNED,next=at(i)===from?to:at(i);return next===base?INHERIT:next;});
    },
    assignMask(mask,to){to=normalize(to);if(!valid(to)||mask.length!==labels.length)return false;
      return commit(values,i=>mask[i]&&source[i*4+3]?(to===inherited(i)?INHERIT:to):overrides[i]);
    },
    assignPixels(treatments){
      if(!(treatments instanceof Int16Array)||treatments.length!==labels.length)return false;
      for(let i=0;i<labels.length;i++)if(source[i*4+3]&&!valid(treatments[i]))return false;
      return commit(values,i=>source[i*4+3]?(treatments[i]===inherited(i)?INHERIT:treatments[i]):overrides[i]);
    },
    brush(ids,to){return setMany(ids,to,{protect:true});},
    undo(){const e=past.pop();if(!e)return false;apply(e,false);future.push(e);return true;},
    redo(){const e=future.pop();if(!e)return false;apply(e,true);past.push(e);return true;},
    get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
    get edited(){return past.length>0||future.length>0||values.some(v=>v!==UNASSIGNED)||overrides.some(v=>v!==INHERIT);}
  };
}
