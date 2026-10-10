import {previewSvg} from './stencil-preview.mjs';
export function setupStencilPreview({read,prepare}){
 const $=id=>document.getElementById(id),dialog=$('stencil-preview'),svg=$('preview-art'),stage=$('preview-stage');
 let worker=null,generation=0,data=null,mode='sheet',enabled=[],zoom=1,pan={x:0,y:0},drag=null;
 function stop(){generation++;worker?.terminate();worker=null;}
 function camera(){svg.style.transform=`translate(${pan.x}px,${pan.y}px) scale(${zoom})`;$('preview-zoom-value').textContent=`${Math.round(zoom*100)}%`;}
 function fit(){zoom=1;pan={x:0,y:0};camera();}
 function paint(){
   $('preview-sheet-mode').setAttribute('aria-pressed',String(mode==='sheet'));$('preview-bleach-mode').setAttribute('aria-pressed',String(mode==='bleach'));
   $('preview-sheet-controls').hidden=mode!=='sheet';$('preview-passes').hidden=mode!=='bleach';
   if(!data)return;const layer=Number($('preview-layer').value),rendered=previewSvg(data,{mode,layer,enabled});svg.setAttribute('viewBox',rendered.viewBox);svg.innerHTML=rendered.body;
   const sheet=data.sheets.find(s=>s.layer===layer);
   $('preview-note').textContent=mode==='sheet'?`Intensity ${layer} · cuts ${sheet?.members.join(' + ')||layer}. Pale material is Mylar; dark areas are cut out. Bridges are part of the sheet.`:'Illustrative bleach on dark fabric. The strongest visible pass wins in overlaps; bridges block their own pass. Actual color depends on fabric and application.';
   const scale=data.scale;$('preview-size').textContent=mode==='sheet'?`Working area ${scale.sheetWidthMm} × ${scale.sheetHeightMm} mm${scale.fits?'':' · Artwork exceeds area'}`:`Artwork ${scale.widthInches.toFixed(2)} × ${scale.heightInches.toFixed(2)} in`;
 }
 function open(){
   prepare();const source=read();if(!source)return;stop();data=null;svg.replaceChildren();$('preview-passes').replaceChildren();$('preview-layer').replaceChildren();$('preview-size').textContent='';$('preview-note').textContent='';$('preview-status').textContent='Building previews…';dialog.showModal();fit();paint();const current=generation;
   const n=source.width*source.height,treatments=new Int16Array(n),alpha=new Uint8Array(n);for(let i=0;i<n;i++){treatments[i]=source.at(i);alpha[i]=source.source[i*4+3];}
   try{worker=new Worker(new URL('./stencil-preview-worker.mjs',import.meta.url),{type:'module'});
     worker.onmessage=({data:result})=>{if(current!==generation||!dialog.open)return;worker.terminate();worker=null;if(result.error){$('preview-status').textContent=`Preview failed: ${result.error}`;return;}
       data=result;enabled=data.sheets.map(s=>s.layer);$('preview-status').textContent=data.sheets.length?'':'Assign an intensity to preview its stencil.';
       for(const sheet of data.sheets){const option=document.createElement('option');option.value=sheet.layer;option.textContent=`Intensity ${sheet.layer}${sheet.members.length>1?` · cuts ${sheet.members.join(' + ')}`:''}`;$('preview-layer').append(option);
         const label=document.createElement('label'),input=document.createElement('input');label.className='check';input.type='checkbox';input.checked=true;input.dataset.previewLayer=sheet.layer;label.append(input,document.createTextNode(`Intensity ${sheet.layer}`));$('preview-passes').append(label);}
       $('preview-layer').value=data.sheets.some(s=>s.layer===source.plan.activeLayer)?source.plan.activeLayer:data.sheets[0]?.layer||'';paint();
     };
     worker.onerror=()=>{if(current===generation){stop();$('preview-status').textContent='Could not build previews. Close and try again.';}};
     worker.postMessage({...source,at:undefined,treatments,alpha,source:undefined},[treatments.buffer,alpha.buffer]);
   }catch(error){stop();$('preview-status').textContent=`Preview failed: ${error.message}`;}
 }
 $('stencil-preview-open').addEventListener('click',open);$('preview-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{stop();drag=null;});
 for(const [id,value] of [['preview-sheet-mode','sheet'],['preview-bleach-mode','bleach']])$(id).addEventListener('click',()=>{mode=value;fit();paint();});
 $('preview-layer').addEventListener('change',()=>{fit();paint();});
 for(const [id,step] of [['preview-prev',-1],['preview-next',1]])$(id).addEventListener('click',()=>{if(!data?.sheets.length)return;const select=$('preview-layer');select.selectedIndex=(select.selectedIndex+step+data.sheets.length)%data.sheets.length;fit();paint();});
 $('preview-passes').addEventListener('change',e=>{if(!e.target.matches('[data-preview-layer]'))return;const layer=Number(e.target.dataset.previewLayer);enabled=enabled.filter(v=>v!==layer);if(e.target.checked)enabled.push(layer);paint();});
 $('preview-fit').addEventListener('click',fit);
 function setZoom(value){zoom=Math.max(.5,Math.min(12,value));camera();}
 $('preview-in').addEventListener('click',()=>setZoom(zoom*1.25));$('preview-out').addEventListener('click',()=>setZoom(zoom/1.25));
 stage.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.002));},{passive:false});
 stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:{...pan}};stage.setPointerCapture(e.pointerId);});
 stage.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;pan={x:drag.pan.x+e.clientX-drag.x,y:drag.pan.y+e.clientY-drag.y};camera();});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,()=>drag=null);
}
