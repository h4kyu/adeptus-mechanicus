import {createAssignments,UNBLEACHED} from './assignments.mjs?v=palette-groups-2';
export function setupAssign(onChange) {
  const $=id=>document.getElementById(id), original=$('assign-original'),overlay=$('assign-overlay'),outline=$('assign-outline');
  let snapshot=null,model=createAssignments(),selected=-1;
  const palette=()=>snapshot?.result?.palette || [];
  const newModel=()=>createAssignments((snapshot?.result?.regions || []).map(r=>r.paletteIndex ?? -1),palette().length);
  function buildBuckets() {
    $('assignment-groups').replaceChildren();
    palette().forEach((rgb,id)=>{
      const button=document.createElement('button'),chip=document.createElement('i');
      button.dataset.bucket=id;chip.className='swatch';chip.style.background=`rgb(${rgb.join(',')})`;
      button.append(chip,`Group ${id+1}`);button.title=`RGB ${rgb.join(', ')}`;
      $('assignment-groups').append(button);
    });
  }
  function controls() {
    const r=snapshot?.result?.regions[selected],value=model.values[selected],editable=!!r && model.automatic[selected]>=0;
    $('assign-selection').textContent=r?`Area ${selected+1} · ${r.area.toLocaleString()} pixels · ${value===UNBLEACHED?'Unbleached':value>=0?'Group '+(value+1):'No palette group'}`:!snapshot?.result?'Computing regions…':palette().length?'No area selected':'Assignment requires Quantized mode.';
    document.querySelectorAll('[data-bucket]').forEach(button=>{button.disabled=!editable;button.setAttribute('aria-pressed',String(!!r && value===Number(button.dataset.bucket)));});
    $('assign-undo').disabled=!model.canUndo;$('assign-redo').disabled=!model.canRedo;
    let changed=0;for(let i=0;i<model.values.length;i++)if(model.values[i]!==model.automatic[i])changed++;
    $('assign-restore').disabled=!editable || value===model.automatic[selected];
    $('unbleach-group').disabled=!editable || value<0;
    $('assign-count').textContent=snapshot?.result?`${changed} changed`:'Computing…';
    $('reset-assignments').hidden=!model.edited;
    onChange(model.edited);
  }
  function paintOverlay() {
    const ctx=overlay.getContext('2d');ctx.clearRect(0,0,overlay.width,overlay.height);
    if(!snapshot?.result)return;
    const {result,source}=snapshot,data=ctx.createImageData(overlay.width,overlay.height);
    for(let i=0;i<result.labels.length;i++) {
      const id=result.labels[i];if(id<0||!source.data[i*4+3])continue;
      const bucket=model.values[id];if(bucket===-1)continue;
      // A subtle hatch distinguishes unbleached from a naturally black group.
      const hatch=((i%overlay.width)+Math.floor(i/overlay.width))%12<2;
      const color=bucket===UNBLEACHED?(hatch?[95,125,145]:[12,16,20]):palette()[bucket];
      data.data.set(color,i*4);data.data[i*4+3]=255*source.data[i*4+3]/255;
    }
    ctx.putImageData(data,0,0);
  }
  function paintSelection() {
    const ctx=outline.getContext('2d');ctx.clearRect(0,0,outline.width,outline.height);
    const r=snapshot?.result?.regions[selected];if(!r)return;
    const [x,y,right,bottom]=r.bounds,w=right-x+1,h=bottom-y+1,data=ctx.createImageData(w,h);
    for(let row=y;row<=bottom;row++)for(let col=x;col<=right;col++) {
      const i=row*outline.width+col;if(snapshot.result.labels[i]!==selected || !snapshot.source.data[i*4+3])continue;
      const p=((row-y)*w+col-x)*4;data.data.set([255,190,40,snapshot.result.edges[i]?255:45],p);
    }
    ctx.putImageData(data,x,y);
  }
  function changed(){paintOverlay();controls();}
  $('assignment-actions').addEventListener('click',event=>{
    const button=event.target.closest('[data-bucket]');
    if(button && !button.disabled && model.set(selected,Number(button.dataset.bucket)))changed();
  });
  $('assign-restore').addEventListener('click',()=>{if(model.restore(selected))changed();});
  $('unbleach-group').addEventListener('click',()=>{
    const group=model.values[selected];if(!(group>=0))return;
    const ids=[];for(let i=0;i<model.values.length;i++)if(model.values[i]===group)ids.push(i);
    if(model.setMany(ids,UNBLEACHED))changed();
  });
  $('assign-undo').addEventListener('click',()=>{if(model.undo())changed();});
  $('assign-redo').addEventListener('click',()=>{if(model.redo())changed();});
  $('assign-clear').addEventListener('click',()=>{selected=-1;paintSelection();controls();});
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
    if(!snapshot?.result || (down && Math.hypot(event.clientX-down.x,event.clientY-down.y)>8)){down=null;return;}down=null;
    const rect=outline.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)*outline.width/rect.width),y=Math.floor((event.clientY-rect.top)*outline.height/rect.height);
    if(x<0||y<0||x>=outline.width||y>=outline.height)return;
    const i=y*outline.width+x,id=snapshot.source.data[i*4+3]?snapshot.result.labels[i]:-1;
    selected=id===selected?-1:id;paintSelection();controls();
  });
  document.addEventListener('keydown',event=>{
    if(document.body.dataset.stage!=='assign'||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey?model.redo():model.undo())changed();}
    if(event.key==='Escape'){selected=-1;paintSelection();controls();showOriginal(false);}
  });
  return {
    get edited(){return model.edited;},
    reset(){model=newModel();selected=-1;paintOverlay();paintSelection();controls();},
    update(next){snapshot=next;model=newModel();selected=-1;buildBuckets();
      for(const c of [original,overlay,outline]){c.width=next.source.width;c.height=next.source.height;}
      original.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(next.base),next.source.width,next.source.height),0,0);
      paintOverlay();paintSelection();controls();}
  };
}
