import {sheetScale} from './stencil-geometry.mjs';

export const defaultLayout=()=>({mode:'single',axis:'x',orientation:'portrait',overlapMm:10,split:.5,activePiece:0,trimJoin:false});
export function sheetLayout(width,height,plan){
  const scale=sheetScale(width,height,plan.longEdgeInches),layout={...defaultLayout(),...plan.layout};
  if(layout.mode!=='pair'){
    const frame={x:-scale.marginX,y:-scale.marginY,width:scale.sheetWidthMm*scale.pxPerMm,height:scale.sheetHeightMm*scale.pxPerMm};
    return {...scale,layout,frames:[frame],frame,activePiece:0};
  }
  const sw=layout.orientation==='portrait'?290:590,sh=layout.orientation==='portrait'?590:290,p=scale.pxPerMm;
  const horizontal=layout.axis==='x',extent=horizontal?width:height,capacity=(horizontal?sw:sh)*p,overlap=layout.overlapMm*p;
  const min=Math.max(0,extent-capacity+overlap/2),max=Math.min(extent,capacity-overlap/2);
  const across=horizontal?height:width,acrossCapacity=(horizontal?sh:sw)*p;
  const fits=min<=max+1e-8&&across<=acrossCapacity+1e-8;
  // Keep an infeasible requested size visible; never shrink the artwork silently.
  const join=fits?Math.max(min,Math.min(max,extent*layout.split)):extent*layout.split;
  const perpendicular=(across-acrossCapacity)/2;
  const frames=horizontal?
    [{x:join+overlap/2-capacity,y:perpendicular,width:sw*p,height:sh*p},{x:join-overlap/2,y:perpendicular,width:sw*p,height:sh*p}]:
    [{x:perpendicular,y:join+overlap/2-capacity,width:sw*p,height:sh*p},{x:perpendicular,y:join-overlap/2,width:sw*p,height:sh*p}];
  const activePiece=layout.activePiece===1?1:0;
  const maxLongEdgeInches=Math.min((horizontal?2*sw-layout.overlapMm:sw)/width,(horizontal?sh:2*sh-layout.overlapMm)/height)*Math.max(width,height)/25.4;
  const stockBorderMm=((horizontal?sw:sh)===290?304.8-290:609.6-590)/2;
  return {...scale,layout,frames,frame:frames[activePiece],activePiece,fits,sheetWidthMm:sw,sheetHeightMm:sh,stockBorderMm,
    join,joinFraction:join/extent,minSplit:min/extent,maxSplit:max/extent,overlapPx:overlap,maxLongEdgeInches};
}
export function joinBorderBands(geometry){
  if(geometry.frames.length!==2||geometry.layout.trimJoin)return [];
  const [a,b]=geometry.frames,pad=geometry.stockBorderMm*geometry.pxPerMm;
  return geometry.layout.axis==='x'?
    [{x:b.x-pad,y:a.y,width:pad,height:a.height},{x:a.x+a.width,y:a.y,width:pad,height:a.height}]:
    [{x:a.x,y:b.y-pad,width:a.width,height:pad},{x:a.x,y:a.y+a.height,width:a.width,height:pad}];
}
export function fittedPair(width,height,plan){
  const preferred={...defaultLayout(),mode:'pair',axis:width>=height?'y':'x',orientation:width>=height?'landscape':'portrait'};
  const options=[preferred,...['portrait','landscape'].flatMap(orientation=>['x','y'].map(axis=>({...preferred,axis,orientation})))];
  return options.find(layout=>sheetLayout(width,height,{...plan,layout}).fits)||preferred;
}
export function bridgeOnPiece(bridge,plan,geometry,piece=geometry.activePiece){
  if(bridge.layer!==plan.activeLayer)return false;
  if(bridge.piece!==undefined)return bridge.piece===piece;
  if(geometry.frames.length===1)return true;
  const f=geometry.frames[piece],r=bridge.widthMm*geometry.pxPerMm/2;
  return Math.max(bridge.a.x,bridge.b.x)+r>=f.x&&Math.min(bridge.a.x,bridge.b.x)-r<=f.x+f.width&&Math.max(bridge.a.y,bridge.b.y)+r>=f.y&&Math.min(bridge.a.y,bridge.b.y)-r<=f.y+f.height;
}
export function offsetCutPath(d,dx,dy){
  let axis=0;
  return d.replace(/[MLQZ]|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi,token=>{
    if(/^[MLQZ]$/i.test(token)){axis=0;return token;}
    const value=Number(token)+(axis++%2?dy:dx);return `${value} `;
  });
}
export function assemblyOffset(geometry,piece=geometry.activePiece){
  const f=geometry.frames[piece],x=Math.min(...geometry.frames.map(f=>f.x)),y=Math.min(...geometry.frames.map(f=>f.y));
  return {xMm:(f.x-x)/geometry.pxPerMm,yMm:(f.y-y)/geometry.pxPerMm};
}

// One image scan builds row/column summaries. Sliding band sums then evaluate
// every feasible straight join without repeatedly scanning all image pixels.
export function suggestSheetJoin({width,height,treatments,alpha,plan}){
  const columns=new Float64Array(width),rows=new Float64Array(height),unknownX=new Float64Array(width),unknownY=new Float64Array(height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;if(!alpha[i])continue;
    if(treatments[i]>0){columns[x]++;rows[y]++;}
    else if(treatments[i]===-1){unknownX[x]++;unknownY[y]++;}
  }
  const prefix=values=>{const p=new Float64Array(values.length+1);for(let i=0;i<values.length;i++)p[i+1]=p[i]+values[i];return p;};
  const summaries={x:[prefix(columns),prefix(unknownX)],y:[prefix(rows),prefix(unknownY)]};
  let best=null;
  for(const orientation of ['portrait','landscape'])for(const axis of ['x','y']){
    const layout={...defaultLayout(),...plan.layout,mode:'pair',orientation,axis,activePiece:0},g=sheetLayout(width,height,{...plan,layout});
    if(!g.fits)continue;
    const extent=axis==='x'?width:height,[cuts,unknown]=summaries[axis],radius=g.overlapPx/2+(2+(layout.trimJoin?0:g.stockBorderMm))*g.pxPerMm;
    for(let join=Math.ceil(g.minSplit*extent);join<=Math.floor(g.maxSplit*extent);join++){
      const left=Math.max(0,Math.floor(join-radius)),right=Math.min(extent,Math.ceil(join+radius));
      const cutPixels=cuts[right]-cuts[left],unassignedPixels=unknown[right]-unknown[left];
      const score=cutPixels*100+unassignedPixels*10+Math.abs(join/extent-.5);
      if(!best||score<best.score)best={layout:{...layout,split:join/extent},score,cutPixels,unassignedPixels,clearanceMm:2};
    }
  }
  if(!best)throw Error('Artwork does not fit two working areas at this size. Reduce its long edge.');
  return best;
}
