import {suggestBridges} from './auto-bridges.mjs';
import {buildSheetGeometry} from './sheet-composition.mjs';
import {rasterizeCutPath,analyzeSheet,sheetScale} from './stencil-geometry.mjs';
self.onmessage=({data})=>{try{
 const {width,height,plan}=data,{paths,cutPath}=buildSheetGeometry(data);
 const cut=rasterizeCutPath(cutPath,width,height),scale=sheetScale(width,height,plan.longEdgeInches,plan.marginMm);
 const result=analyzeSheet(cut,width,height,plan.bridges.filter(b=>b.layer===plan.activeLayer),scale.pxPerMm,scale.margin);
 const suggestions=data.auto?suggestBridges(cut,width,height,result,scale.pxPerMm,scale.margin,plan.autoBridgeMaxMm??2,plan.autoBridgeMinMm??1.5):null;
 self.postMessage({...result,paths,cutPath,suggestions},[result.labels.buffer]);
}catch(error){self.postMessage({error:error.message});}};
