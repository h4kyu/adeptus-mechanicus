import { createViewport } from './viewport.mjs?v=compact-4';
import { setupAssign } from './assign-ui.mjs?v=compact-4';
import { createRenderer } from './render.mjs';
const $ = id => document.getElementById(id);
const assignment=setupAssign(edited=>{
  $('detection-controls').disabled=edited;$('edit-lock').hidden=!edited;
});
async function confirmReset(){
  if(!assignment.edited)return true;
  const dialog=$('discard-dialog');if(dialog.open)return false;
  return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='discard'),{once:true});dialog.showModal();});
}
function setStage(stage){document.body.dataset.stage=stage;for(const name of ['prepare','assign'])$('stage-'+name).setAttribute('aria-pressed',String(stage===name));$('toggle-inspector').textContent=stage==='prepare'?'⚙ Prepare':'◧ Groups';camera.refresh();}
const render=createRenderer();
let preparedBase;
let committedMinimum=20;
const canvas = $('canvas'), context = canvas.getContext('2d');
let source, base, smoothedBase, result, worker, timer, revision = 0, uploadRevision = 0;
let hiddenLayers = new Set(), selectedLayer = -1;
let hover = -1, selected = -1, picking = false, drawQueued = false;
let inspectSide = 'after', hoverSide = 'after', sideStates = {};
const segmentationFor = side => side === 'before' ? result?.baseline || result : result;
const inspected = () => segmentationFor(inspectSide);
const stateFor = side => side === inspectSide ? {hiddenLayers, selected, selectedLayer} :
  sideStates[side] || {hiddenLayers:new Set(), selected:-1, selectedLayer:-1};
function switchInspection(side) {
  if(side === inspectSide || !result)return;
  sideStates[inspectSide]={hiddenLayers, selected, selectedLayer};
  const state=stateFor(side);
  inspectSide=side;
  hiddenLayers=state.hiddenLayers;selected=state.selected;selectedLayer=state.selectedLayer;hover=-1;
  $('inspect-side').value=side;
  renderPalette();
  const data=inspected();
  $('status').textContent=`${data.regions.length.toLocaleString()} areas · ${data.ignoredPixels.toLocaleString()} pixels in filtered-out regions`;
}


function syncControls() {
  const quant = $('mode').value === 'quantized';
  const gray=quant && $('color-space').value==='grayscale';
  $('group-label').textContent=gray?'Brightness groups':'Color groups';
  $('assignment-group-title').textContent=gray?'Intensity groups':'Color groups';
  $('palette-settings').hidden=!quant;
  $('quantized-settings').hidden = !quant;
  $('color-space-settings').hidden = !quant;
  $('smoothing-settings').hidden = !quant;
  $('preprocessing-details').hidden = !quant;
  $('cleanup-settings').hidden = !quant;
  $('cleanup-controls').hidden = !$('cleanup').checked;
  const stage=$('cleanup').checked?'cleanup':'smoothing';
  $('compare-label').textContent=`Compare before / after ${stage}`;
  $('original-compare').setAttribute('aria-label',`Segmentation before ${stage} with its own boundaries`);
  $('smoothed-compare').setAttribute('aria-label',`Segmentation after ${stage} with its own boundaries`);
  for(const option of $('inspect-side').options)option.textContent=`${option.value==='before'?'Before':'After'} ${stage}`;
  const canCompare=quant && ($('cleanup').checked || $('smoothing').checked);
  $('compare-control').hidden=!canCompare;
  $('compare').disabled=!canCompare;
  if(!canCompare)$('compare').checked=false;
  $('smoothing-controls').hidden = !$('smoothing').checked;
  $('radius-value').textContent = `${$('smooth-radius').value} px`;
  $('strength-value').textContent = $('smooth-strength').value;

  $('color-count-value').textContent = $('color-count').value;
  const sil = $('mode').value === 'silhouette', alpha = $('background-mode').value === 'alpha';
  $('background-settings').hidden = !sil;
  $('color-settings').hidden = alpha;
  $('tolerance-settings').hidden = quant || (sil && alpha);
  $('tolerance-label').textContent = sil ? 'Background tolerance' : 'Color tolerance';
  $('tolerance-value').textContent = `${$('tolerance').value}%`;
  $('alpha-value').textContent = `${$('alpha').value}%`;
}

function compute() {
  if(assignment.edited)return;
  syncControls(); cancelPick();
  if (!source) return;
  clearTimeout(timer); worker?.terminate();
  const current = ++revision;
  hover = selected = -1; result = null; smoothedBase = null; preparedBase = null; $('palette').replaceChildren();
  hiddenLayers = new Set(); sideStates = {}; inspectSide = hoverSide = 'after'; $('inspect-side').value='after'; selectedLayer = -1;
  $('status').textContent = 'Computing areas…'; assignment.update({source,base,result:null});draw();
  timer = setTimeout(() => {
    const hex = $('background').value;
    const value = $('min-size').value.trim()===''?committedMinimum:Number($('min-size').value);
    const minSize = Math.max(1, Math.min(1000000, Number.isFinite(value) ? Math.round(value) : 1));
    worker = new Worker('./region-worker.mjs?v=compact-4', {type:'module'});
    const fail = message => {
      if (current !== revision) return;
      $('status').textContent = 'Detection failed'; $('error').textContent = message;
    };
    worker.onerror = () => fail('Could not compute areas. Try a smaller image or reload the editor.');
    worker.onmessage = ({data}) => {
      if (data.revision !== revision) return;
      if (data.error) { fail(data.error); return; }
      result = data; $('error').textContent = ''; buildSmoothedView(); renderPalette();
      $('status').textContent = `${data.regions.length.toLocaleString()} areas · ${data.ignoredPixels.toLocaleString()} pixels in filtered-out regions`;
      assignment.update({source,base,result});draw(); worker.terminate();
    };
    worker.postMessage({revision:current, pixels:source.data, width:source.width, height:source.height,
      options:{cleanup:$('cleanup').checked,cleanupSize:Number($('cleanup-size').value),colorSpace:$('color-space').value,smoothing:$('smoothing').checked, smoothRadius:Number($('smooth-radius').value), smoothStrength:Number($('smooth-strength').value)/100, mode:$('mode').value, colorCount:Number($('color-count').value), tolerance:Number($('tolerance').value)/100,
        backgroundMode:$('background-mode').value, background:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),
        alphaCutoff:Number($('alpha').value)/100, minSize}});
  }, 140);
}

function composite(pixels) {
  const output=new Uint8ClampedArray(base);
  for(let i=0;i<base.length;i+=4)for(let c=0;c<3;c++)
    output[i+c]=base[i+c]+(pixels[i+c]-source.data[i+c])*source.data[i+3]/255;
  return output;
}
function buildSmoothedView() {
  preparedBase=result.prepared?composite(result.prepared):base;
  if(result.smoothed)smoothedBase=composite(result.smoothed);
}

function renderPalette() {
  $('palette').replaceChildren();
  const colors=inspected()?.palette || [];
  colors.forEach((rgb,id)=>{
    const button=document.createElement('button'),chip=document.createElement('i');
    const hidden=hiddenLayers.has(id);
    button.type='button';button.className='palette-toggle';button.classList.toggle('is-hidden',hidden);
    button.setAttribute('aria-label',`${hidden?'Show':'Hide'} group ${id+1}`);button.setAttribute('aria-pressed',String(!hidden));
    chip.className='swatch';chip.style.background=`rgb(${rgb.join(',')})`;
    const eye=document.createElementNS('http://www.w3.org/2000/svg','svg');eye.setAttribute('viewBox','0 0 24 24');eye.setAttribute('aria-hidden','true');eye.classList.add('visibility-eye');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',hidden?'M3 3L21 21M9 5C5 6 2 12 2 12s4 7 10 7c2 0 4-1 5-2M14 5c5 1 8 7 8 7l-3 4':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0');eye.append(path);
    button.append(chip,String(id+1),eye);
    button.addEventListener('click',()=>{
      if(hiddenLayers.has(id))hiddenLayers.delete(id);else hiddenLayers.add(id);
      if(hiddenLayers.has(inspected()?.regions[selected]?.paletteIndex))selected=-1;
      hover=-1;selectedLayer=-1;renderPalette();draw();
    });$('palette').append(button);
  });
}
function visibleRegion(id) {
  return id >= 0 && !hiddenLayers.has(inspected().regions[id]?.paletteIndex) ? id : -1;
}

function draw() {
  if (!base) return;
  drawComparison();
  camera.refresh();
  if(!$('compare').checked)render(canvas,{
    pixels:base,
    base,source:source.data,segmentation:picking?null:result,width:canvas.width,height:canvas.height,
    hidden:hiddenLayers,palette:!picking && $('show-palette').checked,edges:$('outlines').checked,
    hover,selected,layer:selectedLayer
  });

}
function drawComparison() {
  const comparing=$('compare').checked;
  $('comparison').hidden=!comparing;$('single-image').hidden=comparing;
  document.querySelector('.workspace').classList.toggle('comparing',comparing);
  if(!comparing)return;
  render($('source-compare'),{pixels:base,width:canvas.width,height:canvas.height});
  const before=result?.baseline || (result && !result.smoothed ? result : null);
  for(const [id,pixels,segmentation,caption,side] of [
    ['original-compare',result?.comparison==='cleanup'?(smoothedBase || preparedBase || base):preparedBase || base,before,'original-caption','before'],
    ['smoothed-compare',smoothedBase || preparedBase || base,result,'smoothed-caption','after']]) {
    const state=stateFor(side);
    render($(id),{pixels,base,source:source.data,segmentation,width:canvas.width,height:canvas.height,
      hidden:state.hiddenLayers,palette:$('show-palette').checked,edges:$('outlines').checked,
      hover:hoverSide===side?hover:-1,selected:state.selected,layer:state.selectedLayer});
    $(caption).textContent=`${side==='before'?'Before':'After'} ${result?.comparison || ($('cleanup').checked?'cleanup':'smoothing')} · ${segmentation?segmentation.regions.length.toLocaleString()+' areas':'computing…'}`;
  }
}

function scheduleDraw() { if(!drawQueued) {drawQueued=true; requestAnimationFrame(()=>{drawQueued=false;draw();});} }
function cancelPick() {
  picking=false; canvas.style.cursor=''; $('pick').textContent='Pick background from image'; $('pick').setAttribute('aria-pressed','false');
}
function point(event) {
  const rect=event.currentTarget.getBoundingClientRect();
  return Math.min(canvas.height-1,Math.max(0,Math.floor((event.clientY-rect.top)*canvas.height/rect.height)))*canvas.width+
    Math.min(canvas.width-1,Math.max(0,Math.floor((event.clientX-rect.left)*canvas.width/rect.width)));
}
function updateZoom(){camera.preset($('zoom').value);}
async function setSource(image,name) {
  if(!await confirmReset())return;
  assignment.reset();
  const w=image.naturalWidth||image.width, h=image.naturalHeight||image.height;
  canvas.width=w; canvas.height=h;
  context.clearRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
  source=context.getImageData(0,0,canvas.width,canvas.height);
  base=new Uint8ClampedArray(source.data.length);
  let transparent=false;
  for(let i=0;i<source.data.length;i+=4) {
    const a=source.data[i+3]/255, pixel=i/4;
    const checker=(Math.floor((pixel%canvas.width)/12)+Math.floor(Math.floor(pixel/canvas.width)/12))%2 ? 218 : 240;
    for(let k=0;k<3;k++) base[i+k]=source.data[i+k]*a+checker*(1-a);
    base[i+3]=255; if(a===0) transparent=true;
  }
  $('background-mode').value=transparent?'alpha':'color'; $('background').value='#ffffff';
  $('filename').textContent=name; $('error').textContent='';
  $('dimensions').textContent=`${canvas.width} × ${canvas.height} px · original resolution`;
  updateZoom();compute();
}
function sample() {
  uploadRevision++; $('file').value='';
  const image=document.createElement('canvas'); image.width=900; image.height=620;
  const ctx=image.getContext('2d'); ctx.fillStyle='white'; ctx.fillRect(0,0,900,620);
  ctx.fillStyle='#ef553d'; ctx.fillRect(70,70,240,180);
  ctx.fillStyle='#397af0'; ctx.fillRect(310,70,230,180);
  const gradient=ctx.createLinearGradient(80,0,810,0); gradient.addColorStop(0,'#8e2dd3'); gradient.addColorStop(1,'#f8b632');
  ctx.fillStyle=gradient; ctx.fillRect(70,310,740,100);
  ctx.font='bold 140px sans-serif';ctx.fillStyle='#25855b';ctx.fillText('BO',580,230);
  ctx.font='24px sans-serif';ctx.fillStyle='#242833';ctx.fillText('Solids · touching colors · holes · gradient',70,520);
  setSource(image,'Color and boundary sample');
}
$('file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;const request=++uploadRevision;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>25*1024*1024){$('error').textContent='Choose a PNG, JPG or WebP smaller than 25 MB.';return;}
  const url=URL.createObjectURL(file);
  try {const image=new Image();image.src=url;await image.decode();if(request===uploadRevision)await setSource(image,file.name);}
  catch {if(request===uploadRevision)$('error').textContent='Could not open this image.';}
  finally {URL.revokeObjectURL(url);}
});
for(const id of ['cleanup','color-space','mode','background-mode','background','tolerance','alpha','color-count','smoothing','smooth-radius','smooth-strength']) $(id).addEventListener('input',compute);
$('outlines').addEventListener('change',draw);
$('show-palette').addEventListener('change',draw);
$('compare').addEventListener('change',()=>{
  if(!$('compare').checked)switchInspection('after');draw();
});
$('inspect-side').addEventListener('change',()=>{switchInspection($('inspect-side').value);draw();});
for(const id of ['min-size','cleanup-size'])$(id).addEventListener('change',()=>{
  const fallback=id==='min-size'?committedMinimum:20;
  const value=$(id).value.trim()===''?fallback:Number($(id).value);
  $(id).value=Math.max(1,Math.min(1000000,Math.round(value)||fallback));
  if(id==='min-size')committedMinimum=Number($(id).value);
  compute();
});
$('zoom').addEventListener('change',updateZoom);
$('demo').addEventListener('click',sample);
$('pick').addEventListener('click',()=>{
  if(picking){cancelPick();draw();return;}
  $('compare').checked=false; picking=true; hover=-1; canvas.style.cursor='crosshair'; $('pick').textContent='Cancel picking';$('pick').setAttribute('aria-pressed','true');
});
canvas.addEventListener('pointermove',event=>{if(picking||!result)return;hoverSide='after';const id=visibleRegion(result.labels[point(event)]);if(id!==hover){hover=id;scheduleDraw();}});
canvas.addEventListener('pointerleave',()=>{hover=-1;scheduleDraw();});
canvas.addEventListener('click',event=>{
  const i=point(event);
  if(picking){
    const p=i*4;
    if(source.data[p+3]===0)$('background-mode').value='alpha';
    else{$('background-mode').value='color';$('background').value='#'+Array.from(source.data.slice(p,p+3),v=>v.toString(16).padStart(2,'0')).join('');}
    compute();return;
  }
  if(!result)return;
  const id=visibleRegion(result.labels[i]);selected=selected===id?-1:id; hover=-1;selectedLayer=-1;renderPalette();draw();
});
for(const [id,side] of [['original-compare','before'],['smoothed-compare','after']]) {
  const target=$(id);
  target.addEventListener('pointermove',event=>{
    const segmentation=segmentationFor(side);if(!segmentation)return;
    const region=segmentation.labels[point(event)], state=stateFor(side);
    const next=region>=0 && !state.hiddenLayers.has(segmentation.regions[region].paletteIndex)?region:-1;
    if(next!==hover || hoverSide!==side){hover=next;hoverSide=side;scheduleDraw();}
  });
  target.addEventListener('pointerleave',()=>{hover=-1;scheduleDraw();});
  target.addEventListener('click',event=>{
    if(!result)return;
    switchInspection(side);
    const region=visibleRegion(inspected().labels[point(event)]);
    selected=selected===region?-1:region;hover=-1;selectedLayer=-1;
    renderPalette();draw();
  });
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelPick();selected=hover=selectedLayer=-1;renderPalette();draw();}});
for(const stage of ['prepare','assign'])$('stage-'+stage).addEventListener('click',()=>setStage(stage));
$('reset-assignments').addEventListener('click',async()=>{if(await confirmReset())assignment.reset();});
window.addEventListener('beforeunload',event=>{if(assignment.edited){event.preventDefault();event.returnValue='';}});
const camera=createViewport();
syncControls();sample();
