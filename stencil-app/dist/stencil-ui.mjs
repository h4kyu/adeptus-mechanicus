import {setupStencilPreview} from './stencil-preview-ui.mjs';
import {setupStencilExport} from './stencil-export-ui.mjs';
import {sheetLayers} from './sheet-composition.mjs';
import {newStencilPlan,createBridgeHistory} from './stencil-plan.mjs';
import {sheetScale,pointSegmentDistance} from './stencil-geometry.mjs';
export function setupStencil({read,repaint,onSave,beforeSheet,onAssignIsland}){
 const $=id=>document.getElementById(id),svg=$('assign-stencil'),islandCanvas=$('assign-islands'),outline=$('assign-outline'),surface=$('assign-surface'),viewport=$('canvas-viewport'),ns='http://www.w3.org/2000/svg';
 let plan=newStencilPlan(),history=createBridgeHistory(),result=null,paths=null,sheetPaths={},worker=null,timer=null,generation=0,selected=null,selectedIsland=0,drag=null,adding=false,layerSignature='',missing=0,revision=0,autoBusy=false;
 const mode=()=>viewport.dataset.tool==='bridge',visible=t=>!plan.hiddenLayers.includes(t),chosen=()=>plan.bridges.find(b=>b.id===selected),scale=()=>{const s=read();return s?sheetScale(s.width,s.height,plan.longEdgeInches):null;};
 function element(name,attrs){const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
 function save(){onSave();}
 function bridgeList(){const list=$('bridge-list');list.replaceChildren();for(const b of plan.bridges.filter(b=>b.layer===plan.activeLayer)){
   const button=document.createElement('button'),status=result?.bridgeStatus.find(s=>s.id===b.id);button.dataset.bridge=b.id;button.setAttribute('aria-pressed',String(b.id===selected));button.textContent=`Bridge ${list.children.length+1} · ${b.widthMm} mm${!b.enabled?' · off':status?.reason?' · review':''}`;list.append(button);
 }}
 function layers(){const s=read(),palette=s?.palette||[],signature=JSON.stringify([palette,plan.activeLayer,plan.hiddenLayers,plan.sheetIncludes]);if(signature===layerSignature)return;layerSignature=signature;
   $('stencil-layers').replaceChildren();const values=[-1,-2,...palette.slice(1).map((_,i)=>i+1)];
   for(const value of values){const row=document.createElement('div');row.className='stencil-layer';const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=visible(value);input.dataset.layer=value;input.setAttribute('aria-label',value===-1?'Show unassigned':value===-2?'Show unbleached':`Show Intensity ${value}`);label.append(input);row.append(label);
     const button=document.createElement('button');button.textContent=value===-1?'Unassigned':value===-2?'Unbleached':`Intensity ${value}`;button.dataset.activeLayer=value;button.disabled=value<1;button.setAttribute('aria-pressed',String(plan.activeLayer===value));row.append(button);$('stencil-layers').append(row);
   }
   $('stencil-active').replaceChildren();const ids=new Set([...palette.slice(1).map((_,i)=>i+1),...plan.bridges.map(b=>b.layer),plan.activeLayer,...Object.keys(plan.sheetIncludes).map(Number),...Object.values(plan.sheetIncludes).flat()]);if(!ids.size)ids.add(1);
   for(const id of [...ids].sort((a,b)=>a-b)){const option=document.createElement('option');option.value=id;option.textContent=`Intensity ${id}${sheetLayers(plan,id).length>1?` (+ ${plan.sheetIncludes[id].join(', ')})`:''}${id>=palette.length?' (no assigned palette slot)':''}`;$('stencil-active').append(option);}$('stencil-active').value=plan.activeLayer;
   $('stencil-includes').replaceChildren();
   for(const id of [...ids].sort((a,b)=>a-b)){if(id===plan.activeLayer)continue;const label=document.createElement('label'),input=document.createElement('input');label.className='check';input.type='checkbox';input.dataset.includeLayer=id;input.checked=sheetLayers(plan).includes(id);label.append(input,document.createTextNode(`Intensity ${id}${id>=palette.length?' (retired)':''}`));$('stencil-includes').append(label);}
   $('stencil-separate').disabled=sheetLayers(plan).length===1;
   $('stencil-composition').textContent=`Cuts ${sheetLayers(plan).map(id=>`Intensity ${id}`).join(' + ')}. Assignment stays Intensity ${plan.activeLayer}.`;

 }
 function controls(){const s=read(),b=chosen(),ready=!!s;layers();
   for(const id of ['bridge-add','stencil-show','stencil-active','stencil-preview-open','stencil-export-open'])$(id).disabled=!ready;
   $('bridge-auto').disabled=!ready||!result?.islands.length||autoBusy;$('bridge-auto').textContent=autoBusy?'Finding bridges…':`Auto bridge · ${plan.autoBridgeMinMm}–${plan.autoBridgeMaxMm} mm`;
   for(const [id,key] of [['bridge-auto-min','autoBridgeMinMm'],['bridge-auto-max','autoBridgeMaxMm']])if(document.activeElement!==$(id))$(id).value=plan[key];
   $('bridge-add').setAttribute('aria-pressed',String(adding));$('bridge-add').textContent=adding?'Stop drawing bridges':'Add bridge';if(document.activeElement!==$('bridge-width'))$('bridge-width').value=b?b.widthMm:plan.bridgeWidthMm;
   $('bridge-enabled').checked=b?b.enabled:true;$('bridge-enabled').disabled=!b;$('bridge-delete').disabled=!b;$('bridge-review').disabled=!b||!b.needsReview;
   $('bridge-reset').disabled=!autoBusy&&!plan.bridges.some(b=>b.layer===plan.activeLayer);
   $('bridge-undo').disabled=!history.canUndo;$('bridge-redo').disabled=!history.canRedo;
   $('island-next').disabled=!result?.islands.length;$('island-assign').disabled=!result?.islands.some(i=>i.id===selectedIsland)||!ready;
   $('stencil-show').checked=plan.showSheet;$('stencil-islands').checked=plan.showIslands;if(document.activeElement!==$('stencil-size'))$('stencil-size').value=plan.longEdgeInches;
   if(s){const metric=scale();$('stencil-dimensions').textContent=`Artwork ${metric.widthInches.toFixed(2)} × ${metric.heightInches.toFixed(2)} in · working area ${metric.sheetWidthMm} × ${metric.sheetHeightMm} mm. ${metric.fits?'Artwork centered; surrounding Mylar stays intact.':`Too large: use a long edge of at most ${metric.maxLongEdgeInches.toFixed(2)} in.`}`;}
   const status=b&&result?.bridgeStatus.find(item=>item.id===b.id);$('bridge-selection').textContent=adding?'Drag to draw bridges repeatedly. Press Escape to stop.':b?status?.reason||'Bridge selected. Drag its ends or center to edit.':'Select a bridge or a highlighted island. Assign tools remain available.';
   bridgeList();
 }
 function paint(){const s=read(),show=!!s&&plan.showSheet;surface.classList.toggle('sheet-preview',show);svg.toggleAttribute('hidden',!show);islandCanvas.hidden=!show||!plan.showIslands||!result;
   if(!s)return;svg.setAttribute('viewBox',`0 0 ${s.width} ${s.height}`);svg.replaceChildren();const metric=scale(),mx=metric.marginX,my=metric.marginY;
   if(show){svg.append(element('rect',{x:-mx,y:-my,width:s.width+2*mx,height:s.height+2*my,fill:'transparent'}));const defs=element('defs',{}),mask=element('mask',{id:'stencil-material',maskUnits:'userSpaceOnUse',x:-mx,y:-my,width:s.width+2*mx,height:s.height+2*my});mask.append(element('rect',{x:-mx,y:-my,width:s.width+2*mx,height:s.height+2*my,fill:'white'}));
     if(result?.cutPath)mask.append(element('path',{d:result.cutPath,fill:'black','fill-rule':'evenodd'}));
     for(const b of plan.bridges.filter(b=>b.layer===plan.activeLayer&&b.enabled))mask.append(element('line',{x1:b.a.x,y1:b.a.y,x2:b.b.x,y2:b.b.y,stroke:'white','stroke-width':b.widthMm*metric.pxPerMm,'stroke-linecap':'round'}));defs.append(mask);svg.append(defs);
     svg.append(element('rect',{x:-mx,y:-my,width:s.width+2*mx,height:s.height+2*my,fill:'#f2eee1',opacity:.83,mask:'url(#stencil-material)'}));
     svg.append(element('rect',{x:-mx,y:-my,width:s.width+2*mx,height:s.height+2*my,fill:'none',stroke:'#64746b','stroke-width':1,'stroke-dasharray':'5 4','vector-effect':'non-scaling-stroke'}));
     for(const path of paths||[])if(!sheetLayers(plan).includes(path.treatment)&&visible(path.treatment))svg.append(element('path',{d:path.d,fill:path.treatment===-2?'#526577':`rgb(${s.palette[path.treatment]?.join(',')||'140,140,140'})`,opacity:.14,'fill-rule':'evenodd'}));
     if(result?.cutPath&&visible(plan.activeLayer))svg.append(element('path',{d:result.cutPath,fill:'none',stroke:'#239baf','stroke-width':1,'vector-effect':'non-scaling-stroke'}));
     const screenScale=outline.width/Math.max(1,outline.getBoundingClientRect().width);
     for(const b of plan.bridges.filter(b=>b.layer===plan.activeLayer&&visible(b.layer))){const status=result?.bridgeStatus.find(item=>item.id===b.id),color=b.id===selected?'#126bbb':status?.reason||b.needsReview?'#bf6c23':'#2b8662';
       svg.append(element('line',{x1:b.a.x,y1:b.a.y,x2:b.b.x,y2:b.b.y,stroke:color,'stroke-width':b.widthMm*metric.pxPerMm,'stroke-linecap':'round',opacity:b.enabled?.65:.25}));
       if(mode()&&b.id===selected)for(const p of [b.a,b.b])svg.append(element('circle',{cx:p.x,cy:p.y,r:5*screenScale,fill:'white',stroke:color,'stroke-width':1.5,'vector-effect':'non-scaling-stroke'}));
     }
   }
   if(result&&!islandCanvas.hidden){islandCanvas.width=s.width;islandCanvas.height=s.height;const ctx=islandCanvas.getContext('2d'),image=ctx.createImageData(s.width,s.height);for(let i=0;i<result.labels.length;i++)if(result.labels[i]>0)image.data.set(result.labels[i]===selectedIsland?[255,184,30,165]:[220,65,92,120],i*4);ctx.putImageData(image,0,0);}
 }
 function stop(){autoBusy=false;generation++;clearTimeout(timer);timer=null;worker?.terminate();worker=null;}
 function analyze(auto=false){stop();const s=read();if(!s||!plan.showSheet){controls();paint();return;}autoBusy=auto;const current=generation;result=null;selectedIsland=0;$('stencil-status').textContent=auto?'Finding short bridges…':'Checking active sheet…';paint();
   if(!paths)sheetPaths={};const key=sheetLayers(plan).join(','),cachedCutPath=sheetPaths[key],needsSource=!paths||cachedCutPath===undefined;
   const n=s.width*s.height,treatments=needsSource?new Int16Array(n):null,alpha=needsSource?new Uint8Array(n):null;missing=0;
   for(let i=0;i<n;i++){const value=s.at(i);if(s.source[i*4+3]&&value===-1)missing++;if(treatments){treatments[i]=value;alpha[i]=s.source[i*4+3];}}
   try{worker=new Worker(new URL('./stencil-worker.mjs',import.meta.url),{type:'module'});
     worker.onmessage=({data})=>{if(generation!==current)return;worker.terminate();worker=null;autoBusy=false;if(data.error){$('stencil-status').textContent=`Sheet check failed: ${data.error}`;controls();return;}result=data;paths=data.paths;sheetPaths[key]=data.cutPath;
       if(auto){const suggestions=data.suggestions||[];const narrow=suggestions.filter(b=>b.widthMm<2).length;$('bridge-auto-status').textContent=suggestions.length?`Added ${suggestions.length} editable ${suggestions.length===1?'bridge':'bridges'} as one undo step.${narrow?` ${narrow} below 2 mm; check strength before cutting.`:''}`:'No suitable connections within these width limits. Remaining islands need manual review.';
         if(suggestions.length){const before=structuredClone(plan.bridges);plan.bridges.push(...suggestions.map(b=>({...b,id:crypto.randomUUID(),layer:plan.activeLayer})));selected=null;commit(before);return;}}

       const reviews=data.bridgeStatus.filter(b=>b.reason&&b.reason!=='Disabled').length;
       $('stencil-status').textContent=`${data.islands.length} disconnected ${data.islands.length===1?'island':'islands'} · ${reviews} bridges to review.${data.ignoredIslands?` ${data.ignoredIslands} single-pixel ${data.ignoredIslands===1?'island':'islands'} ignored.`:''}${!data.cutPixels?' No openings remain on this sheet.':''}${missing?` ${missing.toLocaleString()} unassigned pixels remain closed.`:''} Connectivity checked at original pixel resolution.`;controls();paint();};
     worker.onerror=()=>{if(current===generation){stop();controls();$('stencil-status').textContent='Could not check this sheet. Try showing it again.';}};
     worker.postMessage({width:s.width,height:s.height,treatments,alpha,paths,recipe:s.recipe,plan,auto,cachedCutPath},needsSource?[treatments.buffer,alpha.buffer]:[]);
   }catch(error){autoBusy=false;$('stencil-status').textContent=`Sheet check failed: ${error.message}`;}controls();
 }
 function schedule(){stop();result=null;selectedIsland=0;paint();controls();if(plan.showSheet)timer=setTimeout(analyze,180);}
 function invalidate(review=true){cancel();$('bridge-auto-status').textContent='';paths=null;if(review){revision++;for(const b of plan.bridges)b.needsReview=true;}schedule();}
 function activate(){plan.hiddenLayers=plan.hiddenLayers.filter(t=>t!==plan.activeLayer);plan.showSheet=true;beforeSheet();$('stencil-island').open=true;schedule();save();}
 function setLayer(value){cancel();$('bridge-auto-status').textContent='';plan.activeLayer=Number(value);selected=null;adding=false;activate();}
 function commit(before){if(history.commit({bridges:before,revision},{bridges:plan.bridges,revision})){schedule();save();}else{controls();paint();}}
 function edit(fn){const before=structuredClone(plan.bridges);fn();commit(before);}
 function point(e){const rect=outline.getBoundingClientRect(),s=read(),metric=scale(),mx=Math.max(0,metric.marginX),my=Math.max(0,metric.marginY);return {x:Math.max(-mx,Math.min(s.width+mx,(e.clientX-rect.left)*s.width/rect.width)),y:Math.max(-my,Math.min(s.height+my,(e.clientY-rect.top)*s.height/rect.height))};}
 function cancel(){if(autoBusy){stop();schedule();}if(drag){plan.bridges=drag.before;drag=null;}adding=false;controls();paint();}
 function undo(redo=false){cancel();const restored=redo?history.redo({bridges:plan.bridges,revision}):history.undo({bridges:plan.bridges,revision});if(restored){plan.bridges=restored.bridges;if(restored.revision!==revision)for(const b of plan.bridges)b.needsReview=true;selected=null;schedule();save();}}
 function pointerDown(e){
   if(autoBusy||!mode()||!plan.showSheet||!read()||e.button!==0||!e.isPrimary)return;e.preventDefault();e.stopImmediatePropagation();const p=point(e),factor=outline.width/Math.max(1,outline.getBoundingClientRect().width),radius=9*factor;
   const before=structuredClone(plan.bridges);let b=chosen(),part=null;
   if(!adding){
     if(b&&b.layer===plan.activeLayer)for(const end of ['a','b'])if(Math.hypot(p.x-b[end].x,p.y-b[end].y)<=radius)part=end;
     if(!part){b=[...plan.bridges].reverse().find(item=>item.layer===plan.activeLayer&&visible(item.layer)&&pointSegmentDistance(p,item.a,item.b)<=Math.max(radius,item.widthMm*scale().pxPerMm/2));if(b)part='move';}
   }
   if(adding){b={id:crypto.randomUUID(),layer:plan.activeLayer,a:p,b:p,widthMm:plan.bridgeWidthMm,enabled:true,needsReview:false};plan.bridges.push(b);part='b';}
   if(!b||!part){selected=null;const i=Math.floor(p.y)*read().width+Math.floor(p.x);selectedIsland=p.x>=0&&p.y>=0&&p.x<read().width&&p.y<read().height?Math.max(0,result?.labels[i]||0):0;controls();paint();return;}
   selected=b.id;drag={pointer:e.pointerId,before,start:p,original:structuredClone(b),part,created:adding};outline.setPointerCapture(e.pointerId);controls();paint();
 }
 outline.addEventListener('pointerdown',pointerDown);svg.addEventListener('pointerdown',pointerDown);
 outline.addEventListener('pointermove',e=>{if(drag?.pointer!==e.pointerId)return;e.stopImmediatePropagation();const p=point(e),b=chosen();if(drag.part==='move'){const dx=p.x-drag.start.x,dy=p.y-drag.start.y;for(const end of ['a','b'])b[end]={x:drag.original[end].x+dx,y:drag.original[end].y+dy};}else b[drag.part]=p;b.needsReview=false;paint();});
 outline.addEventListener('pointerup',e=>{if(drag?.pointer!==e.pointerId)return;e.stopImmediatePropagation();const completed=drag,b=chosen();drag=null;if(completed.created)selected=null;if(Math.hypot(b.a.x-b.b.x,b.a.y-b.b.y)<.1)plan.bridges=completed.before;commit(completed.before);});
 for(const name of ['pointercancel','lostpointercapture'])outline.addEventListener(name,()=>{if(drag)cancel();});
 viewport.addEventListener('canvas-navigation',()=>{if(drag)cancel();});
 viewport.addEventListener('canvas-tool-change',()=>{if(mode()&&!plan.showSheet)activate();if(!mode())cancel();else{controls();paint();}});
 viewport.addEventListener('canvas-deselect',()=>{selected=null;selectedIsland=0;paint();controls();});
 window.addEventListener('blur',()=>{if(drag)cancel();});
 $('stencil-show').addEventListener('change',()=>{plan.showSheet=$('stencil-show').checked;if(plan.showSheet)activate();else{cancel();stop();paint();save();}});
 function setIncludes(members){cancel();plan.sheetIncludes[plan.activeLayer]=members;revision++;for(const b of plan.bridges)if(b.layer===plan.activeLayer)b.needsReview=true;selected=null;selectedIsland=0;$('bridge-auto-status').textContent='';schedule();save();}
 $('stencil-includes').addEventListener('change',e=>{if(!e.target.matches('[data-include-layer]'))return;const id=Number(e.target.dataset.includeLayer),members=(plan.sheetIncludes[plan.activeLayer]||[]).filter(v=>v!==id);if(e.target.checked)members.push(id);setIncludes(members.sort((a,b)=>a-b));});
 $('stencil-separate').addEventListener('click',()=>setIncludes([]));
 $('stencil-active').addEventListener('change',()=>setLayer($('stencil-active').value));
 $('stencil-islands').addEventListener('change',()=>{plan.showIslands=$('stencil-islands').checked;paint();save();});
 for(const [id,key,min,max] of [['stencil-size','longEdgeInches',1,100]])$(id).addEventListener('change',()=>{plan[key]=Math.max(min,Math.min(max,Number($(id).value)||newStencilPlan()[key]));revision++;for(const b of plan.bridges)b.needsReview=true;schedule();save();});
 for(const [id,key,other] of [['bridge-auto-min','autoBridgeMinMm','autoBridgeMaxMm'],['bridge-auto-max','autoBridgeMaxMm','autoBridgeMinMm']])$(id).addEventListener('change',()=>{const input=Number($(id).value);plan[key]=Math.round(Math.max(.25,Math.min(25,Number.isFinite(input)&&input>0?input:newStencilPlan()[key]))*100)/100;if(key==='autoBridgeMinMm'&&plan[key]>plan[other]||key==='autoBridgeMaxMm'&&plan[key]<plan[other])plan[other]=plan[key];$(id).value=plan[key];$('bridge-auto-status').textContent='';if(autoBusy)schedule();else controls();save();});
 $('bridge-auto').addEventListener('click',()=>{cancel();$('bridge-auto-status').textContent='';analyze(true);});
 $('bridge-add').addEventListener('click',()=>{if(adding){cancel();selected=null;controls();paint();return;}plan.hiddenLayers=plan.hiddenLayers.filter(t=>t!==plan.activeLayer);$('tool-bridge').click();activate();selected=null;adding=true;controls();paint();});
 $('bridge-width').addEventListener('change',()=>{const value=Math.max(.25,Math.min(25,Number($('bridge-width').value)||3));plan.bridgeWidthMm=value;if(chosen())edit(()=>{chosen().widthMm=value;chosen().needsReview=false;});else{if(autoBusy)schedule();else controls();save();}});
 $('bridge-enabled').addEventListener('change',()=>{if(chosen())edit(()=>chosen().enabled=$('bridge-enabled').checked);});
 $('bridge-reset').addEventListener('click',()=>{cancel();$('bridge-auto-status').textContent='';edit(()=>{plan.bridges=plan.bridges.filter(b=>b.layer!==plan.activeLayer);selected=null;selectedIsland=0;});});
 $('bridge-delete').addEventListener('click',()=>edit(()=>{plan.bridges=plan.bridges.filter(b=>b.id!==selected);selected=null;}));
 $('bridge-review').addEventListener('click',()=>{if(chosen())edit(()=>chosen().needsReview=false);});
 $('bridge-undo').addEventListener('click',()=>undo());$('bridge-redo').addEventListener('click',()=>undo(true));
 $('bridge-list').addEventListener('click',e=>{const b=e.target.closest('[data-bridge]');if(!b)return;$('tool-bridge').click();selected=b.dataset.bridge;adding=false;controls();paint();});
 $('island-next').addEventListener('click',()=>{if(!result?.islands.length)return;const index=result.islands.findIndex(i=>i.id===selectedIsland),island=result.islands[(index+1)%result.islands.length];selectedIsland=island.id;viewport.dispatchEvent(new CustomEvent('canvas-focus-region',{detail:island.bounds}));controls();paint();});
 $('island-assign').addEventListener('click',()=>{if(!result||!selectedIsland)return;const mask=Uint8Array.from(result.labels,id=>+(id===selectedIsland));onAssignIsland(mask,plan.activeLayer);});
 $('stencil-layers').addEventListener('change',e=>{if(!e.target.matches('[data-layer]'))return;const value=Number(e.target.dataset.layer);plan.hiddenLayers=plan.hiddenLayers.filter(v=>v!==value);if(!e.target.checked){plan.hiddenLayers.push(value);if(value===plan.activeLayer){plan.showSheet=false;stop();}}controls();paint();repaint();save();});
 $('stencil-layers').addEventListener('click',e=>{const button=e.target.closest('[data-active-layer]');if(button&&Number(button.dataset.activeLayer)>0)setLayer(button.dataset.activeLayer);});
 $('layers-solo').addEventListener('click',()=>{plan.hiddenLayers=[-1,-2,...(read()?.palette||[]).slice(1).map((_,i)=>i+1)].filter(v=>!sheetLayers(plan).includes(v));layers();paint();repaint();save();});
 $('layers-all').addEventListener('click',()=>{plan.hiddenLayers=[];layers();paint();repaint();save();});
 document.addEventListener('keydown',e=>{if(!mode()||document.querySelector('dialog[open]')||e.target.closest('input,select,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey);}else if(e.key==='Escape'){cancel();selected=null;paint();}else if(e.key==='Delete'||e.key==='Backspace'){if(chosen()){e.preventDefault();$('bridge-delete').click();}}});
 setupStencilPreview({prepare:()=>{cancel();beforeSheet();},read:()=>{const s=read();return s?{...s,plan:structuredClone(plan),paths,sheetPaths:paths?sheetPaths:{}}:null;}});
 const exporter=setupStencilExport({prepare:()=>{cancel();beforeSheet();},read:()=>{const s=read();return s?{...s,plan:structuredClone(plan),paths,cachedCutPath:paths?sheetPaths[sheetLayers(plan).join(',')]:undefined}:null;}});
 return {visible,controls,invalidate,paint,
   snapshot:()=>structuredClone(plan),
   hide(){plan.showSheet=false;stop();cancel();paint();},
   reset(){exporter.reset();stop();adding=false;$('bridge-auto-status').textContent='';plan=newStencilPlan();revision=0;history=createBridgeHistory();paths=result=null;selected=null;selectedIsland=0;drag=null;layerSignature='';controls();paint();},
   restore(saved){exporter.reset();stop();adding=false;$('bridge-auto-status').textContent='';plan={...newStencilPlan(),...(saved?structuredClone(saved):{})};revision=0;history=createBridgeHistory();paths=result=null;selected=null;layerSignature='';controls();paint();if(plan.showSheet){beforeSheet();schedule();}}
 };
}
