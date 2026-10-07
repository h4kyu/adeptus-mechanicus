import {UNASSIGNED,UNBLEACHED,treatmentGroups} from './assignments.mjs?v=palette-groups-2';
import {assignmentEdges} from './assignment-geometry.mjs';
import {createPixelAssignments} from './pixel-assignments.mjs';
import {lassoMask} from './lasso.mjs';
import {collectBrushRegions} from './group-brush.mjs';
export function setupAssign(onChange) {
  const $=id=>document.getElementById(id), original=$('assign-original'),overlay=$('assign-overlay'),outline=$('assign-outline'),boundaries=$('assign-boundaries'),quantized=$('assign-quantized'),hints=$('assign-hints'),viewport=$('canvas-viewport'),cursor=$('brush-cursor');
  let snapshot=null,model=createPixelAssignments(),selected=-1,selectedTreatment=null,individual=false,brushTarget=1,stroke=null,displayEdges=null,lasso=null,mask=null,maskCount=0,available=new Uint8Array();
  const brushMode=()=>viewport.dataset.tool==='brush';
  const lassoMode=()=>viewport.dataset.tool==='lasso';
  const palette=()=>snapshot?.result?.palette || [];
  const newModel=()=>createPixelAssignments((snapshot?.result?.regions || []).map(r=>r.paletteIndex ?? -1),palette().length,snapshot?.result?.labels,snapshot?.source?.data);
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
  const grouped=()=>!individual&&selectedTreatment!==null&&selectedTreatment!==UNASSIGNED;
  const includes=i=>mask?!!mask[i]:grouped()?model.at(i)===selectedTreatment:selected>=0&&snapshot.result.labels[i]===selected&&(individual||model.at(i)===UNASSIGNED);
  function edges(){return displayEdges??=assignmentEdges(snapshot.result.labels,model.values,outline.width,outline.height,snapshot.source.data,model.overrides);}
  function controls() {
    const r=snapshot?.result?.regions[selected],value=selectedTreatment,editable=palette().length>0&&(grouped()||!!r&&model.automatic[selected]>=0);
    const treatment=value===UNBLEACHED?'Unbleached':`Intensity ${value}`;
    $('assign-selection').textContent=mask?`Lasso · ${maskCount.toLocaleString()} pixels`:lasso?'Drawing lasso…':grouped()?`${treatment} · all matching pixels`:r?`${individual?'Individual region · ':''}Area ${selected+1} · ${r.area.toLocaleString()} pixels`:!snapshot?.result?'Computing regions…':palette().length?'No area selected':'Assignment requires Quantized mode.';
    document.querySelectorAll('[data-bucket]').forEach(button=>{button.disabled=!palette().length||(brushMode()? !snapshot?.result:mask? !maskCount:lassoMode()? true:!editable);button.setAttribute('aria-pressed',String((brushMode()?brushTarget:!mask?value:null)===Number(button.dataset.bucket)));});
    $('assign-undo').disabled=!model.canUndo;$('assign-redo').disabled=!model.canRedo;
    let assigned=0;if(snapshot?.result)for(let i=0;i<snapshot.result.labels.length;i++)if(snapshot.source.data[i*4+3]&&model.at(i)!==UNASSIGNED)assigned++;
    $('assign-restore').textContent=grouped()?'Clear group assignment':'Clear assignment';
    $('assign-restore').disabled=mask?!maskCount:lassoMode()||!editable;
    $('unbleach-group').textContent=individual?'Make region unbleached':'Make group unbleached';
    $('unbleach-group').disabled=!!mask||lassoMode()||!editable||value<0;
    $('assign-count').textContent=snapshot?.result?`${assigned.toLocaleString()} pixels assigned`:'Computing…';
    $('reset-assignments').hidden=!model.edited;
  }
  function paintOverlay() {
    const ctx=overlay.getContext('2d');ctx.clearRect(0,0,overlay.width,overlay.height);
    if(!snapshot?.result)return;
    const {result,source}=snapshot,data=ctx.createImageData(overlay.width,overlay.height);
    for(let i=0;i<result.labels.length;i++) {
      const id=result.labels[i];if(!source.data[i*4+3])continue;
      const bucket=stroke?.ids.has(id)&&model.at(i)===UNASSIGNED?stroke.target:model.at(i);if(bucket===-1)continue;
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
      if(!snapshot.source.data[i*4+3]||(model.at(i)!==UNASSIGNED||stroke?.ids.has(id)))continue;
      // Small contrasting dots stay distinct from assigned tints and unbleached hatching.
      if(x%10<2&&y%10<2)data.data.set([25,125,165,190],i*4);
      else if(x%10<3&&y%10<3)data.data.set([255,255,255,180],i*4);
    }
    ctx.putImageData(data,0,0);
  }
  function deselect(){selected=-1;selectedTreatment=null;individual=false;lasso=null;mask=null;maskCount=0;paintSelection();controls();}
  function cancelStroke(){if(lasso){lasso=null;paintSelection();controls();}if(stroke){stroke=null;paintOverlay();paintHints();$('brush-status').textContent='Stroke cancelled';}cursor.hidden=true;}
  function imagePoint(e){const rect=outline.getBoundingClientRect();return {x:(e.clientX-rect.left)*outline.width/rect.width,y:(e.clientY-rect.top)*outline.height/rect.height};}
  function cursorAt(e){if(!brushMode()||$('assign-surface').hidden){cursor.hidden=true;return;}const rect=outline.getBoundingClientRect(),size=Number($('brush-size').value)*rect.width/outline.width;cursor.hidden=false;cursor.style.width=cursor.style.height=size+'px';cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px';}
  function extendStroke(e){if(!stroke)return;const next=imagePoint(e),previousCount=stroke.ids.size;
    collectBrushRegions({labels:snapshot.result.labels,width:outline.width,height:outline.height,from:stroke.last,to:next,radius:stroke.radius,eligible:id=>model.automatic[id]>=0&&available[id]},stroke.ids);
    stroke.last=next;if(stroke.ids.size!==previousCount){paintOverlay();paintHints();}$('brush-status').textContent=`${stroke.ids.size} regions in stroke`;
  }
  outline.addEventListener('pointerdown',e=>{
    if(!brushMode()||!snapshot?.result||!palette().length||e.button!==0||!e.isPrimary)return;
    selected=-1;selectedTreatment=null;individual=false;paintSelection();stroke={pointer:e.pointerId,last:imagePoint(e),radius:Number($('brush-size').value)/2,target:brushTarget,ids:new Set()};
    outline.setPointerCapture(e.pointerId);extendStroke(e);e.preventDefault();
  });
  outline.addEventListener('pointermove',e=>{cursorAt(e);if(stroke?.pointer===e.pointerId)extendStroke(e);});
  outline.addEventListener('pointerup',e=>{if(stroke?.pointer!==e.pointerId)return;extendStroke(e);const completed=stroke;stroke=null;
    const applied=model.brush(completed.ids,completed.target);changed();$('brush-status').textContent=applied?`${completed.ids.size} regions assigned`:'No unassigned regions touched';
  });
  outline.addEventListener('pointercancel',cancelStroke);
  outline.addEventListener('lostpointercapture',()=>{if(stroke||lasso?.pointer!=null)cancelStroke();});
  outline.addEventListener('pointerleave',()=>{if(!stroke)cursor.hidden=true;});
  viewport.addEventListener('canvas-navigation',cancelStroke);
  viewport.addEventListener('canvas-tool-change',()=>{$('brush-settings').hidden=!brushMode();$('lasso-settings').hidden=!lassoMode();if(brushMode())deselect();else controls();});
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
    if(!snapshot?.result)return;
    if(mask||selected>=0||grouped()){
      const data=ctx.createImageData(outline.width,outline.height),merged=individual?snapshot.result.edges:edges(),w=outline.width;
      for(let i=0;i<snapshot.result.labels.length;i++)if(includes(i)&&snapshot.source.data[i*4+3]){
        const edge=mask?(i%w===0||i%w===w-1||!mask[i-1]||!mask[i+1]||!mask[i-w]||!mask[i+w]):merged[i];
        data.data.set([255,190,40,edge?255:55],i*4);
      }
      ctx.putImageData(data,0,0);
    }
    if(lasso?.points.length){
      const scale=outline.width/Math.max(1,outline.getBoundingClientRect().width);
      ctx.beginPath();lasso.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.lineWidth=3*scale;ctx.strokeStyle='#18262e';ctx.stroke();ctx.lineWidth=1.5*scale;ctx.strokeStyle='#ffce57';ctx.setLineDash([5*scale,3*scale]);ctx.stroke();ctx.setLineDash([]);
    }
  }
  function changed(){
    displayEdges=null;available=new Uint8Array(model.values.length);
    if(snapshot?.result)for(let i=0;i<snapshot.result.labels.length;i++)if(model.at(i)===UNASSIGNED&&snapshot.source.data[i*4+3]&&snapshot.result.labels[i]>=0)available[snapshot.result.labels[i]]=1;
    paintOverlay();paintHints();paintBoundaries();paintSelection();controls();onChange(model.edited);
  }
  function assignSelected(to){
    const applied=mask?model.assignMask(mask,to):grouped()?model.setTreatment(selectedTreatment,to):model.setMany([selected],to,{protect:!individual&&selectedTreatment===UNASSIGNED});
    if(mask){mask=null;maskCount=0;}
    if(applied){if(to===UNASSIGNED){selected=-1;selectedTreatment=null;individual=false;}else if(selected>=0||grouped())selectedTreatment=to;changed();}else{paintSelection();controls();}
  }
  $('assignment-actions').addEventListener('click',event=>{
    const button=event.target.closest('[data-bucket]');
    if(button&&!button.disabled){brushTarget=Number(button.dataset.bucket);if(brushMode())controls();else assignSelected(brushTarget);}
  });
  $('assign-restore').addEventListener('click',()=>assignSelected(UNASSIGNED));
  $('unbleach-group').addEventListener('click',()=>assignSelected(UNBLEACHED));
  function finishLasso(){
    if(!lasso)return;
    mask=lassoMask(lasso.points,outline.width,outline.height,i=>snapshot.source.data[i*4+3]>0);lasso=null;
    maskCount=mask.reduce((sum,v)=>sum+v,0);if(!maskCount)mask=null;
    paintSelection();controls();
  }
  outline.addEventListener('pointerdown',e=>{
    if(!lassoMode()||!snapshot?.result||!palette().length||e.button!==0||!e.isPrimary)return;
    if(!lasso){deselect();lasso={points:[],pointer:null};}
    const p=imagePoint(e);lasso.points.push(p);lasso.pointer=e.pointerId;lasso.start={x:e.clientX,y:e.clientY};lasso.dragged=false;
    outline.setPointerCapture(e.pointerId);paintSelection();controls();e.preventDefault();
  });
  outline.addEventListener('pointermove',e=>{
    if(lasso?.pointer!==e.pointerId||!lassoMode())return;
    if(Math.hypot(e.clientX-lasso.start.x,e.clientY-lasso.start.y)>4)lasso.dragged=true;
    if(!lasso.dragged)return;
    const p=imagePoint(e),last=lasso.points.at(-1),step=outline.width/Math.max(1,outline.getBoundingClientRect().width);
    if(Math.hypot(p.x-last.x,p.y-last.y)>=step){lasso.points.push(p);paintSelection();}
  });
  outline.addEventListener('pointerup',e=>{
    if(lasso?.pointer!==e.pointerId)return;
    lasso.pointer=null;if(lasso.dragged){lasso.points.push(imagePoint(e));finishLasso();}
  });
  $('lasso-finish').addEventListener('click',finishLasso);
  function history(redo=false){cancelStroke();if(redo?model.redo():model.undo()){deselect();changed();}}
  $('assign-undo').addEventListener('click',()=>history());
  $('assign-redo').addEventListener('click',()=>history(true));
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
    if(viewport.dataset.tool!=='select'){down=null;return;}
    if(!snapshot?.result || (down && Math.hypot(event.clientX-down.x,event.clientY-down.y)>8)){down=null;return;}down=null;
    const rect=outline.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*outline.width/rect.width),y=Math.floor((event.clientY-rect.top)*outline.height/rect.height);
    if(x<0||y<0||x>=outline.width||y>=outline.height)return;
    const i=y*outline.width+x,id=snapshot.source.data[i*4+3]?snapshot.result.labels[i]:-1;
    const value=snapshot.source.data[i*4+3]?model.at(i):UNASSIGNED;
    const same=!individual&&!mask&&(value!==UNASSIGNED?selectedTreatment===value:id>=0&&id===selected&&selectedTreatment===UNASSIGNED);
    mask=null;maskCount=0;individual=false;selected=same?-1:id;selectedTreatment=same?null:value;paintSelection();controls();
  });
  outline.addEventListener('dblclick',event=>{
    if(viewport.dataset.tool!=='select'||!snapshot?.result)return;
    const point=imagePoint(event),x=Math.floor(point.x),y=Math.floor(point.y);
    if(x<0||y<0||x>=outline.width||y>=outline.height)return;
    const i=y*outline.width+x,id=snapshot.source.data[i*4+3]?snapshot.result.labels[i]:-1;
    if(id<0)return;
    selected=id;selectedTreatment=model.at(i);individual=true;paintSelection();controls();event.preventDefault();
  });
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey);}
    if(event.key==='Enter'&&lassoMode()&&lasso){event.preventDefault();finishLasso();}
    if(event.key==='Escape'){cancelStroke();deselect();showOriginal(false);}
  });
  return {
    boundaries:paintBoundaries,
    hints:paintHints,
    get edited(){return model.edited;},
    snapshot(){return model.values.slice();},
    pixelSnapshot(){return model.overrides.some(v=>v!==-3)?model.overrides.slice():undefined;},
    restore(values,pixels){cancelStroke();displayEdges=null;model=newModel();model.values.set(Int16Array.from(values,v=>v===0?UNBLEACHED:v));if(pixels)model.overrides.set(pixels);deselect();changed();},
    reset(){cancelStroke();displayEdges=null;model=newModel();deselect();changed();},
    update(next){cancelStroke();displayEdges=null;snapshot=next;model=newModel();selected=-1;selectedTreatment=null;individual=false;mask=null;maskCount=0;buildBuckets();
      for(const c of [original,overlay,outline,boundaries,quantized,hints]){c.width=next.source.width;c.height=next.source.height;}
      original.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(next.base),next.source.width,next.source.height),0,0);
      changed();}
  };
}
