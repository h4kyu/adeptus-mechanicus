import {UNASSIGNED} from './assignments.mjs';
// Keep source regions intact for undo; derive the visible union from treatments.
export function selectionRegions(values,selected,individual=false){
  if(selected<0||selected>=values.length)return [];
  const treatment=values[selected];
  if(individual||treatment===UNASSIGNED)return [selected];
  const ids=[];for(let id=0;id<values.length;id++)if(values[id]===treatment)ids.push(id);
  return ids;
}
export function assignmentEdges(labels,values,width,height,source){
  const edges=new Uint8Array(labels.length);
  const same=(i,j)=>{
    if(j<0||j>=labels.length||!source[j*4+3]||labels[j]<0)return false;
    const a=labels[i],b=labels[j];return a===b||(values[a]!==UNASSIGNED&&values[a]===values[b]);
  };
  for(let i=0;i<labels.length;i++){
    if(labels[i]<0||!source[i*4+3])continue;
    const x=i%width,y=Math.floor(i/width);
    edges[i]=Number(x===0||y===0||x===width-1||y===height-1||!same(i,i-1)||!same(i,i+1)||!same(i,i-width)||!same(i,i+width));
  }
  return edges;
}
