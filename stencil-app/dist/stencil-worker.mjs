import {buildSheetGeometry} from './sheet-composition.mjs';
import {analyzeLayoutSheet} from './panel-analysis.mjs';
import {sheetLayout} from './sheet-layout.mjs';
self.onmessage=({data})=>{try{
 const {width,height,plan}=data,g=sheetLayout(width,height,plan);
 if(!g.fits)throw Error(`Artwork exceeds ${g.frames.length===2?'two working areas':'the working area'}. Use a long edge of at most ${g.maxLongEdgeInches.toFixed(2)} inches for this layout.`);
 const {paths,cutPath}=buildSheetGeometry(data);
 const {result,suggestions}=analyzeLayoutSheet(cutPath,width,height,plan,data.auto);
 self.postMessage({...result,paths,cutPath,suggestions},[result.labels.buffer]);
}catch(error){self.postMessage({error:error.message});}};
