import {pointSegmentDistance} from './stencil-geometry.mjs';

// Grow all retained components together. Meeting fronts give nearby pairs without
// comparing every island pixel against every other pixel (linear raster work).
export function suggestBridges(baseCut,width,height,analysis,pxPerMm,margin,widthMm=2,minWidthMm=1.5){
 const {labels,islands}=analysis,n=labels.length;
 if(!islands.length)return [];
 const owner=new Int32Array(n).fill(-1),origin=new Int32Array(n),queue=new Int32Array(n);
 let head=0,tail=0;
 const seed=(i,id,source)=>{if(owner[i]<0){owner[i]=id;origin[i]=source;queue[tail++]=i;}};
 // Anchor on original retained material, even when existing bridges have joined it.
 for(let i=0;i<n;i++)if(labels[i]>=0&&!baseCut[i])seed(i,labels[i],i);
 // Virtual frame sources support art whose openings run all the way to an edge.
 for(let x=0;x<width;x++){seed(x,0,-1-x);seed((height-1)*width+x,0,-1-width-x);}
 for(let y=0;y<height;y++){seed(y*width,0,-1-2*width-y);seed(y*width+width-1,0,-1-2*width-height-y);}
 const pairs=new Map(),inset=Math.min(.5,margin/2);
 function point(index){
   if(index>=0)return {x:index%width+.5,y:Math.floor(index/width)+.5};
   let v=-1-index;if(v<width)return {x:v+.5,y:-inset};v-=width;
   if(v<width)return {x:v+.5,y:height+inset};v-=width;
   if(v<height)return {x:-inset,y:v+.5};return {x:width+inset,y:v-height+.5};
 }
 function visit(i,j){
   if(owner[j]<0){seed(j,owner[i],origin[i]);return;}
   if(owner[i]===owner[j])return;
   const u=owner[i],v=owner[j],key=u<v?`${u}:${v}`:`${v}:${u}`;
   const a=point(origin[i]),b=point(origin[j]),length=Math.hypot(b.x-a.x,b.y-a.y),previous=pairs.get(key);
   if(!previous||length<previous.length)pairs.set(key,{u,v,a,b,length});
 }
 while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);if(x)visit(i,i-1);if(x+1<width)visit(i,i+1);if(y)visit(i,i-width);if(y+1<height)visit(i,i+width);}
 const bounds=new Map(islands.map(i=>[i.id,i.bounds]));
 // Measure local island thickness perpendicular to the proposed bridge. Bounding
// width alone misses narrow tips on otherwise large islands.
 function thickness(p,id,dx,dy,limit){
   if(!id)return limit;
   const box=bounds.get(id),cap=Math.min(limit,box[2]-box[0]+1,box[3]-box[1]+1);
   const inside=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&labels[Math.floor(y)*width+Math.floor(x)]===id;
   let span=0;for(const sign of [-1,1]){let distance=.25;while(distance<cap&&inside(p.x+dx*distance*sign,p.y+dy*distance*sign))distance+=.25;span+=distance-.125;}
   return Math.min(cap,span);
 }
 // A thin diagonal capsule can miss a corner pixel at native resolution. Require
// a four-connected staircase inside the capsule, matching the island checker.
 function connects(a,b,radius){
   let x=Math.floor(a.x),y=Math.floor(a.y),tx=Math.floor(b.x),ty=Math.floor(b.y);
   const fits=(cx,cy)=>pointSegmentDistance({x:cx+.5,y:cy+.5},a,b)<=radius+1e-8;
   while(x!==tx||y!==ty){const sx=Math.sign(tx-x),sy=Math.sign(ty-y),canX=sx&&fits(x+sx,y),canY=sy&&fits(x,y+sy);if(!canX&&!canY)return false;
     if(canX&&(!canY||pointSegmentDistance({x:x+sx+.5,y:y+.5},a,b)<pointSegmentDistance({x:x+.5,y:y+sy+.5},a,b)))x+=sx;else y+=sy;
   }return true;
 }
 const candidates=[];
 for(const p of pairs.values()){
   const dx=-(p.b.y-p.a.y)/p.length,dy=(p.b.x-p.a.x)/p.length,target=widthMm*pxPerMm;
   const pixels=Math.min(target,thickness(p.a,p.u,dx,dy,target),thickness(p.b,p.v,dx,dy,target));
   const mm=Math.floor((pixels/pxPerMm+1e-9)*100)/100;
   if(mm<minWidthMm||!connects(p.a,p.b,mm*pxPerMm/2))continue;
   // Width is capped by island geometry, never shrunk just to win the area score.
   candidates.push({...p,widthMm:mm,area:p.length*mm*pxPerMm});
 }
 // A minimum spanning forest picks the least-area available connections without
// cycles. Islands can connect through each other, saving cuts compared with
// independently running every bridge to the outer frame.
 candidates.sort((a,b)=>a.area-b.area||a.length-b.length||a.u-b.u||a.v-b.v);
 const parent=Int32Array.from({length:islands.length+1},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},chosen=[];
 for(const p of candidates){const u=find(p.u),v=find(p.v);if(u===v)continue;parent[u]=v;chosen.push(p);}
 // Don't add isolated bridge networks that never reach the surrounding sheet.
 const root=find(0);
 return chosen.filter(p=>find(p.u)===root).map(({a,b,widthMm})=>({a,b,widthMm,enabled:true,needsReview:false}));
}
