// Persist the recipe; vector geometry is derived from current assignments on reopen.
export function setupBoundaryRefinement({read,beforeBuild,onSave}){
  const $=id=>document.getElementById(id),surface=$('assign-surface'),svg=$('assign-vectors'),ns='http://www.w3.org/2000/svg';
  let applied=null,result=null,worker=null,generation=0;
  const recipe=()=>({tolerance:Number($('boundary-tolerance').value),preserveCorners:$('boundary-corners').checked});
  const equal=(a,b)=>a&&b&&a.tolerance===b.tolerance&&a.preserveCorners===b.preserveCorners;
  function element(name,attrs){const e=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
  function paint(){
    const visible=!!result&&$('boundary-show').checked;surface.classList.toggle('vector-preview',visible);svg.toggleAttribute('hidden',!visible);
    if(!visible)return;
    const state=read();if(!state)return;
    svg.setAttribute('viewBox',`0 0 ${state.width} ${state.height}`);svg.replaceChildren();
    const defs=element('defs',{}),pattern=element('pattern',{id:'vector-unbleached',width:12,height:12,patternUnits:'userSpaceOnUse'});
    pattern.append(element('rect',{width:12,height:12,fill:'#0c1014'}),element('path',{d:'M-6 6L6 -6M0 12L12 0M6 18L18 6',stroke:'#5f7d91','stroke-width':2}));defs.append(pattern);svg.append(defs);
    const fills=element('g',{opacity:Number($('overlay-opacity').value)/100,'fill-rule':'evenodd'});
    for(const path of result.paths)fills.append(element('path',{d:path.d,fill:path.treatment===-2?'url(#vector-unbleached)':`rgb(${state.palette[path.treatment].join(',')})`}));
    svg.append(fills,element('path',{d:result.stroke,fill:'none',stroke:'#1ea5b9','stroke-width':1,'vector-effect':'non-scaling-stroke'}));
  }
  function controls(){
    $('boundary-build').disabled=!read()||!!worker;
    $('boundary-apply').disabled=!result||!result.paths.length||!!worker||!!equal(applied,result.recipe);
    $('boundary-reset').disabled=!applied&&!result&&!worker;
    $('boundary-show-row').hidden=!result?.paths.length;
    $('boundary-tolerance-value').textContent=$('boundary-tolerance').value+' px';
  }
  function invalidate(message=applied?'Assignments changed. Build boundaries again.':''){
    generation++;worker?.terminate();worker=null;result=null;$('boundary-status').textContent=message;paint();controls();
  }
  function hide(){if($('boundary-show').checked){$('boundary-show').checked=false;paint();}}
  function build(savedRecipe){
    invalidate();beforeBuild();const state=read();if(!state)return;
    const selected=savedRecipe||recipe(),n=state.width*state.height,treatments=new Int16Array(n),alpha=new Uint8Array(n);
    for(let i=0;i<n;i++){treatments[i]=state.at(i);alpha[i]=state.source[i*4+3];}
    const current=++generation;$('boundary-status').textContent='Tracing and smoothing boundaries…';
    const fail=message=>{if(generation===current)invalidate(`Could not build boundaries: ${message}`);};
    try{
      worker=new Worker(new URL('./boundary-worker.mjs',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(current!==generation)return;if(data.error){fail(data.error);return;}
        worker.terminate();worker=null;result={...data,recipe:selected};$('boundary-show').checked=true;
        $('boundary-status').textContent=data.paths.length?`${data.sourceEdges.toLocaleString()} pixel edges → ${data.segments.toLocaleString()} vector segments.${data.protectedChains?' Some boundaries kept exact to avoid crossings.':''}`:'Assign some pixels before building boundaries.';
        controls();paint();
      };
      worker.onerror=()=>fail('Worker unavailable.');
      worker.postMessage({treatments,alpha,width:state.width,height:state.height,recipe:selected},[treatments.buffer,alpha.buffer]);controls();
    }catch(error){fail(error.message);}
  }
  $('boundary-build').addEventListener('click',()=>build());
  $('boundary-apply').addEventListener('click',()=>{if(!result)return;applied={...result.recipe};controls();$('boundary-status').textContent='Smoothing saved. Pixel assignments are unchanged.';onSave();});
  $('boundary-reset').addEventListener('click',()=>{applied=null;invalidate('Smoothing removed.');onSave();});
  $('boundary-show').addEventListener('change',paint);
  $('overlay-opacity').addEventListener('input',paint);
  for(const id of ['boundary-tolerance','boundary-corners'])$(id).addEventListener('input',()=>{invalidate('Settings changed. Build a new preview.');controls();});
  return {controls,invalidate,hide,paint,
    snapshot:()=>applied?{...applied}:undefined,
    reset(){applied=null;invalidate();},
    restore(value){applied=value?{...value}:null;if(applied){$('boundary-tolerance').value=applied.tolerance;$('boundary-corners').checked=applied.preserveCorners;}invalidate();if(applied)build(applied);}
  };
}
