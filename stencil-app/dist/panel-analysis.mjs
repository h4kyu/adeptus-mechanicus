import {analyzeSheet,rasterizeCutPath} from './stencil-geometry.mjs';
import {sheetLayout,bridgeOnPiece,offsetCutPath} from './sheet-layout.mjs';
import {suggestBridges} from './auto-bridges.mjs';

export function analyzeLayoutSheet(cutPath,width,height,plan,auto=false){
  const geometry=sheetLayout(width,height,plan),{frame,pxPerMm}=geometry;
  if(!geometry.fits)throw Error(`Artwork exceeds ${geometry.frames.length===2?'two working areas':'the working area'}. Use a long edge of at most ${geometry.maxLongEdgeInches.toFixed(2)} inches for this layout.`);
  const bridges=plan.bridges.filter(b=>bridgeOnPiece(b,plan,geometry));
  if(geometry.frames.length===1){
    const cut=rasterizeCutPath(cutPath,width,height),result=analyzeSheet(cut,width,height,bridges,pxPerMm,geometry);
    const suggestions=auto?suggestBridges(cut,width,height,result,pxPerMm,geometry.margin,plan.autoBridgeMaxMm??2,plan.autoBridgeMinMm??1.5):null;
    return {result,suggestions};
  }
  const w=Math.ceil(frame.width),h=Math.ceil(frame.height);
  // Full native-scale stock bounds are needed: clipping artwork first could
  // incorrectly join retained components across an edge that is actually cut.
  if(w*h>12000000)throw Object.assign(Error('Native-resolution connectivity exceeds the 12-million-pixel working-area limit at this scale. Artwork resolution is unchanged; vector export remains available.'),{code:'SHEET_ANALYSIS_LIMIT'});
  const cut=rasterizeCutPath(offsetCutPath(cutPath,-frame.x,-frame.y),w,h);
  const local=bridges.map(b=>({...b,a:{x:b.a.x-frame.x,y:b.a.y-frame.y},b:{x:b.b.x-frame.x,y:b.b.y-frame.y}}));
  const analysis=analyzeSheet(cut,w,h,local,pxPerMm,0,{physicalFrame:true});
  const labels=new Int32Array(width*height).fill(-1);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=x+.5-frame.x,v=y+.5-frame.y;
    if(u>=0&&v>=0&&u<frame.width&&v<frame.height)labels[y*width+x]=analysis.labels[Math.floor(v)*w+Math.floor(u)];
  }
  const islands=analysis.islands.map(island=>({...island,bounds:[island.bounds[0]+frame.x,island.bounds[1]+frame.y,island.bounds[2]+frame.x,island.bounds[3]+frame.y]}));
  const suggestions=auto?suggestBridges(cut,w,h,analysis,pxPerMm,0,plan.autoBridgeMaxMm??2,plan.autoBridgeMinMm??1.5).map(b=>({...b,piece:geometry.activePiece,a:{x:b.a.x+frame.x,y:b.a.y+frame.y},b:{x:b.b.x+frame.x,y:b.b.y+frame.y}})):null;
  return {result:{...analysis,labels,islands},suggestions};
}
