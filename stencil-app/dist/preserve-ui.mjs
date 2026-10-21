import {validateShapes,shapeRings,preservedMask,shapeGroupKey,reservedGroupKeys,validateShapeBudget,paletteGroupOptions} from './preserved-shapes.mjs';

export function setupPreserve({source,locked,recompute,result,historyChanged=()=>{}}){
  const $=id=>document.getElementById(id),svg=$('preserve-overlay'),viewport=$('canvas-viewport');
  let shapes=[],selected=null,draft=null,drag=null,undo=[],redo=[],session=false;
  let picker=null,autoArmed=false,pickGesture=null,pickRevision=0,groupTarget='new',lastOptions=[];
  const clone=value=>structuredClone(value);
  const active=()=>viewport.dataset.tool==='preserve';
  const chosen=()=>shapes.find(s=>s.id===selected);
  const scale=()=>{const r=svg.getBoundingClientRect();return r.width?source().width/r.width:1;};
  const point=e=>{const r=svg.getBoundingClientRect(),s=source();return {x:Math.max(0,Math.min(s.width,(e.clientX-r.left)*s.width/r.width)),y:Math.max(0,Math.min(s.height,(e.clientY-r.top)*s.height/r.height))};};
  function message(text){$('preserve-status').textContent=text;}
  function remember(before){undo.push(before);if(undo.length>50)undo.shift();redo=[];}
  function commit(before){remember(before);recompute();paint();}
  function opaque(value){const s=source();return preservedMask(Array.isArray(value)?{points:value}:value,s.width,s.height,i=>s.data[i*4+3]>0).some(Boolean);}
  function cancel(){if(drag){shapes=drag.before;drag=null;}draft=null;autoArmed=false;pickGesture=null;picker?.terminate();picker=null;pickRevision++;paint();}
  function canAdd(){return shapes.length<128;}
  const minimumGroups=list=>Math.max(reservedGroupKeys(list).length+Math.max(1,...list.map(s=>(s.paletteGroup??-1)+1)),...list.map(s=>(s.targetGroup??-1)+1));
  const newTarget=()=>minimumGroups(shapes)<Number($('color-count').value)?'new':chosen()?shapeGroupKey(chosen()):lastOptions[0]?`slot:${lastOptions[0].group}`:'slot:0';
  function groupFields(key,id){return key==='new'?{groupId:id}:key.startsWith('slot:')?{targetGroup:Number(key.slice(5))}:key.startsWith('auto:')?{paletteGroup:Number(key.slice(5))}:{groupId:key.slice(9)};}
  function restoreAllowed(list){try{validateShapeBudget(list,Number($('color-count').value));return true;}catch{return false;}}

  function armAuto(){
    if(locked()||!source()?.data)return;
    if(!canAdd()){message('Shape limit reached. Edit or delete an existing outline.');return;}
    const target=newTarget();cancel();$('tool-preserve').click();selected=null;groupTarget=target;autoArmed=true;
    message('Click a feature on the original image to select its silhouette.');paint();
  }
  function autoSelect(p,replace=null){
    if(locked()||!source()?.data||picker)return;
    if(!replace&&!canAdd()){message('Shape limit reached. Edit or delete an existing outline.');return;}
    const target=replace?shapeGroupKey(shapes.find(s=>s.id===replace)):autoArmed?groupTarget:newTarget();
    const image=source(),seed={x:Math.min(image.width-1,Math.floor(p.x)),y:Math.min(image.height-1,Math.floor(p.y))},revision=++pickRevision;
    autoArmed=false;message('Finding the source silhouette…');
    try{
      picker=new Worker('./shape-select-worker.mjs',{type:'module'});
      const fail=text=>{if(revision!==pickRevision)return;picker?.terminate();picker=null;message(text);paint();};
      picker.onerror=()=>fail('Could not select this feature. Try Draw lasso.');
      picker.onmessage=({data})=>{
        if(revision!==pickRevision||source()!==image)return;
        if(data.error){fail(data.error);return;}
        if(!replace&&!canAdd()){fail('Shape limit reached. Edit or delete an existing outline.');return;}
        picker.terminate();picker=null;
        const before=clone(shapes),{pixelCount,...geometry}=data.shape,id=replace||crypto.randomUUID(),shape={id,...geometry,...groupFields(target,id)};
        const next=replace?shapes.map(s=>s.id===replace?shape:s):[...shapes,shape];
        if(!restoreAllowed(next)){message('Choose an existing group, or increase the group count.');paint();return;}
        if(replace){const index=shapes.findIndex(s=>s.id===replace);if(index<0)return;shapes[index]=shape;}else shapes.push(shape);
        selected=shape.id;groupTarget=shapeGroupKey(shape);message(`${pixelCount.toLocaleString()} pixels selected. Choose a color group or adjust the outline, then Done.`);commit(before);
      };
      picker.postMessage({pixels:image.data,width:image.width,height:image.height,seed,tolerance:Number($('preserve-tolerance').value)/100});
    }catch(error){picker?.terminate();picker=null;message(error.message);}
    paint();
  }
  function start(replace=false){
    if(locked()||!source()?.data)return;
    if(!replace&&!canAdd()){message('Shape limit reached. Edit or delete an existing outline.');return;}
    const target=replace?shapeGroupKey(chosen()):newTarget(),id=replace?selected:null;
    cancel();$('tool-preserve').click();if(!replace)selected=null;groupTarget=target;
    draft={points:[],replace:id,pointer:null};
    message('Drag a loop, or click corners and finish with Enter. Escape cancels.');paint();
  }
  function finish(){
    if(!draft||locked())return false;
    if(draft.points.length<3||!opaque(draft.points)){message('Add at least three corners around opaque pixels, or Cancel this outline.');return false;}
    const before=clone(shapes),id=draft.replace||crypto.randomUUID(),shape={id,points:clone(draft.points),...groupFields(groupTarget,id)};
    const next=draft.replace?shapes.map(s=>s.id===draft.replace?shape:s):[...shapes,shape];
    if(!restoreAllowed(next)){message('Choose an existing group, or increase the group count.');return false;}
    if(draft.replace)shapes[shapes.findIndex(s=>s.id===draft.replace)]=shape;else shapes.push(shape);
    selected=shape.id;groupTarget=shapeGroupKey(shape);draft=null;message('Shape ready. Choose a color group, then Done. Drag its points to adjust.');commit(before);return true;
  }
  function done(){
    if(picker){message('Wait for selection, or Cancel it first.');return;}
    if(draft&&draft.points.length&&!finish())return;
    session=false;cancel();$('tool-select').click();
    $('show-palette').checked=true;$('show-palette').dispatchEvent(new Event('change'));
    $('preserve-settings').open=false;
  }
  function controls(){
    const s=source(),disabled=locked()||!s?.data||$('mode').value!=='quantized'||!!picker;
    $('tool-preserve').disabled=disabled;
    $('preserve-settings').hidden=$('mode').value!=='quantized';
    $('preserve-new').disabled=$('preserve-draw').disabled=disabled||!canAdd();
    $('preserve-new').setAttribute('aria-pressed',String(autoArmed));
    $('preserve-reselect').disabled=disabled||!chosen()?.autoSelect;
    $('preserve-tolerance').disabled=disabled;
    $('preserve-tolerance-value').textContent=$('preserve-tolerance').value+'%';
    $('preserve-redraw').disabled=$('preserve-delete').disabled=disabled||!chosen();
    $('preserve-finish').disabled=!s?.data||!!picker;
    $('preserve-finish').textContent=draft?'Finish shape & view quantized':'Done — show quantized';
    $('preserve-cancel').hidden=!draft&&!drag&&!autoArmed&&!pickGesture&&!picker;
    $('preserve-cancel').disabled=locked();
    $('preserve-select').disabled=disabled||!shapes.length||!!draft||autoArmed;
    const options=shapes.map((shape,i)=>{
      const o=document.createElement('option'),group=result()?.shapeGroups?.find(g=>g.id===shape.id)?.group;
      o.value=shape.id;o.textContent=`Shape ${i+1}${!result()?' · computing…':group==null?' · covered by another shape':` · group ${group+1}`}`;return o;
    });
    if(!selected){const option=document.createElement('option');option.value='';option.textContent=draft||autoArmed?'New shape':'Select a shape';options.unshift(option);}
    $('preserve-select').replaceChildren(...options);if(selected)$('preserve-select').value=selected;
    $('color-count').min=String(minimumGroups(shapes));
    for(const option of $('mode').options)option.disabled=shapes.length>0&&option.value!=='quantized';
    const reserved=reservedGroupKeys(shapes).length;
    $('preserve-count').textContent=`${shapes.length} ${shapes.length===1?'shape':'shapes'} · ${reserved} preserved ${reserved===1?'group':'groups'} · ${Number($('color-count').value)-reserved} automatic`;
    const r=result();if(r?.palette)lastOptions=paletteGroupOptions(r,shapes);
    const groupOptions=[{key:'new',label:'New separate group'},...lastOptions.map(o=>({key:`slot:${o.group}`,label:`Group ${o.group+1}`}))];
    $('preserve-group').replaceChildren(...groupOptions.map(g=>{const option=document.createElement('option');option.value=g.key;option.textContent=g.label;return option;}));
    if(chosen()&&!draft&&!autoArmed){
      const shape=chosen(),mapping=r?.shapeGroups?.find(g=>g.id===shape.id),option=lastOptions.find(o=>o.key===shapeGroupKey(shape));
      groupTarget=shape.targetGroup!=null?`slot:${shape.targetGroup}`:mapping?.group!=null?`slot:${mapping.group}`:option?`slot:${option.group}`:shapeGroupKey(shape);
    }
    // A legacy/covered preserved group may be temporarily absent during a fit.
    // Keep its identity in state; do not let the select silently pick another group.
    if(!groupOptions.some(o=>o.key===groupTarget)){
      const option=document.createElement('option');option.value=groupTarget;option.textContent='Current group (rebuilding)';$('preserve-group').append(option);
    }
    $('preserve-group').value=groupTarget;$('preserve-group').disabled=disabled;
    historyChanged();
  }
  // Auto-traced contours can have many pixel corners. Reveal more handles as
  // the user zooms in, retaining the full outline and original point indices.
  function handles(ring,unit){
    const keep=[];
    ring.forEach((p,i)=>{if(!keep.length||Math.hypot(p.x-ring[keep.at(-1)].x,p.y-ring[keep.at(-1)].y)>=18*unit)keep.push(i);});
    if(keep.length>3&&Math.hypot(ring[keep.at(-1)].x-ring[0].x,ring[keep.at(-1)].y-ring[0].y)<12*unit)keep.pop();
    return keep.length>=3?keep:[...new Set([0,Math.floor(ring.length/3),Math.floor(ring.length*2/3)])];
  }
  function element(name,attrs){const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}
  function paint(){
    controls();svg.replaceChildren();const s=source();if(!s)return;
    svg.setAttribute('viewBox',`0 0 ${s.width} ${s.height}`);svg.toggleAttribute('hidden',!session);
    $('assign-surface').classList.toggle('preserving',session);
    document.body.classList.toggle('editing-preserved',session);
    const unit=scale();
    for(const shape of shapes){
      if(draft?.replace===shape.id)continue;
      const current=shape.id===selected;
      svg.append(element('path',{d:shapeRings(shape).map(r=>'M'+r.map(p=>`${p.x},${p.y}`).join('L')+'Z').join(''),'fill-rule':'evenodd','data-shape':shape.id,fill:current?'#e2ad3033':'#237c9a22',stroke:current?'#9c6b13':'#237c9a','stroke-width':2,'vector-effect':'non-scaling-stroke'}));
      if(current&&!draft)shapeRings(shape).forEach((ring,r)=>handles(ring,unit).forEach(i=>svg.append(element('circle',{cx:ring[i].x,cy:ring[i].y,r:5*unit,fill:'#fffdf5',stroke:'#9c6b13','stroke-width':1.5,'vector-effect':'non-scaling-stroke','data-shape':shape.id,'data-point':i,'data-ring':r}))));
    }
    if(draft?.points.length)svg.append(element('polygon',{points:draft.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'#e2ad3022',stroke:'#9c6b13','stroke-width':2,'stroke-dasharray':'5 3','vector-effect':'non-scaling-stroke'}));
  }
  svg.addEventListener('pointerdown',e=>{
    if(!active()||locked()||picker||e.button!==0||!e.isPrimary)return;
    const p=point(e),previousSelection=selected;
    if(draft){draft.points.push(p);draft.pointer=e.pointerId;draft.start={x:e.clientX,y:e.clientY};draft.dragged=false;}
    else if(!autoArmed&&e.target.dataset.shape){
      selected=e.target.dataset.shape;groupTarget=shapeGroupKey(chosen());const index=e.target.dataset.point,ring=Number(e.target.dataset.ring||0);
      if(e.altKey&&index!=null){if(shapeRings(chosen())[ring].length>3){const before=clone(shapes);shapeRings(chosen())[ring].splice(Number(index),1);commit(before);}return;}
      drag={pointer:e.pointerId,start:p,index:index==null?null:Number(index),ring,before:clone(shapes)};
    }else{pickGesture={pointer:e.pointerId,point:p,x:e.clientX,y:e.clientY,moved:false};}
    svg.setPointerCapture(e.pointerId);if(draft||selected!==previousSelection)paint();else controls();e.preventDefault();
  });
  svg.addEventListener('pointermove',e=>{
    if(pickGesture?.pointer===e.pointerId&&Math.hypot(e.clientX-pickGesture.x,e.clientY-pickGesture.y)>4)pickGesture.moved=true;
    if(draft?.pointer===e.pointerId){
      if(Math.hypot(e.clientX-draft.start.x,e.clientY-draft.start.y)>4)draft.dragged=true;
      const p=point(e),last=draft.points.at(-1);
      if(draft.dragged&&draft.points.length<9999&&Math.hypot(p.x-last.x,p.y-last.y)>=6*scale()){draft.points.push(p);paint();}
    }
    if(drag?.pointer===e.pointerId){
      const p=point(e),shape=chosen(),old=drag.before.find(s=>s.id===selected);
      if(drag.index!=null)shapeRings(shape)[drag.ring][drag.index]=p;
      else{
        const s=source(),vertices=shapeRings(old).flat(),xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y);
        const dx=Math.max(-Math.min(...xs),Math.min(s.width-Math.max(...xs),p.x-drag.start.x)),dy=Math.max(-Math.min(...ys),Math.min(s.height-Math.max(...ys),p.y-drag.start.y));
        const rings=shapeRings(old).map(r=>r.map(v=>({x:v.x+dx,y:v.y+dy})));shape.points=rings[0];if(old.holes)shape.holes=rings.slice(1);
      }
      paint();
    }
  });
  svg.addEventListener('pointerup',e=>{
    if(pickGesture?.pointer===e.pointerId){const pick=pickGesture;pickGesture=null;if(!pick.moved)autoSelect(pick.point);else{message('Click to auto select, or choose Draw lasso to draw a loop.');controls();}}
    if(draft?.pointer===e.pointerId){draft.pointer=null;if(draft.dragged){draft.points.push(point(e));finish();}}
    if(drag?.pointer===e.pointerId){const before=drag.before;drag=null;if(opaque(chosen())){if(JSON.stringify(before)!==JSON.stringify(shapes))commit(before);else controls();}else{shapes=before;message('Shape must contain an opaque pixel.');paint();}}
  });
  svg.addEventListener('pointercancel',cancel);
  svg.addEventListener('lostpointercapture',()=>{if(drag||pickGesture||draft?.pointer!=null)cancel();});
  svg.addEventListener('dblclick',e=>{
    if(!active()||draft||drag||picker||locked()||e.target.dataset.point!=null)return;
    const shape=chosen();if(!shape||shapeRings(shape).reduce((n,r)=>n+r.length,0)>=10000)return;
    const p=point(e);if(shapeRings(shape).flat().some(v=>Math.hypot(v.x-p.x,v.y-p.y)<8*scale()))return;let best=Infinity,edge=0,ringIndex=0;
    shapeRings(shape).forEach((ring,r)=>ring.forEach((a,i)=>{const b=ring[(i+1)%ring.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);if(d<best){best=d;edge=i;ringIndex=r;}}));
    if(best<=10*scale()){const before=clone(shapes);shapeRings(shape)[ringIndex].splice(edge+1,0,p);commit(before);}e.preventDefault();
  });
  function history(forward){if(locked()||picker)return;cancel();const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;if(!restoreAllowed(from.at(-1))){message('Increase the group count before restoring these shapes.');return;}to.push(clone(shapes));shapes=from.pop();selected=shapes.at(-1)?.id??null;groupTarget=chosen()?shapeGroupKey(chosen()):'new';recompute();paint();}
  $('preserve-new').addEventListener('click',armAuto);
  $('preserve-draw').addEventListener('click',()=>start());
  $('preserve-reselect').addEventListener('click',()=>{const shape=chosen();if(shape?.autoSelect){cancel();$('tool-preserve').click();autoSelect(shape.autoSelect,shape.id);}});
  $('preserve-tolerance').addEventListener('input',controls);
  $('preserve-redraw').addEventListener('click',()=>start(true));
  $('preserve-finish').addEventListener('click',done);
  $('preserve-cancel').addEventListener('click',cancel);
  $('preserve-delete').addEventListener('click',()=>{if(locked()||!chosen())return;cancel();const before=clone(shapes);shapes=shapes.filter(s=>s.id!==selected);selected=shapes.at(-1)?.id??null;commit(before);});
  $('preserve-select').addEventListener('change',()=>{const id=$('preserve-select').value;cancel();selected=id;$('tool-preserve').click();paint();});
  $('preserve-group').addEventListener('change',()=>{
    const target=$('preserve-group').value;
    if(draft||autoArmed||!chosen()){groupTarget=target;return;}
    const before=clone(shapes),shape=chosen();delete shape.groupId;delete shape.paletteGroup;delete shape.targetGroup;Object.assign(shape,groupFields(target,crypto.randomUUID()));
    if(!restoreAllowed(shapes)){shapes=before;message('This needs another group. Choose an existing group or increase the group count.');paint();return;}
    groupTarget=shapeGroupKey(shape);commit(before);
  });
  $('assign-island').addEventListener('toggle',()=>{if($('assign-island').open&&session)done();});
  $('show-palette').addEventListener('change',()=>{if($('show-palette').checked&&session)done();});
  viewport.addEventListener('canvas-navigation',()=>{if(drag||pickGesture||draft?.pointer!=null)cancel();});
  viewport.addEventListener('canvas-tool-change',()=>{session=active()||viewport.dataset.tool==='pan'&&session;if(!active())cancel();paint();});
  window.addEventListener('blur',()=>{if(drag||pickGesture||draft?.pointer!=null)cancel();});
  document.addEventListener('keydown',e=>{
    if(!active()||document.querySelector('dialog[open]')||e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
    if(e.key==='Enter'){e.preventDefault();done();}if(e.key==='Escape')cancel();
  });
  new MutationObserver(()=>{if(session)paint();}).observe($('canvas-world'),{attributes:true,attributeFilter:['style']});
  return {done,undo:()=>history(false),redo:()=>history(true),get canUndo(){return !locked()&&!picker&&!!undo.length&&restoreAllowed(undo.at(-1));},get canRedo(){return !locked()&&!picker&&!!redo.length&&restoreAllowed(redo.at(-1));},snapshot:()=>clone(drag?.before||shapes),refresh:paint,restore(value=[]){cancel();const s=source();validateShapes(value,s?.width||1,s?.height||1);shapes=clone(value);lastOptions=[];selected=shapes[0]?.id??null;$('preserve-tolerance').value=String(Math.round((shapes[0]?.autoSelect?.tolerance??.12)*100));groupTarget=chosen()?shapeGroupKey(chosen()):'new';undo=[];redo=[];session=false;if(active())$('tool-select').click();message('Click the original to select a silhouette. Choose its color group, then Done. Use the main Undo / Redo buttons for edits.');paint();}};
}
