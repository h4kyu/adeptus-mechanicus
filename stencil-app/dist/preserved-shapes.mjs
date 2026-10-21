import {lassoMask} from './lasso.mjs';
import {quantize,toLab,toRGB} from './quantize.mjs';

export function validateShapes(shapes,width,height){
  if(!Array.isArray(shapes)||shapes.length>128)throw Error('Invalid preserved shapes.');
  const ids=new Set();
  for(const shape of shapes){
    if(typeof shape.id!=='string'||!shape.id||shape.id.length>100||ids.has(shape.id)||!Array.isArray(shape.points)||shape.points.length<3||shape.points.length>10000)throw Error('Invalid preserved shape.');
    ids.add(shape.id);
    if(shape.groupId!=null&&(typeof shape.groupId!=='string'||!shape.groupId||shape.groupId.length>100))throw Error('Invalid preserved color group.');
    if(shape.targetGroup!=null&&(!Number.isInteger(shape.targetGroup)||shape.targetGroup<0||shape.targetGroup>7||shape.groupId!=null||shape.paletteGroup!=null))throw Error('Invalid chosen color group.');
    if(shape.paletteGroup!=null&&(!Number.isInteger(shape.paletteGroup)||shape.paletteGroup<0||shape.paletteGroup>7||shape.groupId!=null))throw Error('Invalid automatic color group.');
    if(shape.holes!=null&&!Array.isArray(shape.holes))throw Error('Invalid preserved shape holes.');
    const rings=[shape.points,...(shape.holes||[])];
    if(rings.some(r=>!Array.isArray(r)||r.length<3)||rings.reduce((n,r)=>n+r.length,0)>10000)throw Error('Invalid preserved shape outline.');
    for(const ring of rings)for(const p of ring)if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>width||p.y>height)throw Error('Invalid preserved shape point.');
    if(shape.autoSelect!=null){const a=shape.autoSelect;if(!Number.isInteger(a.x)||!Number.isInteger(a.y)||a.x<0||a.y<0||a.x>=width||a.y>=height||!Number.isFinite(a.tolerance)||a.tolerance<0||a.tolerance>.4)throw Error('Invalid automatic shape seed.');}
  }
}

// Stable keys separate shared preserved groups from the automatic color slots.
// Legacy shapes each retain their own group until the user changes membership.
export const shapeGroupKey=shape=>shape.targetGroup!=null?`slot:${shape.targetGroup}`:shape.paletteGroup!=null?`auto:${shape.paletteGroup}`:`reserved:${shape.groupId||shape.id}`;
export const reservedGroupKeys=shapes=>[...new Set(shapes.filter(s=>s.paletteGroup==null&&s.targetGroup==null).map(shapeGroupKey))];
export function paletteGroupOptions(result,shapes=[]){
  if(result?.groupOptions)return result.groupOptions;
  const slots=new Map();
  for(const mapping of result?.shapeGroups||[]){const shape=shapes.find(s=>s.id===mapping.id);if(shape&&shape.paletteGroup==null&&shape.targetGroup==null&&mapping.group!=null)slots.set(mapping.group,shapeGroupKey(shape));}
  let automatic=0;
  return (result?.palette||[]).map((rgb,group)=>({rgb,group,key:slots.get(group)||`auto:${automatic++}`}));
}
export function validateShapeBudget(shapes,requested){
  const reserved=reservedGroupKeys(shapes).length,automatic=requested-reserved;
  if(!Number.isInteger(requested)||requested>8||automatic<1||shapes.some(s=>s.paletteGroup!=null&&s.paletteGroup>=automatic||s.targetGroup!=null&&s.targetGroup>=requested))throw Error('Keep at least one automatic group and all chosen automatic slots, plus preserved groups.');
}

export const shapeRings=shape=>[shape.points,...(shape.holes||[])];
export function preservedMask(shape,width,height,eligible=()=>true){
  const mask=new Uint8Array(width*height);
  for(const ring of shapeRings(shape)){
    const part=lassoMask(ring,width,height,eligible);
    for(let i=0;i<mask.length;i++)mask[i]^=part[i];
  }
  return mask;
}

// Later shapes own overlaps. Transparency is never part of a preserved shape.
export function shapeOwners(shapes,pixels,width,height){
  validateShapes(shapes,width,height);
  const owners=new Int16Array(width*height).fill(-1);
  shapes.forEach((shape,id)=>{
    const mask=preservedMask(shape,width,height,i=>pixels[i*4+3]>0);
    for(let i=0;i<mask.length;i++)if(mask[i])owners[i]=id;
  });
  return owners;
}

export function quantizeShapes(input,requested,shapes,width,height,original=input){
  if(!shapes?.length)return quantize(input,requested);
  validateShapeBudget(shapes,requested);
  const keys=reservedGroupKeys(shapes),automatic=requested-keys.length;
  const owners=shapeOwners(shapes,original,width,height),rest=new Uint8ClampedArray(input),protectedPixels=new Uint8Array(owners.length);
  const sums=new Map(keys.map(key=>[key,[0,0,0,0]]));
  for(let i=0;i<owners.length;i++)if(owners[i]>=0){
    rest[i*4+3]=0;protectedPixels[i]=1;
    const sum=sums.get(shapeGroupKey(shapes[owners[i]]));if(!sum)continue;
    const a=original[i*4+3],lab=toLab(...original.subarray(i*4,i*4+3));
    sum[3]+=a;for(let c=0;c<3;c++)sum[c]+=lab[c]*a;
  }
  const auto=quantize(rest,automatic);
  const lastTarget=Math.max(-1,...shapes.map(s=>s.paletteGroup??-1));
  if(auto.palette.length<=lastTarget){
    const fallback=quantize(input,automatic).palette;
    while(auto.palette.length<=lastTarget)auto.palette.push(fallback[auto.palette.length]||fallback.at(-1)||[128,128,128]);
  }
  const entries=auto.palette.map((rgb,id)=>({rgb,key:`auto:${id}`,L:toLab(...rgb)[0]}));
  for(const [key,s]of sums)if(s[3]){const lab=s.slice(0,3).map(v=>v/s[3]);entries.push({rgb:toRGB(lab),key,L:lab[0]});}
  entries.sort((a,b)=>a.L-b.L);
  // Explicit choices refer to final numbered palette slots, never a fitting rank.
  // Even a flat image must retain a referenced slot instead of changing the choice.
  const lastSlot=Math.max(-1,...shapes.map(s=>s.targetGroup??-1));
  while(entries.length<=lastSlot){const rgb=entries.at(-1)?.rgb||[128,128,128];entries.push({rgb,key:`padding:${entries.length}`,L:toLab(...rgb)[0]});}
  const ids=new Map(entries.map((entry,id)=>[entry.key,id])),preservedGroups=[];
  entries.forEach((entry,id)=>{if(entry.key.startsWith('reserved:'))preservedGroups.push(id);});
  const labels=new Int16Array(owners.length).fill(-1);
  for(let i=0;i<labels.length;i++)if(original[i*4+3])labels[i]=owners[i]>=0&&shapes[owners[i]].targetGroup!=null?shapes[owners[i]].targetGroup:ids.get(owners[i]>=0?shapeGroupKey(shapes[owners[i]]):`auto:${auto.labels[i]}`)??-1;
  return {palette:entries.map(e=>e.rgb),labels,preservedGroups,protectedPixels,
    groupOptions:entries.map((e,group)=>({key:e.key,group,rgb:e.rgb})),
    shapeGroups:shapes.map(s=>({id:s.id,group:s.targetGroup??ids.get(shapeGroupKey(s))??null}))};
}
