import {buildSheetGeometry,sheetLayers} from './sheet-composition.mjs';
import {sheetScale} from './stencil-geometry.mjs';

export function buildPreviewSheets(data){
 const {width,height,plan,palette}=data,scale=sheetScale(width,height,plan.longEdgeInches);
 let paths=data.paths;
 const ids=new Set([...palette.slice(1).map((_,i)=>i+1),...plan.bridges.map(b=>b.layer),...Object.keys(plan.sheetIncludes||{}).map(Number)]);
 for(const t of data.treatments)if(t>0)ids.add(t);
 const cache={...data.sheetPaths},sheets=[],highest=Math.max(1,...ids);
 for(const layer of [...ids].sort((a,b)=>a-b)){
   const sheetPlan={...plan,activeLayer:layer},members=sheetLayers(sheetPlan),key=members.join(',');
   const geometry=buildSheetGeometry({...data,plan:sheetPlan,paths,cachedCutPath:cache[key]});paths=geometry.paths;cache[key]=geometry.cutPath;
   sheets.push({layer,members,cutPath:geometry.cutPath,bridges:plan.bridges.filter(b=>b.layer===layer&&b.enabled),level:highest===1?.8:.25+.75*(layer-1)/(highest-1)});
 }
 return {width,height,scale,sheets};
}
export function bleachColor(level){
 const low=[151,94,63],high=[244,221,183];return `rgb(${low.map((v,i)=>Math.round(v+(high[i]-v)*level)).join(',')})`;
}
const rect=(x,y,width,height,extra='')=>`<rect x="${x}" y="${y}" width="${width}" height="${height}" ${extra}/>`;
function bridgeLines(sheet,scale,color){return sheet.bridges.map(b=>`<line x1="${b.a.x}" y1="${b.a.y}" x2="${b.b.x}" y2="${b.b.y}" stroke="${color}" stroke-width="${b.widthMm*scale.pxPerMm}" stroke-linecap="round"/>`).join('');}
// The same vector opening and bridge capsules drive both views. A bridge is
// retained Mylar in the sheet view and blocks only its own bleach pass.
export function previewSvg(data,{mode='sheet',layer,enabled=data.sheets.map(s=>s.layer)}={}){
 const {width:w,height:h,scale,sheets}=data,mx=scale.marginX,my=scale.marginY,pad=Math.max(w,h)*.035;
 if(mode==='sheet'){
   const sheet=sheets.find(s=>s.layer===layer)||sheets[0];if(!sheet)return {body:'',viewBox:`0 0 ${w} ${h}`};
   const frame=rect(-mx,-my,w+2*mx,h+2*my,'fill="white"');
   const body=`<defs><mask id="preview-material" maskUnits="userSpaceOnUse" x="${-mx}" y="${-my}" width="${w+2*mx}" height="${h+2*my}">${frame}<path d="${sheet.cutPath}" fill="black" fill-rule="evenodd"/>${bridgeLines(sheet,scale,'white')}</mask></defs>`+
     rect(-mx-pad,-my-pad,w+2*mx+2*pad,h+2*my+2*pad,'fill="#26333c"')+
     rect(-mx,-my,w+2*mx,h+2*my,'fill="#dce6e9" mask="url(#preview-material)"')+
     rect(-mx,-my,w+2*mx,h+2*my,'fill="none" stroke="#f7fbfc" stroke-opacity=".6" stroke-width="1" vector-effect="non-scaling-stroke"');
   return {body,viewBox:`${-mx-pad} ${-my-pad} ${w+2*mx+2*pad} ${h+2*my+2*pad}`};
 }
 const shown=sheets.filter(s=>enabled.includes(s.layer)).sort((a,b)=>a.level-b.level||a.layer-b.layer);
 const defs=shown.map(s=>`<mask id="preview-pass-${s.layer}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">${rect(0,0,w,h,'fill="black"')}<path d="${s.cutPath}" fill="white" fill-rule="evenodd"/>${bridgeLines(s,scale,'black')}</mask>`).join('');
 // Strongest visible pass wins, instead of adding doses. This keeps overlap
// useful for simplifying stencils without pretending to model bleach chemistry.
 const body=`<defs>${defs}<pattern id="preview-weave" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 0H3M0 0V3" stroke="#fff" stroke-width=".35" opacity=".11"/><path d="M1.5 0V3" stroke="#000" stroke-width=".35" opacity=".15"/></pattern></defs>`+
 rect(0,0,w,h,'fill="#24282b"')+shown.map(s=>rect(0,0,w,h,`fill="${bleachColor(s.level)}" mask="url(#preview-pass-${s.layer})"`)).join('')+rect(0,0,w,h,'fill="url(#preview-weave)"');
 return {body,viewBox:`0 0 ${w} ${h}`};
}
