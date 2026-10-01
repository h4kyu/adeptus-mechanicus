const $ = id => document.getElementById(id);
const canvas = $('canvas'), context = canvas.getContext('2d');
let source, base, result, worker, timer, revision = 0, uploadRevision = 0;
let hover = -1, selected = -1, picking = false, drawQueued = false;

function syncControls() {
  const sil = $('mode').value === 'silhouette', alpha = $('background-mode').value === 'alpha';
  $('background-settings').hidden = !sil;
  $('color-settings').hidden = alpha;
  $('tolerance-settings').hidden = sil && alpha;
  $('tolerance-label').textContent = sil ? 'Background tolerance' : 'Color tolerance';
  $('tolerance-value').textContent = `${$('tolerance').value}%`;
  $('alpha-value').textContent = `${$('alpha').value}%`;
  $('mode-help').textContent = sil ? 'Separate foreground silhouettes and background areas; ignore internal foreground colors. Holes remain separate background regions.' : 'Group connected pixels similar to a starting color. Gradients split into areas; increasing tolerance generally produces broader areas.';
}

function compute() {
  syncControls(); cancelPick();
  if (!source) return;
  clearTimeout(timer); worker?.terminate();
  const current = ++revision;
  hover = selected = -1; result = null;
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
      result = data; $('error').textContent = '';
      $('status').textContent = `${data.regions.length.toLocaleString()} areas · ${data.ignoredPixels.toLocaleString()} pixels hidden`;
      $('region').disabled = false; updateList(); draw(); worker.terminate();
    };
    worker.postMessage({revision:current, pixels:source.data, width:source.width, height:source.height,
      options:{mode:$('mode').value, tolerance:Number($('tolerance').value)/100,
        backgroundMode:$('background-mode').value, background:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),
        alphaCutoff:Number($('alpha').value)/100, minSize}});
  }, 140);
}

function updateList() {
  $('region').replaceChildren(new Option('None',''));
  const listed = result.regions.slice(0,200);
  if (selected >= 200) listed.push(result.regions[selected]);
  for (const r of listed) $('region').add(new Option(`#${r.id+1} · ${r.kind} · ${r.area.toLocaleString()} px`, String(r.id)));
  $('region').value = selected < 0 ? '' : String(selected);
  $('region-help').textContent = result.regions.length > 200 ? 'List shows the 200 largest areas and your selection. Hover or click any other area on the image.' : 'You can also hover or click directly on the image.';
}

function draw() {
  if (!base) return;
  const output = new ImageData(new Uint8ClampedArray(base), canvas.width, canvas.height);
  const showEdges = $('outlines').checked;
  if (result && !picking) {
    for (let i=0;i<result.labels.length;i++) {
      const id = result.labels[i]; if (id<0) continue;
      const active = id===hover || id===selected;
      const edge = result.edges[i] && (active || showEdges);
      if (!active && !edge) continue;
      const color = id===hover ? [255,220,50] : id===selected ? [255,70,160] : [0,220,245];
      const blend = edge ? 1 : .23, p=i*4;
      for(let k=0;k<3;k++) output.data[p+k] = output.data[p+k]*(1-blend)+color[k]*blend;
    }
  }
  context.putImageData(output,0,0);
  const id = hover >= 0 ? hover : selected;
  const r = result?.regions[id];
  $('detail').textContent = r ? `${id===hover ? 'Hover' : 'Selected'} #${id+1} · ${r.kind} · ${r.area.toLocaleString()} pixels (${(r.area/(canvas.width*canvas.height)*100).toFixed(2)}%) · Bounds ${r.bounds[2]-r.bounds[0]+1} × ${r.bounds[3]-r.bounds[1]+1} px` : result && !result.regions.length ? 'No areas meet the minimum size. Lower Minimum area.' : 'No area selected.';
}
function scheduleDraw() { if(!drawQueued) {drawQueued=true; requestAnimationFrame(()=>{drawQueued=false;draw();});} }
function cancelPick() {
  picking=false; canvas.style.cursor=''; $('pick').textContent='Pick background from image'; $('pick').setAttribute('aria-pressed','false');
  $('instruction').textContent='Hover to inspect. Click to pin an area. Escape clears the selection.';
}
function point(event) {
  const rect=canvas.getBoundingClientRect();
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
for(const id of ['mode','background-mode','background','tolerance','alpha','min-size']) $(id).addEventListener('input',compute);
$('outlines').addEventListener('change',draw);
$('demo').addEventListener('click',sample);
$('region').addEventListener('change',()=>{selected=$('region').value===''?-1:Number($('region').value);hover=-1;draw();});
$('clear').addEventListener('click',()=>{selected=hover=-1;cancelPick();if(result)updateList();draw();});
$('pick').addEventListener('click',()=>{
  if(picking){cancelPick();draw();return;}
  picking=true; hover=-1; canvas.style.cursor='crosshair'; $('pick').textContent='Cancel picking';$('pick').setAttribute('aria-pressed','true');
  $('instruction').textContent='Click a background color in the image. Escape cancels.';draw();canvas.scrollIntoView({block:'nearest'});
});
canvas.addEventListener('pointermove',event=>{if(picking||!result)return;const id=result.labels[point(event)];if(id!==hover){hover=id;scheduleDraw();}});
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
  const id=result.labels[i];selected=selected===id?-1:id; hover=-1;updateList();draw();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){cancelPick();selected=hover=-1;if(result)updateList();draw();}});
syncControls();sample();
