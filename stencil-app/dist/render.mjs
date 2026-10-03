// Cache the expensive pixel rendering. Pointer moves only composite cached
// images and small, cropped region highlights onto the visible canvas.
export function createRenderer() {
  const views=new WeakMap(), masks=new WeakMap();
  function highlight(segmentation, regionId, layerId, width, height, hovering) {
    let cache=masks.get(segmentation);
    if(!cache){cache=new Map();masks.set(segmentation,cache);}
    const key=`${regionId}/${layerId}/${hovering}`;
    if(cache.has(key))return cache.get(key);
    const region=segmentation.regions[regionId];
    const [x,y,right,bottom]=region ? region.bounds : [0,0,width-1,height-1];
    const overlay=document.createElement('canvas');overlay.width=right-x+1;overlay.height=bottom-y+1;
    const ctx=overlay.getContext('2d'), data=ctx.createImageData(overlay.width,overlay.height);
    const color=hovering?[255,220,50]:[255,70,160];
    for(let row=y;row<=bottom;row++)for(let col=x;col<=right;col++) {
      const i=row*width+col;
      if(segmentation.labels[i]<0 || (layerId>=0 ? segmentation.colorLabels?.[i]!==layerId : segmentation.labels[i]!==regionId))continue;
      const p=((row-y)*overlay.width+col-x)*4;
      data.data.set(color,p);data.data[p+3]=segmentation.edges[i]?255:59;
    }
    ctx.putImageData(data,0,0);
    const mask={overlay,x,y};
    if(cache.size>=16)cache.delete(cache.keys().next().value);
    cache.set(key,mask);return mask;
  }
  return function render(target,{pixels,base,source,segmentation,width,height,hidden=new Set(),palette=false,edges=false,hover=-1,selected=-1,layer=-1}) {
    const staticKey=`${palette}/${edges}/${[...hidden].sort((a,b)=>a-b).join(',')}`;
    const dynamicKey=`${hover}/${selected}/${layer}`;
    let view=views.get(target);
    const rebuild=!view || view.pixels!==pixels || view.segmentation!==segmentation || view.staticKey!==staticKey;
    if(rebuild) {
      const buffer=document.createElement('canvas');buffer.width=width;buffer.height=height;
      const output=new Uint8ClampedArray(pixels);
      if(segmentation)for(let i=0;i<segmentation.labels.length;i++) {
        const p=i*4,k=segmentation.colorLabels?.[i];
        if(hidden.has(k)) {
          const shade=(Math.floor((i%width)/12)+Math.floor(Math.floor(i/width)/12))%2?218:240;
          output[p]=output[p+1]=output[p+2]=shade;continue;
        }
        if(palette && k>=0)for(let c=0;c<3;c++)output[p+c]=base[p+c]+(segmentation.palette[k][c]-source[p+c])*source[p+3]/255;
        if(edges && segmentation.edges[i]){output[p]=0;output[p+1]=220;output[p+2]=245;}
      }
      buffer.getContext('2d').putImageData(new ImageData(output,width,height),0,0);
      view={pixels,segmentation,staticKey,buffer};views.set(target,view);
    }
    if(!rebuild && view.dynamicKey===dynamicKey)return;
    if(target.width!==width)target.width=width;
    if(target.height!==height)target.height=height;
    const ctx=target.getContext('2d');ctx.clearRect(0,0,width,height);ctx.drawImage(view.buffer,0,0);
    if(segmentation) {
      const paint=(id,layerId,hovering)=>{
        if(layerId<0 && (!segmentation.regions[id] || hidden.has(segmentation.regions[id].paletteIndex)))return;
        if(layerId>=0 && hidden.has(layerId))return;
        const mask=highlight(segmentation,id,layerId,width,height,hovering);ctx.drawImage(mask.overlay,mask.x,mask.y);
      };
      if(layer>=0)paint(-1,layer,false);
      else if(selected>=0 && selected!==hover)paint(selected,-1,false);
      if(hover>=0)paint(hover,-1,true);
    }
    view.dynamicKey=dynamicKey;
  };
}
