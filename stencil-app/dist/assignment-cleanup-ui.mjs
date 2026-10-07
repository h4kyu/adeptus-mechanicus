// A preview is transient: only Apply writes to the assignment model and history.
export function setupAssignmentCleanup({read,repaint,apply,beforePreview}){
  const $=id=>document.getElementById(id);let worker=null,result=null,generation=0;
  const patches=n=>`${n.toLocaleString()} ${n===1?'patch':'patches'}`;
  function controls(){
    $('refine-preview').disabled=!read()||!!worker;
    $('refine-apply').disabled=!result?.changedPixels||!!worker;
    $('refine-cancel').disabled=!result&&!worker;
    $('refine-show-row').hidden=!result?.changedPixels;
  }
  function clear(message=''){
    generation++;worker?.terminate();worker=null;result=null;$('refine-status').textContent=message;controls();repaint();
  }
  function minimum(){const input=$('refine-minimum');input.value=Math.min(1000000,Math.max(1,Math.round(Number(input.value))||20));return Number(input.value);}
  $('refine-minimum').addEventListener('change',()=>{minimum();clear('Settings changed. Preview cleanup again.');});
  $('refine-scope').addEventListener('change',()=>clear('Settings changed. Preview cleanup again.'));
  $('refine-show').addEventListener('change',repaint);
  $('refine-cancel').addEventListener('click',()=>clear('Preview discarded.'));
  $('refine-island').addEventListener('toggle',()=>{if(!$('refine-island').open&&(result||worker))clear();});
  $('refine-preview').addEventListener('click',()=>{
    clear();beforePreview();const state=read();if(!state)return;
    const {width,height,source,at}=state,n=width*height,treatments=new Int16Array(n),alpha=new Uint8Array(n);
    for(let i=0;i<n;i++){treatments[i]=at(i);alpha[i]=source[i*4+3];}
    const current=++generation;$('refine-status').textContent='Finding small patches…';
    const failed=message=>{if(current===generation)clear(`Cleanup failed: ${message}`);};
    try{
      worker=new Worker(new URL('./assignment-cleanup-worker.mjs',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(current!==generation)return;
        if(data.error){failed(data.error);return;}
        worker.terminate();worker=null;result=data;$('refine-show').checked=true;
        $('refine-status').textContent=data.changedPixels?`${data.changedPixels.toLocaleString()} pixels in ${patches(data.changedPatches)} will change.`:'No eligible patches to merge.';
        if(data.remainingPatches)$('refine-status').textContent+=` ${patches(data.remainingPatches)} ${data.remainingPatches===1?'has':'have'} no assigned neighbor.`;
        controls();repaint();
      };
      worker.onerror=()=>failed('Could not compute the preview.');
      worker.postMessage({treatments,alpha,width,height,minimum:minimum(),scope:$('refine-scope').value},[treatments.buffer,alpha.buffer]);controls();
    }catch(error){failed(error.message);}
  });
  $('refine-apply').addEventListener('click',()=>{
    if(!result?.changedPixels)return;
    const completed=result;clear();apply(completed.labels);
    $('refine-status').textContent=`Merged ${patches(completed.changedPatches)} (${completed.changedPixels.toLocaleString()} pixels). Undo restores them.`;
  });
  return {clear,controls,get active(){return !!result||!!worker;},get labels(){return result&&$('refine-show').checked?result.labels:null;}};
}
