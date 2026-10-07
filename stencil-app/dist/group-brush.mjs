// Test pixel centers against the swept disk (a capsule), so fast pointer moves
// cannot skip narrow regions between browser pointer events.
export function collectBrushRegions({labels,width,height,from,to,radius,eligible},hits=new Set()) {
  const dx=to.x-from.x,dy=to.y-from.y,length2=dx*dx+dy*dy;
  const left=Math.max(0,Math.floor(Math.min(from.x,to.x)-radius)),right=Math.min(width-1,Math.ceil(Math.max(from.x,to.x)+radius));
  const top=Math.max(0,Math.floor(Math.min(from.y,to.y)-radius)),bottom=Math.min(height-1,Math.ceil(Math.max(from.y,to.y)+radius));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const t=length2?Math.max(0,Math.min(1,((x+.5-from.x)*dx+(y+.5-from.y)*dy)/length2)):0;
    if((x+.5-from.x-t*dx)**2+(y+.5-from.y-t*dy)**2>radius*radius)continue;
    const id=labels[y*width+x];if(id>=0&&!hits.has(id)&&eligible(id))hits.add(id);
  }
  return hits;
}
