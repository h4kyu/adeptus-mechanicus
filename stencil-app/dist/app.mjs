import { createRenderer } from './render.mjs';
import { groupLayers } from './layers.mjs';
const $ = id => document.getElementById(id);
const render=createRenderer();
let preparedBase;
const canvas = $('canvas'), context = canvas.getContext('2d');
let source, base, smoothedBase, result, worker, timer, revision = 0, uploadRevision = 0;
let layers = [], hiddenLayers = new Set(), selectedLayer = -1;
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
  buildLayers();updateList();
  const data=inspected();
  $('status').textContent=`${data.regions.length.toLocaleString()} areas · ${data.ignoredPixels.toLocaleString()} pixels in filtered-out regions`;
}


function syncControls() {
  const quant = $('mode').value === 'quantized';
  const gray=quant && $('color-space').value==='grayscale';
  $('group-label').textContent=gray?'Brightness groups':'Color groups';
  $('image-view').options[0].textContent=gray?'Grayscale input':'Original';
  $('quantized-settings').hidden = !quant;
  $('color-space-settings').hidden = !quant;
  $('smoothing-settings').hidden = !quant;
  $('compare').disabled = !quant;
  if(!quant)$('compare').checked=false;
  $('smoothing-controls').hidden = !$('smoothing').checked;
  $('radius-value').textContent = `${$('smooth-radius').value} px`;
  $('strength-value').textContent = $('smooth-strength').value;
  $('layer-panel').hidden = !quant;
  $('color-count-value').textContent = $('color-count').value;
  const sil = $('mode').value === 'silhouette', alpha = $('background-mode').value === 'alpha';
  $('background-settings').hidden = !sil;
  $('color-settings').hidden = alpha;
  $('tolerance-settings').hidden = quant || (sil && alpha);
  $('tolerance-label').textContent = sil ? 'Background tolerance' : 'Color tolerance';
  $('tolerance-value').textContent = `${$('tolerance').value}%`;
  $('alpha-value').textContent = `${$('alpha').value}%`;
  $('mode-help').textContent = quant && gray ? 'Convert to grayscale, then group similar brightness and find connected pieces. More groups preserve smaller brightness differences.' : quant ? 'Reduce the image to a palette, then find connected pieces of each color. Fewer colors simplify; more colors preserve distinctions.' : sil ? 'Separate foreground silhouettes and background areas; ignore internal foreground colors. Holes remain separate background regions.' : 'Group connected pixels similar to a starting color. Gradients split into areas; increasing tolerance generally produces broader areas.';
}

function compute() {
  syncControls(); cancelPick();
  if(!$('smoothing').checked || $('mode').value!=='quantized')$('image-view').value='original';
  if (!source) return;
  clearTimeout(timer); worker?.terminate();
  const current = ++revision;
  hover = selected = -1; result = null; smoothedBase = null; preparedBase = null; syncImageView(); $('palette').replaceChildren();
  layers = []; hiddenLayers = new Set(); sideStates = {}; inspectSide = hoverSide = 'after'; $('inspect-side').value='after'; selectedLayer = -1; $('layers').replaceChildren();
  $('region').replaceChildren(new Option('Computing…','')); $('region').disabled = true;
  $('status').textContent = 'Computing areas…'; draw();
  timer = setTimeout(() => {
    const hex = $('background').value;
    const value = Number($('min-size').value);
    const minSize = Math.max(1, Math.min(1000000, Number.isFinite(value) ? Math.round(value) : 1));
    $('min-size').value = minSize;
    worker = new Worker('./region-worker.mjs', {type:'module'});
    const fail = message => {
      if (current !== revision) return;
      $('status').textContent = 'Detection failed'; $('error').textContent = message;
    };
    worker.onerror = () => fail('Could not compute areas. Try a smaller image or reload the editor.');
    worker.onmessage = ({data}) => {
      if (data.revision !== revision) return;
      if (data.error) { fail(data.error); return; }
      result = data; $('error').textContent = ''; buildSmoothedView(); buildPaletteView(); buildLayers(); syncImageView();
      $('status').textContent = `${data.regions.length.toLocaleString()} areas · ${data.ignoredPixels.toLocaleString()} pixels in filtered-out regions`;
      $('region').disabled = false; updateList(); draw(); worker.terminate();
    };
    worker.postMessage({revision:current, pixels:source.data, width:source.width, height:source.height,
      options:{colorSpace:$('color-space').value,smoothing:$('smoothing').checked, smoothRadius:Number($('smooth-radius').value), smoothStrength:Number($('smooth-strength').value)/100, mode:$('mode').value, colorCount:Number($('color-count').value), tolerance:Number($('tolerance').value)/100,
        backgroundMode:$('background-mode').value, background:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),
        alphaCutoff:Number($('alpha').value)/100, minSize}});
  }, 140);
}

function syncImageView() {
  const enabled=Boolean(smoothedBase);
  $('image-view').options[1].disabled=!enabled;
  // Reduced palette is a separate view; underlying image choice is retained.
  $('image-view').disabled=$('show-palette').checked && $('mode').value==='quantized';
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

function buildPaletteView() {
  if(!result.palette) return;
  result.palette.forEach((rgb,i)=>{
    const item=document.createElement('span'), chip=document.createElement('i');
    chip.className='swatch';chip.style.background=`rgb(${rgb.join(',')})`;
    item.append(chip, String(i+1));item.title=`Palette ${i+1}: RGB ${rgb.join(', ')}`;$('palette').append(item);
  });
}

function buildLayers() {
  layers = groupLayers(inspected().palette || [], inspected().regions);
  renderLayers();
}
function renderLayers() {
  $('layers').replaceChildren();
  for (const layer of layers) {
    const row=document.createElement('div'); row.className='layer-row';
    const visible=document.createElement('input'); visible.type='checkbox';
    visible.checked=!hiddenLayers.has(layer.id);
    visible.setAttribute('aria-label',`Show layer ${layer.id+1}`);
    visible.addEventListener('change',()=>{
      if(visible.checked) hiddenLayers.delete(layer.id); else hiddenLayers.add(layer.id);
      if(hiddenLayers.has(layer.id)) {
        if(selectedLayer===layer.id) selectedLayer=-1;
        if(inspected().regions[selected]?.paletteIndex===layer.id) selected=-1;
        hover=-1;
      }
      renderLayers(); updateList(); draw();
    });
    const button=document.createElement('button'); button.className='layer-button';
    button.disabled=hiddenLayers.has(layer.id);
    button.setAttribute('aria-pressed',String(selectedLayer===layer.id));
    const chip=document.createElement('i');chip.className='swatch';chip.style.background=`rgb(${layer.color.join(',')})`;
    button.append(chip,`Layer ${layer.id+1} · ${layer.regionIds.length} areas`);
    button.addEventListener('click',()=>{
      selectedLayer=selectedLayer===layer.id?-1:layer.id;selected=hover=-1;
      renderLayers();updateList();draw();
    });
    row.append(visible,button);$('layers').append(row);
  }
}
function visibleRegion(id) {
  return id >= 0 && !hiddenLayers.has(inspected().regions[id]?.paletteIndex) ? id : -1;
}

function updateList() {
  $('region').replaceChildren(new Option('None',''));
  const eligible = inspected().regions.filter(r=>!hiddenLayers.has(r.paletteIndex));
  const listed = eligible.slice(0,200);
  if (selected >= 0 && !listed.some(r=>r.id===selected)) listed.push(inspected().regions[selected]);
  for (const r of listed) $('region').add(new Option(`#${r.id+1} · ${r.kind} · ${r.area.toLocaleString()} px`, String(r.id)));
  $('region').value = selected < 0 ? '' : String(selected);
  $('region-help').textContent = eligible.length > 200 ? 'List shows the 200 largest areas and your selection. Hover or click any other area on the image.' : 'You can also hover or click directly on the image.';
}

function draw() {
  if (!base) return;
  drawComparison();
  if(!$('compare').checked)render(canvas,{
    pixels:picking ? base : $('image-view').value==='smoothed' && smoothedBase ? smoothedBase : preparedBase || base,
    base,source:source.data,segmentation:picking?null:result,width:canvas.width,height:canvas.height,
    hidden:hiddenLayers,palette:!picking && $('show-palette').checked,edges:$('outlines').checked,
    hover,selected,layer:selectedLayer
  });
  const id = hover >= 0 ? hover : selected;
  const r = (hover >= 0 ? segmentationFor(hoverSide) : inspected())?.regions[id];
  $('detail').textContent = r ? `${id===hover ? 'Hover' : 'Selected'} #${id+1} · ${r.kind} · ${r.area.toLocaleString()} pixels (${(r.area/(canvas.width*canvas.height)*100).toFixed(2)}%) · Bounds ${r.bounds[2]-r.bounds[0]+1} × ${r.bounds[3]-r.bounds[1]+1} px` : selectedLayer >= 0 ? `Layer ${selectedLayer+1} · ${layers[selectedLayer].regionIds.length} areas · ${layers[selectedLayer].area.toLocaleString()} pixels` : result && !result.regions.length ? 'No areas meet the minimum size. Lower Minimum area.' : 'No area selected.';
}
function drawComparison() {
  const comparing=$('compare').checked;
  $('comparison').hidden=!comparing;$('single-image').hidden=comparing;
  for(const id of ['instruction','detail','boundary-legend'])$(id).hidden=false;
  $('image-view').parentElement.hidden=comparing;
  document.querySelector('.workspace').classList.toggle('comparing',comparing);
  if(!comparing)return;
  render($('source-compare'),{pixels:base,width:canvas.width,height:canvas.height});
  const before=result?.baseline || (result && !result.smoothed ? result : null);
  for(const [id,pixels,segmentation,caption,side] of [
    ['original-compare',preparedBase || base,before,'original-caption','before'],
    ['smoothed-compare',smoothedBase || preparedBase || base,result,'smoothed-caption','after']]) {
    const state=stateFor(side);
    render($(id),{pixels,base,source:source.data,segmentation,width:canvas.width,height:canvas.height,
      hidden:state.hiddenLayers,palette:$('compare-colors').checked,edges:$('compare-boundaries').checked,
      hover:hoverSide===side?hover:-1,selected:state.selected,layer:state.selectedLayer});
    $(caption).textContent=`${side==='before'?'Before smoothing':'After smoothing'} · ${segmentation?segmentation.regions.length.toLocaleString()+' areas':'computing…'}`;
  }
  $('compare-note').textContent=result ? 'The original is shown unchanged. The two segmentation results use the same color count and minimum area. Click either segmented image to inspect it. Sidebar selection and layer visibility apply to the chosen result; each result keeps its own settings.' : 'Computing both segmentation results…';
}

function scheduleDraw() { if(!drawQueued) {drawQueued=true; requestAnimationFrame(()=>{drawQueued=false;draw();});} }
function cancelPick() {
  picking=false; canvas.style.cursor=''; $('pick').textContent='Pick background from image'; $('pick').setAttribute('aria-pressed','false');
  $('instruction').textContent='Hover to inspect. Click to pin an area. Escape clears the selection.';
}
function point(event) {
  const rect=event.currentTarget.getBoundingClientRect();
  return Math.min(canvas.height-1,Math.max(0,Math.floor((event.clientY-rect.top)*canvas.height/rect.height)))*canvas.width+
    Math.min(canvas.width-1,Math.max(0,Math.floor((event.clientX-rect.left)*canvas.width/rect.width)));
}
function setSource(image,name) {
  const w=image.naturalWidth||image.width, h=image.naturalHeight||image.height;
  const scale=Math.min(1,1000/Math.max(w,h));
  canvas.width=Math.max(1,Math.round(w*scale)); canvas.height=Math.max(1,Math.round(h*scale));
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
  $('dimensions').textContent=`${canvas.width} × ${canvas.height} px${scale<1?' · reduced for inspection':''}`;
  compute();
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
  try {const image=new Image();image.src=url;await image.decode();if(request===uploadRevision)setSource(image,file.name);}
  catch {if(request===uploadRevision)$('error').textContent='Could not open this image.';}
  finally {URL.revokeObjectURL(url);}
});
for(const id of ['color-space','mode','background-mode','background','tolerance','alpha','min-size','color-count','smoothing','smooth-radius','smooth-strength']) $(id).addEventListener('input',compute);
$('outlines').addEventListener('change',()=>{$('compare-boundaries').checked=$('outlines').checked;draw();});
$('show-palette').addEventListener('change',()=>{syncImageView();draw();});
$('image-view').addEventListener('change',draw);
$('compare').addEventListener('change',()=>{
  if($('compare').checked && !$('smoothing').checked){$('smoothing').checked=true;compute();}
  else {if(!$('compare').checked)switchInspection('after');draw();}
});
$('inspect-side').addEventListener('change',()=>{switchInspection($('inspect-side').value);draw();});
$('compare-colors').addEventListener('change',drawComparison);
$('compare-boundaries').addEventListener('change',()=>{$('outlines').checked=$('compare-boundaries').checked;draw();});
$('demo').addEventListener('click',sample);
$('region').addEventListener('change',()=>{selected=$('region').value===''?-1:Number($('region').value);hover=-1;selectedLayer=-1;renderLayers();draw();});
$('clear').addEventListener('click',()=>{selected=hover=selectedLayer=-1;renderLayers();cancelPick();if(result)updateList();draw();});
$('pick').addEventListener('click',()=>{
  if(picking){cancelPick();draw();return;}
  $('compare').checked=false; picking=true; hover=-1; canvas.style.cursor='crosshair'; $('pick').textContent='Cancel picking';$('pick').setAttribute('aria-pressed','true');
  $('instruction').textContent='Click a background color in the image. Escape cancels.';draw();canvas.scrollIntoView({block:'nearest'});
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
  const id=visibleRegion(result.labels[i]);selected=selected===id?-1:id; hover=-1;selectedLayer=-1;renderLayers();updateList();draw();
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
    renderLayers();updateList();draw();
  });
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelPick();selected=hover=selectedLayer=-1;renderLayers();if(result)updateList();draw();}});
syncControls();sample();
