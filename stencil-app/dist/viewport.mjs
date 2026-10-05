import {zoomAt,fitCamera,wheelCamera,panBetween} from './camera.mjs?v=input-3';
export function createViewport() {
  const $=id=>document.getElementById(id), viewport=$('canvas-viewport'),world=$('canvas-world');
  const single=$('single-image'),comparison=document.querySelector('.compare-grid'),assigned=$('assign-surface');
  for(const node of [single,comparison,assigned])world.append(node);
  // Settings are floating inspectors, independent of the canvas camera.
  $('view-settings').append(document.querySelector('.overlay-tools'));
  $('prepare-settings').append(...Array.from($('prepare-view').children));
  const pointers=new Map();let camera={scale:1,x:0,y:0},signature='',space=false,gesture=false,suppressUntil=0,mode='select',last=null,nativePinch=false,lastPinchScale=1,lastTouch=-Infinity;
  const active=()=>document.body.dataset.stage==='assign'?assigned:$('compare').checked?comparison:single;
  function dimensions(){const c=$('canvas');return {width:active()===comparison?c.width*3+24:c.width,height:c.height+(active()===comparison?30:0)};}
  function paint(){world.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.scale})`;$('camera-scale').textContent=`${Math.round(camera.scale*100)}%`;$('camera-slider').value=Math.log2(camera.scale);$('camera-slider').setAttribute('aria-valuetext',`${Math.round(camera.scale*100)} percent`);}
  function fit(){const d=dimensions();camera=fitCamera(d.width,d.height,viewport.clientWidth,viewport.clientHeight);paint();}
  function zoom(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2){camera=zoomAt(camera,factor,x,y);paint();}
  function refresh(){
    const c=$('canvas'),a=active();
    single.hidden=a!==single;comparison.hidden=a!==comparison;assigned.hidden=a!==assigned;
    single.style.width=assigned.style.width=c.width+'px';comparison.style.width=(c.width*3+24)+'px';
    const next=`${c.width}/${c.height}/${a.id || 'compare'}`;
    if(next!==signature){signature=next;fit();}
  }
  function local(e){const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function pair(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.button!==1)return;
    if(e.pointerType==='touch')lastTouch=performance.now();
    if(!pointers.size)suppressUntil=0;
    pointers.set(e.pointerId,{...local(e),start:local(e),type:e.pointerType});
    if(pointers.size===2){gesture=true;last=pair();viewport.setPointerCapture(e.pointerId);}
    else if(pointers.size===1){gesture=mode==='pan'||space||e.button===1;last=local(e);if(gesture)viewport.setPointerCapture(e.pointerId);}
    if(gesture){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  viewport.addEventListener('pointermove',e=>{
    const prev=pointers.get(e.pointerId);if(!prev)return;
    const p=local(e);pointers.set(e.pointerId,{...prev,...p,moved:prev.moved || Math.hypot(p.x-prev.start.x,p.y-prev.start.y)>5});
    if(pointers.size>=2){const next=pair();camera=panBetween(camera,last,next);last=next;gesture=true;}
    else {
      if(gesture){camera.x+=p.x-prev.x;camera.y+=p.y-prev.y;}last=p;
    }
    if(gesture){paint();e.preventDefault();e.stopImmediatePropagation();}
  },true);
  function end(e){
    if(e.pointerType==='touch')lastTouch=performance.now();
    if(gesture || pointers.get(e.pointerId)?.moved)suppressUntil=performance.now()+600;
    pointers.delete(e.pointerId);
    if(pointers.size===1)last=[...pointers.values()][0];
    if(!pointers.size){gesture=false;last=null;}
  }
  viewport.addEventListener('pointerup',end,true);viewport.addEventListener('pointercancel',end,true);
  viewport.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))end(e);});
  viewport.addEventListener('click',e=>{if(performance.now()<suppressUntil||mode==='pan'||space){e.preventDefault();e.stopImmediatePropagation();}},true);
  viewport.addEventListener('wheel',e=>{
    e.preventDefault();
    if(e.ctrlKey && (nativePinch || performance.now()-lastTouch<800))return;
    const p=local(e);camera=wheelCamera(camera,e,p.x,p.y,viewport.clientHeight);paint();
  },{passive:false});
  // Safari exposes trackpad pinch through GestureEvent instead of Ctrl+wheel.
  viewport.addEventListener('gesturestart',e=>{
    e.preventDefault();if(performance.now()-lastTouch<800)return;
    nativePinch=true;lastPinchScale=e.scale || 1;
  },{passive:false});
  viewport.addEventListener('gesturechange',e=>{
    e.preventDefault();if(!nativePinch || performance.now()-lastTouch<800)return;
    const p=local(e);zoom(e.scale/lastPinchScale,Number.isFinite(p.x)?p.x:viewport.clientWidth/2,Number.isFinite(p.y)?p.y:viewport.clientHeight/2);lastPinchScale=e.scale;
  },{passive:false});
  viewport.addEventListener('gestureend',e=>{e.preventDefault();nativePinch=false;},{passive:false});
  function toolState(){const effective=space?'pan':mode;viewport.dataset.tool=effective;for(const name of ['select','pan'])$('tool-'+name).setAttribute('aria-pressed',String(name===effective));}
  function chooseTool(name){mode=name;toolState();}
  for(const name of ['select','pan'])$('tool-'+name).addEventListener('click',()=>chooseTool(name));
  $('camera-slider').addEventListener('input',()=>zoom(2**Number($('camera-slider').value)/camera.scale));
  $('camera-fit').addEventListener('click',fit);$('camera-in').addEventListener('click',()=>zoom(1.25));$('camera-out').addEventListener('click',()=>zoom(.8));
  $('toggle-inspector').addEventListener('click',()=>{const open=$('inspector').hidden;$('inspector').hidden=!open;if(open){$('floating-settings').hidden=true;$('toggle-settings').setAttribute('aria-expanded','false');}$('toggle-inspector').setAttribute('aria-expanded',String(open));});
  $('close-inspector').addEventListener('click',()=>{$('inspector').hidden=true;$('toggle-inspector').setAttribute('aria-expanded','false');});
  $('toggle-settings').addEventListener('click',()=>{const open=$('floating-settings').hidden;$('floating-settings').hidden=!open;if(open){$('inspector').hidden=true;$('toggle-inspector').setAttribute('aria-expanded','false');}$('toggle-settings').setAttribute('aria-expanded',String(open));});
  $('close-settings').addEventListener('click',()=>{$('floating-settings').hidden=true;$('toggle-settings').setAttribute('aria-expanded','false');});
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea,[contenteditable="true"]') || e.ctrlKey || e.metaKey || e.altKey)return;
    if(e.code==='Space'){
      // Keep native Space activation for controls; the canvas gets temporary Pan.
      if(e.target.closest('button,summary'))return;
      space=true;e.preventDefault();toolState();
    }
    if(e.key.toLowerCase()==='v')chooseTool('select');
    if(e.key.toLowerCase()==='h')chooseTool('pan');
    if(e.key==='Escape'){$('inspector').hidden=true;$('floating-settings').hidden=true;for(const id of ['toggle-settings','toggle-inspector'])$(id).setAttribute('aria-expanded','false');}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;toolState();}});
  window.addEventListener('blur',()=>{space=false;pointers.clear();gesture=false;nativePinch=false;toolState();});
  new ResizeObserver(()=>{if(signature)fit();}).observe(viewport);
  return {refresh,fit,preset(value){if(value==='fit')fit();else zoom(Number(value)/100/camera.scale);}};
}
