import {UNASSIGNED} from './assignments.mjs';
// Keep source regions intact for undo; derive the visible union from treatments.
export function selectionRegions(values,selected,individual=false){
  if(selected<0||selected>=values.length)return [];
  const treatment=values[selected];
  if(individual||treatment===UNASSIGNED)return [selected];
  const ids=[];for(let id=0;id<values.length;id++)if(values[id]===treatment)ids.push(id);
  return ids;
}
export function assignmentEdges(labels,values,width,height,source,overrides){
  const edges=new Uint8Array(labels.length);
  const at=i=>overrides&&overrides[i]!==-3?overrides[i]:labels[i]>=0?values[labels[i]]:UNASSIGNED;
  const visible=i=>source[i*4+3]&&(labels[i]>=0||at(i)!==UNASSIGNED);
  const same=(i,j)=>{
    if(j<0||j>=labels.length||!visible(j))return false;
    const a=labels[i],b=labels[j];return at(i)===at(j)&&(at(i)!==UNASSIGNED||a===b);
  };
  for(let i=0;i<labels.length;i++){
    if(!visible(i))continue;
    const x=i%width,y=Math.floor(i/width);
    edges[i]=Number(x===0||y===0||x===width-1||y===height-1||!same(i,i-1)||!same(i,i+1)||!same(i,i-width)||!same(i,i+width));
  }
  return edges;
}
