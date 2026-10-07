import {createAssignments,UNASSIGNED,UNBLEACHED,treatmentGroups} from './assignments.mjs?v=palette-groups-2';
import {assignmentEdges,selectionRegions} from './assignment-geometry.mjs';
import {collectBrushRegions} from './group-brush.mjs';
export function setupAssign(onChange) {
  const $=id=>document.getElementById(id), original=$('assign-original'),overlay=$('assign-overlay'),outline=$('assign-outline'),boundaries=$('assign-boundaries'),quantized=$('assign-quantized'),hints=$('assign-hints'),viewport=$('canvas-viewport'),cursor=$('brush-cursor');
  let snapshot=null,model=createAssignments(),selected=-1,individual=false,brushTarget=1,stroke=null,displayEdges=null;
  const brushMode=()=>viewport.dataset.tool==='brush';
  const palette=()=>snapshot?.result?.palette || [];
  const newModel=()=>createAssignments((snapshot?.result?.regions || []).map(r=>r.paletteIndex ?? -1),palette().length);
  function buildBuckets() {
    $('assignment-groups').replaceChildren();
    if(!palette().length||brushTarget>=palette().length)brushTarget=palette().length>1?1:UNBLEACHED;
    treatmentGroups(palette()).forEach(({rgb,value,label})=>{
      const button=document.createElement('button'),chip=document.createElement('i');
      button.dataset.bucket=value;chip.className='swatch';chip.style.background=`rgb(${rgb.join(',')})`;
      button.append(chip,label);button.title=value===UNBLEACHED?'No bleach':`RGB ${rgb.join(', ')}`;if(value===UNBLEACHED)chip.classList.add('unbleached-swatch');
      $('assignment-groups').append(button);
    });
  }
  const selectedIds=()=>selectionRegions(model.values,selected,individual);
  function edges(){return displayEdges??=assignmentEdges(snapshot.result.labels,model.values,outline.width,outline.height,snapshot.source.data);}
  function controls() {
    const r=snapshot?.result?.regions[selected],value=model.values[selected],editable=!!r && model.automatic[selected]>=0;
    const ids=selectedIds(),grouped=!!r&&!individual&&value!==UNASSIGNED;
    const area=ids.reduce((sum,id)=>sum+snapshot.result.regions[id].area,0);
    const treatment=value===UNBLEACHED?'Unbleached':`Intensity ${value}`;
    $('assign-selection').textContent=grouped?`${treatment} · ${ids.length} regions · ${area.toLocaleString()} pixels`:r?`${individual?'Individual region · ':''}Area ${selected+1} · ${r.area.toLocaleString()} pixels · ${value===UNBLEACHED?'Unbleached':value>=0?'Intensity '+value:editable?'Unassigned':'No palette group'}`:!snapshot?.result?'Computing regions…':palette().length?'No area selected':'Assignment requires Quantized mode.';
    document.querySelectorAll('[data-bucket]').forEach(button=>{button.disabled=brushMode()?!snapshot?.result:!editable;button.setAttribute('aria-pressed',String((brushMode()?brushTarget:!!r?value:null)===Number(button.dataset.bucket)));});
    $('assign-undo').disabled=!model.canUndo;$('assign-redo').disabled=!model.canRedo;
    let changed=0;for(let i=0;i<model.values.length;i++)if(model.values[i]!==UNASSIGNED)changed++;
    $('assign-restore').textContent=grouped?'Clear group assignment':'Clear assignment';
    $('assign-restore').disabled=!editable || value===UNASSIGNED;
    $('unbleach-group').textContent=individual?'Make region unbleached':'Make group unbleached';
    $('unbleach-group').disabled=!editable || value<0;
    $('assign-count').textContent=snapshot?.result?`${changed} assigned`:'Computing…';
    $('reset-assignments').hidden=!model.edited;
    onChange(model.edited);
  }
  function paintOverlay() {
    const ctx=overlay.getContext('2d');ctx.clearRect(0,0,overlay.width,overlay.height);
    if(!snapshot?.result)return;
    const {result,source}=snapshot,data=ctx.createImageData(overlay.width,overlay.height);
    for(let i=0;i<result.labels.length;i++) {
      const id=result.labels[i];if(id<0||!source.data[i*4+3])continue;
      const bucket=stroke?.ids.has(id)?stroke.target:model.values[id];if(bucket===-1)continue;
      // A subtle hatch distinguishes unbleached from a naturally black group.
      const hatch=((i%overlay.width)+Math.floor(i/overlay.width))%12<2;
      const color=bucket===UNBLEACHED?(hatch?[95,125,145]:[12,16,20]):palette()[bucket];
      data.data.set(color,i*4);data.data[i*4+3]=255*source.data[i*4+3]/255;
    }
    ctx.putImageData(data,0,0);
  }
  function paintHints(){
    hints.hidden=!$('assignment-hints').checked;
    const ctx=hints.getContext('2d');ctx.clearRect(0,0,hints.width,hints.height);
    if(!snapshot?.result||hints.hidden||!palette().length)return;
    const data=ctx.createImageData(hints.width,hints.height);
    for(let y=0;y<hints.height;y++)for(let x=0;x<hints.width;x++){
      const i=y*hints.width+x,id=snapshot.result.labels[i];
      if(!snapshot.source.data[i*4+3]||(id>=0&&(model.values[id]!==UNASSIGNED||stroke?.ids.has(id))))continue;
      // Small contrasting dots stay distinct from assigned tints and unbleached hatching.
      if(x%10<2&&y%10<2)data.data.set([25,125,165,190],i*4);
      else if(x%10<3&&y%10<3)data.data.set([255,255,255,180],i*4);
    }
    ctx.putImageData(data,0,0);
  }
  function deselect(){selected=-1;individual=false;paintSelection();controls();}
  function cancelStroke(){if(stroke){stroke=null;paintOverlay();paintHints();$('brush-status').textContent='Stroke cancelled';}cursor.hidden=true;}
  function imagePoint(e){const rect=outline.getBoundingClientRect();return {x:(e.clientX-rect.left)*outline.width/rect.width,y:(e.clientY-rect.top)*outline.height/rect.height};}
  function cursorAt(e){if(!brushMode()||$('assign-surface').hidden){cursor.hidden=true;return;}const rect=outline.getBoundingClientRect(),size=Number($('brush-size').value)*rect.width/outline.width;cursor.hidden=false;cursor.style.width=cursor.style.height=size+'px';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';}
  function extendStroke(e){if(!stroke)return;const next=imagePoint(e),previousCount=stroke.ids.size;
    collectBrushRegions({labels:snapshot.result.labels,width:outline.width,height:outline.height,from:stroke.last,to:next,radius:stroke.radius,eligible:id=>model.automatic[id]>=0&&model.values[id]===UNASSIGNED},stroke.ids);
    stroke.last=next;if(stroke.ids.size!==previousCount){paintOverlay();paintHints();}$('brush-status').textContent=`${stroke.ids.size} regions in stroke`;
  }
  outline.addEventListener('pointerdown',e=>{
    if(!brushMode()||!snapshot?.result||!palette().length||e.button!==0||!e.isPrimary)return;
    selected=-1;individual=false;paintSelection();stroke={pointer:e.pointerId,last:imagePoint(e),radius:Number($('brush-size').value)/2,target:brushTarget,ids:new Set()};
    outline.setPointerCapture(e.pointerId);extendStroke(e);e.preventDefault();
  });
  outline.addEventListener('pointermove',e=>{cursorAt(e);if(stroke?.pointer===e.pointerId)extendStroke(e);});
  outline.addEventListener('pointerup',e=>{if(stroke?.pointer!==e.pointerId)return;extendStroke(e);const completed=stroke;stroke=null;
    const applied=model.brush(completed.ids,completed.target);changed();$('brush-status').textContent=applied?`${completed.ids.size} regions assigned`:'No unassigned regions touched';
  });
  for(const type of ['pointercancel','lostpointercapture'])outline.addEventListener(type,cancelStroke);
  outline.addEventListener('pointerleave',()=>{if(!stroke)cursor.hidden=true;});
  viewport.addEventListener('canvas-navigation',cancelStroke);
  viewport.addEventListener('canvas-tool-change',()=>{$('brush-settings').hidden=!brushMode();if(brushMode())deselect();else controls();});
  viewport.addEventListener('canvas-deselect',deselect);
  $('assignment-hints').addEventListener('change',paintHints);
  $('brush-size').addEventListener('input',()=>{$('brush-size-value').textContent=$('brush-size').value+' px';});
  window.addEventListener('blur',cancelStroke);
  function paintBoundaries(){
    boundaries.hidden=!$('outlines').checked;
    const ctx=boundaries.getContext('2d');ctx.clearRect(0,0,boundaries.width,boundaries.height);
    if(!snapshot?.result||boundaries.hidden)return;
    const pixels=ctx.createImageData(boundaries.width,boundaries.height);
    const merged=edges();
    for(let i=0;i<merged.length;i++)if(merged[i]&&snapshot.source.data[i*4+3])pixels.data.set([30,165,185,220],i*4);
    ctx.putImageData(pixels,0,0);
  }
  function paintSelection() {
    const ctx=outline.getContext('2d');ctx.clearRect(0,0,outline.width,outline.height);
    const r=snapshot?.result?.regions[selected];if(!r)return;
    const ids=new Set(selectedIds()),merged=individual?snapshot.result.edges:edges();
    let x=outline.width,y=outline.height,right=0,bottom=0;
    for(const id of ids){const b=snapshot.result.regions[id].bounds;x=Math.min(x,b[0]);y=Math.min(y,b[1]);right=Math.max(right,b[2]);bottom=Math.max(bottom,b[3]);}
    const w=right-x+1,h=bottom-y+1,data=ctx.createImageData(w,h);
    for(let row=y;row<=bottom;row++)for(let col=x;col<=right;col++) {
      const i=row*outline.width+col;if(!ids.has(snapshot.result.labels[i]) || !snapshot.source.data[i*4+3])continue;
      const p=((row-y)*w+col-x)*4;data.data.set([255,190,40,merged[i]?255:45],p);
    }
    ctx.putImageData(data,x,y);
  }
  function changed(){displayEdges=null;paintOverlay();paintHints();paintBoundaries();paintSelection();controls();}
  $('assignment-actions').addEventListener('click',event=>{
    const button=event.target.closest('[data-bucket]');
    if(button&&!button.disabled){brushTarget=Number(button.dataset.bucket);if(brushMode()){controls();}else if(model.setMany(selectedIds(),brushTarget))changed();}
  });
  $('assign-restore').addEventListener('click',()=>{if(model.setMany(selectedIds(),UNASSIGNED)){selected=-1;individual=false;changed();}});
  $('unbleach-group').addEventListener('click',()=>{
    const group=model.values[selected];if(!(group>=0))return;
    const ids=selectedIds();
    if(model.setMany(ids,UNBLEACHED))changed();
  });
  $('assign-undo').addEventListener('click',()=>{if(model.undo())changed();});
  $('assign-redo').addEventListener('click',()=>{if(model.redo())changed();});
  $('assign-clear').addEventListener('click',deselect);
  $('overlay-opacity').addEventListener('input',()=>{overlay.style.opacity=Number($('overlay-opacity').value)/100;$('overlay-value').textContent=$('overlay-opacity').value+'%';});
  $('show-original').addEventListener('change',()=>{$('assign-surface').classList.toggle('hide-original',!$('show-original').checked);});
  function showOriginal(value){$('assign-surface').classList.toggle('original-only',value);}
  const peek=$('peek-original');
  peek.addEventListener('pointerdown',event=>{peek.setPointerCapture(event.pointerId);showOriginal(true);});
  for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])peek.addEventListener(event,()=>showOriginal(false));
  peek.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();showOriginal(true);}});
  peek.addEventListener('keyup',()=>showOriginal(false));
  window.addEventListener('blur',()=>showOriginal(false));
  let down=null;
  outline.addEventListener('pointerdown',e=>{down=e.isPrimary?{x:e.clientX,y:e.clientY}:null;});
  outline.addEventListener('pointercancel',()=>{down=null;});
  outline.addEventListener('click',event=>{
    if(brushMode()){down=null;return;}
    if(!snapshot?.result || (down && Math.hypot(event.clientX-down.x,event.clientY-down.y)>8)){down=null;return;}down=null;
    const rect=outline.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*outline.width/rect.width),y=Math.floor((event.clientY-rect.top)*outline.height/rect.height);
    if(x<0||y<0||x>=outline.width||y>=outline.height)return;
    const i=y*outline.width+x,id=snapshot.source.data[i*4+3]?snapshot.result.labels[i]:-1;
    const same=!individual&&id>=0&&selected>=0&&(id===selected||(model.values[id]!==UNASSIGNED&&model.values[id]===model.values[selected]));
    individual=false;selected=same?-1:id;paintSelection();controls();
  });
  outline.addEventListener('dblclick',event=>{
    if(viewport.dataset.tool!=='select'||!snapshot?.result)return;
    const point=imagePoint(event),x=Math.floor(point.x),y=Math.floor(point.y);
    if(x<0||y<0||x>=outline.width||y>=outline.height)return;
    const i=y*outline.width+x,id=snapshot.source.data[i*4+3]?snapshot.result.labels[i]:-1;
    if(id<0)return;
    selected=id;individual=true;paintSelection();controls();event.preventDefault();
  });
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();cancelStroke();if(event.shiftKey?model.redo():model.undo())changed();}
    if(event.key==='Escape'){cancelStroke();selected=-1;individual=false;paintSelection();controls();showOriginal(false);}
  });
  return {
    boundaries:paintBoundaries,
    hints:paintHints,
    get edited(){return model.edited;},
    snapshot(){return model.values.slice();},
    restore(values){cancelStroke();displayEdges=null;model=newModel();model.values.set(Int16Array.from(values,v=>v===0?UNBLEACHED:v));selected=-1;individual=false;changed();},
    reset(){cancelStroke();displayEdges=null;model=newModel();selected=-1;individual=false;changed();},
    update(next){cancelStroke();displayEdges=null;snapshot=next;model=newModel();selected=-1;individual=false;buildBuckets();
      for(const c of [original,overlay,outline,boundaries,quantized,hints]){c.width=next.source.width;c.height=next.source.height;}
      original.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(next.base),next.source.width,next.source.height),0,0);
      paintOverlay();paintSelection();paintBoundaries();paintHints();controls();}
  };
}
