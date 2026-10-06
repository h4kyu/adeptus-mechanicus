// Portable project files preserve typed arrays at full image resolution.
export const PROJECT_VERSION=1;
const types={Uint8Array,Uint8ClampedArray,Int16Array,Int32Array,Float32Array};
export function encodeProject(project) {
  return JSON.stringify(project,(_key,value)=>{
    if(!ArrayBuffer.isView(value))return value;
    const bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);let binary='';
    for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
    return {$array:value.constructor.name,data:btoa(binary)};
  });
}
export function decodeProject(text) {
  const project=JSON.parse(text,(_key,value)=>{
    if(!value?.$array)return value;
    const Type=types[value.$array];if(!Type||typeof value.data!=='string')throw Error('Invalid project array.');
    const bytes=Uint8Array.from(atob(value.data),c=>c.charCodeAt(0));
    return new Type(bytes.buffer);
  });
  validateProject(project);return project;
}
export function validateProject(p) {
  const fail=()=>{throw Error('This is not a valid Stencil Studio project.');};
  if(p?.format!=='stencil-studio'||p.version!==PROJECT_VERSION)throw Error('Unsupported project format or version.');
  const s=p.source,n=s?.width*s?.height;
  if(!Number.isSafeInteger(s?.width)||!Number.isSafeInteger(s?.height)||s.width<1||s.height<1||!Number.isSafeInteger(n)||!(s.data instanceof Uint8ClampedArray)||s.data.length!==n*4)fail();
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>200||!p.settings||!p.view)fail();
  function segmentation(r) {
    if(!r||!(r.labels instanceof Int32Array)||r.labels.length!==n||!(r.edges instanceof Uint8Array)||r.edges.length!==n||!Array.isArray(r.regions)||r.regions.length>n)fail();
    const palette=r.palette || [];
    if(!Array.isArray(palette)||palette.length>8||palette.some(c=>!Array.isArray(c)||c.length!==3||c.some(v=>!Number.isFinite(v)||v<0||v>255)))fail();
    r.regions.forEach((v,i)=>{if(v.id!==i||!Number.isInteger(v.area)||v.area<1||v.area>n||!Array.isArray(v.bounds)||v.bounds.length!==4||v.bounds.some(x=>!Number.isInteger(x))||v.bounds[0]<0||v.bounds[1]<0||v.bounds[2]>=s.width||v.bounds[3]>=s.height||v.bounds[2]<v.bounds[0]||v.bounds[3]<v.bounds[1]||(v.paletteIndex!=null&&(!Number.isInteger(v.paletteIndex)||v.paletteIndex< -1||v.paletteIndex>=palette.length)))fail();});
    for(const id of r.labels)if(id< -1||id>=r.regions.length)fail();
    if(!Number.isInteger(r.ignoredPixels)||r.ignoredPixels<0||r.ignoredPixels>n)fail();
    if(palette.length){if(!(r.colorLabels instanceof Int16Array)&&!(r.colorLabels instanceof Int32Array)&&!(r.colorLabels instanceof Uint8Array))fail();if(r.colorLabels.length!==n)fail();for(const id of r.colorLabels)if(id< -1||id>=palette.length)fail();}
  }
  segmentation(p.result);if(p.result.baseline)segmentation(p.result.baseline);
  for(const key of ['prepared','smoothed'])if(p.result[key]!=null&&(!(p.result[key] instanceof Uint8ClampedArray)||p.result[key].length!==n*4))fail();
  if(!(p.assignments instanceof Int16Array)||p.assignments.length!==p.result.regions.length)fail();
  p.assignments.forEach((v,i)=>{const automatic=p.result.regions[i].paletteIndex??-1;if(!Number.isInteger(v)||(automatic<0?v!==automatic:v!==-2&&v!==-1&&(v<0||v>=(p.result.palette?.length||0))))fail();});
  const c=p.view.camera;if(c&&(!Number.isFinite(c.x)||!Number.isFinite(c.y)||!Number.isFinite(c.scale)||c.scale<=0||c.scale>32))fail();
  return p;
}
export function createBrowserProjectStore(name='stencil-studio') {
  const ready=new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('projects',{keyPath:'id'});request.result.createObjectStore('summaries',{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Close other Stencil Studio tabs and try again.'));
  });
  // Startup reports unavailable storage through the library instead of an unhandled rejection.
  ready.catch(()=>{});
  async function transaction(mode,run){const db=await ready;return new Promise((resolve,reject)=>{
    const tx=db.transaction(['projects','summaries'],mode);let value;
    tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Project storage failed.'));
    try{run(tx,v=>{value=v;});}catch(e){tx.abort();reject(e);}
  });}
  return {
    list:()=>transaction('readonly',(tx,set)=>{tx.objectStore('summaries').getAll().onsuccess=e=>set(e.target.result.sort((a,b)=>b.updatedAt-a.updatedAt));}),
    get:id=>transaction('readonly',(tx,set)=>{tx.objectStore('projects').get(id).onsuccess=e=>set(e.target.result);}),
    put:p=>transaction('readwrite',tx=>{tx.objectStore('projects').put(p);tx.objectStore('summaries').put({id:p.id,name:p.name,updatedAt:p.updatedAt,thumbnail:p.thumbnail});}),
    delete:id=>transaction('readwrite',tx=>{tx.objectStore('projects').delete(id);tx.objectStore('summaries').delete(id);})
  };
}

// Autosave goes through the local server; never silently fall back to browser storage.
export function createProjectStore() {
  async function request(id='',options={}){
    let response;try{response=await fetch('/api/projects'+(id?'/'+encodeURIComponent(id):''),{...options,headers:{'X-Stencil-Client':'1',...options.headers}});}
    catch{throw Error('Cannot reach the project server. Run node stencil-app/server.mjs, then retry saving.');}
    if(!response.ok){let message;try{message=(await response.json()).error;}catch{}throw Error(message||'Project server unavailable. Run node stencil-app/server.mjs instead of the static preview server.');}
    return response;
  }
  return {
    list:async()=>{const response=await request();try{return await response.json();}catch{throw Error('Start the editor with node stencil-app/server.mjs to use repo storage.');}},
    get:async id=>decodeProject(await (await request(id)).text()),
    put:async(p,{createOnly=false}={})=>{validateProject(p);return (await request(p.id,{method:'PUT',headers:{'Content-Type':'application/json',...(createOnly?{'If-None-Match':'*'}:{})},body:encodeProject(p)})).json();},
    delete:async id=>{await request(id,{method:'DELETE'});}
  };
}
