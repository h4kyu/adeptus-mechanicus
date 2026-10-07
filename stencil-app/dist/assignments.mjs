export const UNASSIGNED=-1, UNBLEACHED=-2;
// Palette IDs describe treatment only; the segmentation labels remain unchanged.
export function createAssignments(initial=[],paletteCount=0) {
  const automatic=Int16Array.from(initial),values=new Int16Array(automatic.length).fill(UNASSIGNED),past=[],future=[];
  function apply(changes,forward){for(const c of changes)values[c.id]=forward?c.to:c.from;}
  function setMany(ids,to) {
    if(to===0)to=UNBLEACHED; // The darkest quantization slot is the unbleached treatment.
    if(!Number.isInteger(to)||(to!==UNBLEACHED&&to!==UNASSIGNED&&(to<0||to>=paletteCount)))return false;
    const changes=[];
    for(const id of new Set(ids))if(Number.isInteger(id)&&id>=0&&id<values.length&&automatic[id]>=0&&values[id]!==to)changes.push({id,from:values[id],to});
    if(!changes.length)return false;
    apply(changes,true);past.push(changes);future.length=0;return true;
  }
  return {values,automatic,setMany,
    brush(ids,to){return setMany([...ids].filter(id=>values[id]===UNASSIGNED),to);},
    set(id,to){return setMany([id],to);},
    restore(id){return setMany([id],UNASSIGNED);},
    undo(){const c=past.pop();if(!c)return false;apply(c,false);future.push(c);return true;},
    redo(){const c=future.pop();if(!c)return false;apply(c,true);past.push(c);return true;},
    get canUndo(){return past.length>0;},get canRedo(){return future.length>0;},
    get edited(){return past.length>0||future.length>0||values.some(v=>v!==UNASSIGNED);}
  };
}

export function treatmentGroups(palette){return palette.map((rgb,id)=>({value:id===0?UNBLEACHED:id,label:id===0?'Unbleached':`Intensity ${id}`,rgb}));}
