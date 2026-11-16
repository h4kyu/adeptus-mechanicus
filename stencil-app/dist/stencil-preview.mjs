import {buildSheetGeometry,sheetLayers} from './sheet-composition.mjs';
import {sheetLayout,bridgeOnPiece,joinBorderBands} from './sheet-layout.mjs';

export function buildPreviewSheets(data){
 const {width,height,plan,palette}=data,scale=sheetLayout(width,height,plan);
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
function bridgeLines(sheet,scale,color,piece=null){return sheet.bridges.filter(b=>piece!==null?bridgeOnPiece(b,{activeLayer:sheet.layer},scale,piece):scale.frames.length===2||b.piece!==1).map(b=>`<line x1="${b.a.x}" y1="${b.a.y}" x2="${b.b.x}" y2="${b.b.y}" stroke="${color}" stroke-width="${b.widthMm*scale.pxPerMm}" stroke-linecap="round"${piece===null&&scale.frames.length===2&&b.piece!==undefined?` clip-path="url(#preview-bridge-frame-${b.piece})"`:''}/>`).join('');}
// The same vector opening and bridge capsules drive both views. A bridge is
// retained Mylar in the sheet view and blocks only its own bleach pass.
export function previewSvg(data,{mode='sheet',layer,piece=data.scale.activePiece,enabled=data.sheets.map(s=>s.layer)}={}){
 const {width:w,height:h,scale,sheets}=data,mx=scale.marginX,my=scale.marginY,pad=Math.max(w,h)*.035;
 if(mode==='sheet'){
   const sheet=sheets.find(s=>s.layer===layer)||sheets[0];if(!sheet)return {body:'',viewBox:`0 0 ${w} ${h}`};
   const f=scale.frames[piece]||scale.frames[0],frame=rect(f.x,f.y,f.width,f.height,'fill="white"');
   const body=`<defs><mask id="preview-material" maskUnits="userSpaceOnUse" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}">${frame}<path d="${sheet.cutPath}" fill="black" fill-rule="evenodd"/>${bridgeLines(sheet,scale,'white',piece)}</mask></defs>`+
     rect(f.x-pad,f.y-pad,f.width+2*pad,f.height+2*pad,'fill="#26333c"')+
     rect(f.x,f.y,f.width,f.height,'fill="#dce6e9" mask="url(#preview-material)"')+
     rect(f.x,f.y,f.width,f.height,'fill="none" stroke="#f7fbfc" stroke-opacity=".6" stroke-width="1" vector-effect="non-scaling-stroke"');
   return {body,viewBox:`${f.x-pad} ${f.y-pad} ${f.width+2*pad} ${f.height+2*pad}`};
 }
 const shown=sheets.filter(s=>enabled.includes(s.layer)).sort((a,b)=>a.level-b.level||a.layer-b.layer);
 const borders=joinBorderBands(scale).map(b=>rect(b.x,b.y,b.width,b.height,'fill="black"')).join('');
 const defs=shown.map(s=>`<mask id="preview-pass-${s.layer}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">${rect(0,0,w,h,'fill="black"')}<path d="${s.cutPath}" fill="white" fill-rule="evenodd"/>${bridgeLines(s,scale,'black')}${borders}</mask>`).join('');
 // Strongest visible pass wins, instead of adding doses. This keeps overlap
// useful for simplifying stencils without pretending to model bleach chemistry.
 const clips=scale.frames.length===2?scale.frames.map((f,i)=>`<clipPath id="preview-bridge-frame-${i}">${rect(f.x,f.y,f.width,f.height)}</clipPath>`).join(''):'';
 const body=`<defs>${clips}${defs}<pattern id="preview-weave" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 0H3M0 0V3" stroke="#fff" stroke-width=".35" opacity=".11"/><path d="M1.5 0V3" stroke="#000" stroke-width=".35" opacity=".15"/></pattern></defs>`+
 rect(0,0,w,h,'fill="#24282b"')+shown.map(s=>rect(0,0,w,h,`fill="${bleachColor(s.level)}" mask="url(#preview-pass-${s.layer})"`)).join('')+rect(0,0,w,h,'fill="url(#preview-weave)"');
 return {body,viewBox:`0 0 ${w} ${h}`};
}
