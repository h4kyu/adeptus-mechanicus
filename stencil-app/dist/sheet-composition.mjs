import {traceBoundaries} from './boundary-vectors.mjs';

// Inclusion is direct and per sheet, not recursive: including sheet 2's treatment
// does not inherit sheet 2's own overlap choices or change any pixel assignment.
export function sheetLayers(plan,layer=plan.activeLayer){
 return [...new Set([layer,...(plan.sheetIncludes?.[layer]||[])])].sort((a,b)=>a-b);
}
export function buildSheetGeometry({treatments,alpha,width,height,recipe,plan,paths,cachedCutPath}){
 const options=recipe||{tolerance:0,preserveCorners:true};
 paths=paths||traceBoundaries(treatments,alpha,width,height,options).paths;
 const members=sheetLayers(plan);
 if(cachedCutPath!==undefined)return {paths,cutPath:cachedCutPath};
 if(members.length===1)return {paths,cutPath:paths.find(p=>p.treatment===plan.activeLayer)?.d||''};
 // Merge memberships before tracing so adjacent openings have no internal cut
// seams. Smooth the resulting union with the saved recipe at source resolution.
 const included=new Set(members),merged=Int16Array.from(treatments,t=>included.has(t)?1:-1);
 const cutPath=traceBoundaries(merged,alpha,width,height,options).paths.find(p=>p.treatment===1)?.d||'';
 return {paths,cutPath};
}
