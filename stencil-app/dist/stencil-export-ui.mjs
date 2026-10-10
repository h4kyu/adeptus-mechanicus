export function setupStencilExport({read,prepare}){
 const $=id=>document.getElementById(id),dialog=$('stencil-export'),download=$('export-download');
 let worker=null,generation=0,output=null,url=null;
 function stop(){generation++;worker?.terminate();worker=null;output=null;if(url)URL.revokeObjectURL(url);url=null;download.removeAttribute('href');download.removeAttribute('download');download.setAttribute('aria-disabled','true');download.tabIndex=-1;}
 function open(){
   prepare();const source=read();if(!source)return;stop();const current=generation;
   $('export-art').replaceChildren();$('export-warnings').replaceChildren();$('export-size').textContent='';$('export-placement').textContent='';$('export-status').textContent='Building cut outlines…';dialog.showModal();
   const n=source.width*source.height,treatments=new Int16Array(n),alpha=new Uint8Array(n);
   for(let i=0;i<n;i++){treatments[i]=source.at(i);alpha[i]=source.source[i*4+3];}
   try{
     worker=new Worker(new URL('./stencil-export-worker.mjs',import.meta.url),{type:'module'});
     worker.onmessage=({data})=>{
       if(generation!==current||!dialog.open)return;worker.terminate();worker=null;
       if(data.error){$('export-status').textContent=`Export failed: ${data.error}`;return;}
       output=data;url=URL.createObjectURL(new Blob([data.svg],{type:'image/svg+xml'}));download.href=url;download.download=data.filename;download.setAttribute('aria-disabled','false');download.tabIndex=0;
       $('export-status').textContent=`Intensity ${data.layer} · cuts ${data.members.join(' + ')}. ${data.warnings.length?'Review the notes below before cutting.':'No issues found by the available checks.'}`;
       $('export-size').textContent=`Working area ${data.widthMm.toFixed(2)} × ${data.heightMm.toFixed(2)} mm (${(data.widthMm/25.4).toFixed(2)} × ${(data.heightMm/25.4).toFixed(2)} in)`;
       const b=data.cutBounds;$('export-placement').textContent=`Cut outline size: ${b.widthMm.toFixed(3)} × ${b.heightMm.toFixed(3)} mm. Place its top-left ${b.leftMm.toFixed(3)} mm from the working area's left and ${b.topMm.toFixed(3)} mm from its top. Use this same working-area origin for every sheet; do not center each layer separately.`;
       for(const warning of data.warnings){const item=document.createElement('li');item.textContent=warning;$('export-warnings').append(item);}
       const svg=$('export-art');svg.setAttribute('viewBox',`0 0 ${data.widthMm} ${data.heightMm}`);
       const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',data.materialPath);path.setAttribute('fill','#dce6e9');path.setAttribute('fill-rule','evenodd');svg.append(path);
     };
     worker.onerror=()=>{if(current===generation){stop();$('export-status').textContent='Could not build SVG. Close and try again.';}};
     worker.postMessage({width:source.width,height:source.height,recipe:source.recipe,plan:source.plan,treatments,alpha,paths:source.paths,cachedCutPath:source.cachedCutPath},[treatments.buffer,alpha.buffer]);
   }catch(error){stop();$('export-status').textContent=`Export failed: ${error.message}`;}
 }
 $('stencil-export-open').addEventListener('click',open);
 $('export-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',stop);
 download.addEventListener('click',event=>{if(!output)event.preventDefault();});
 return {reset(){stop();if(dialog.open)dialog.close();}};
}
