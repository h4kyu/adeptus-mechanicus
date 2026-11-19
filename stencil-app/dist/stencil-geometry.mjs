// Usable area supplied for the user's 24 × 12 inch Mylar and Cricut.
// Keep artwork scale; center it on the largest working area without cutting a frame.
export function sheetScale(width,height,longEdgeInches){
 const pxPerMm=Math.max(width,height)/(longEdgeInches*25.4),landscape=width>=height;
 const sheetWidthMm=landscape?590:290,sheetHeightMm=landscape?290:590;
 const widthMm=width/pxPerMm,heightMm=height/pxPerMm;
 const marginX=(sheetWidthMm-widthMm)*pxPerMm/2,marginY=(sheetHeightMm-heightMm)*pxPerMm/2;
 return {pxPerMm,margin:Math.max(0,Math.min(marginX,marginY)),marginX,marginY,sheetWidthMm,sheetHeightMm,
   fits:widthMm<=sheetWidthMm+1e-8&&heightMm<=sheetHeightMm+1e-8,
   maxLongEdgeInches:Math.min(sheetWidthMm/width,sheetHeightMm/height)*Math.max(width,height)/25.4,
   widthInches:widthMm/25.4,heightInches:heightMm/25.4};
}
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
// The tracing module emits only M/L/Q/Z. Flatten curves for source-resolution analysis.
export function rasterizeCutPath(d,width,height){
 const tokens=d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g)||[],rows=Array.from({length:height},()=>[]);let index=0,p=null,start=null;
 const point=()=>({x:+tokens[index++],y:+tokens[index++]});
 function line(a,b){if(a.y===b.y)return;for(let y=Math.max(0,Math.ceil(Math.min(a.y,b.y)-.5));y<Math.min(height,Math.ceil(Math.max(a.y,b.y)-.5));y++)rows[y].push(a.x+(y+.5-a.y)*(b.x-a.x)/(b.y-a.y));}
 function curve(a,c,b,depth=0){if(depth>=12||pointSegmentDistance(c,a,b)<=.05){line(a,b);return;}const ac={x:(a.x+c.x)/2,y:(a.y+c.y)/2},cb={x:(c.x+b.x)/2,y:(c.y+b.y)/2},mid={x:(ac.x+cb.x)/2,y:(ac.y+cb.y)/2};curve(a,ac,mid,depth+1);curve(mid,cb,b,depth+1);}
 while(index<tokens.length){const command=tokens[index++];if(command==='M'){p=point();start=p;}else if(command==='L'){const next=point();line(p,next);p=next;}else if(command==='Q'){const c=point(),next=point();curve(p,c,next);p=next;}else if(command==='Z')line(p,start);else throw Error('Unexpected boundary command.');}
 const cut=new Uint8Array(width*height);
 for(let y=0;y<height;y++){const crossings=rows[y].sort((a,b)=>a-b);for(let k=0;k+1<crossings.length;k+=2)for(let x=Math.max(0,Math.ceil(crossings[k]-.5));x<Math.min(width,Math.ceil(crossings[k+1]-.5));x++)cut[y*width+x]=1;}
 return cut;
}
export function analyzeSheet(baseCut,width,height,bridges,pxPerMm,margin,{physicalFrame=false}={}){
 const cut=baseCut.slice(),bridgeStatus=[];
 const mx=typeof margin==='object'?margin.marginX:margin,my=typeof margin==='object'?margin.marginY:margin;
 const inSheet=p=>p.x>=-mx&&p.y>=-my&&p.x<=width+mx&&p.y<=height+my;
 const retained=p=>inSheet(p)&&(p.x<0||p.y<0||p.x>=width||p.y>=height||!baseCut[Math.floor(p.y)*width+Math.floor(p.x)]);
 for(const bridge of bridges){
   if(!bridge.enabled){bridgeStatus.push({id:bridge.id,reason:'Disabled'});continue;}
   const radius=bridge.widthMm*pxPerMm/2;let crossed=0;
   const inside=inSheet(bridge.a)&&inSheet(bridge.b);
   if(inside)for(let y=Math.max(0,Math.floor(Math.min(bridge.a.y,bridge.b.y)-radius));y<Math.min(height,Math.ceil(Math.max(bridge.a.y,bridge.b.y)+radius));y++)for(let x=Math.max(0,Math.floor(Math.min(bridge.a.x,bridge.b.x)-radius));x<Math.min(width,Math.ceil(Math.max(bridge.a.x,bridge.b.x)+radius));x++){
     const i=y*width+x;if(pointSegmentDistance({x:x+.5,y:y+.5},bridge.a,bridge.b)<=radius){if(baseCut[i])crossed++;cut[i]=0;}
   }
   const reason=!inside?'Outside sheet':!retained(bridge.a)||!retained(bridge.b)?'Extend both ends onto retained material':!crossed?'No opening crossed':bridge.needsReview?'Review after artwork or size change':'';
   bridgeStatus.push({id:bridge.id,reason,crossed});
 }
 // Label 3×3 retained cores first: a one- or two-pixel neck cannot join
 // them. Grow those labels back over the original material without merging,
 // preserving outlines and thin features for selection rather than eroding art.
 const core=new Uint8Array(cut.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=y*width+x;if(cut[i])continue;let solid=true;
   for(let dy=-1;dy<=1&&solid;dy++)for(let dx=-1;dx<=1;dx++){
     const xx=x+dx,yy=y+dy;
     if(xx>=0&&yy>=0&&xx<width&&yy<height&&cut[yy*width+xx]){solid=false;break;}
   }
   core[i]=+solid;
 }
 const labels=new Int32Array(cut.length).fill(-1),queue=new Int32Array(cut.length);let head=0,tail=0;
 function seed(i,id,coresOnly=false){if(!cut[i]&&labels[i]===-1&&(!coresOnly||core[i])){labels[i]=id;queue[tail++]=i;}}
 function grow(coresOnly=false){while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width),id=labels[i];if(x)seed(i-1,id,coresOnly);if(x+1<width)seed(i+1,id,coresOnly);if(y)seed(i-width,id,coresOnly);if(y+1<height)seed(i+width,id,coresOnly);}}
 // In artwork-only analysis the surrounding stock is one root. Physical-piece
 // analysis instead chooses the largest component, without a virtual edge join.
 if(!physicalFrame){
   for(let x=0;x<width;x++){seed(x,0,true);seed((height-1)*width+x,0,true);}
   for(let y=0;y<height;y++){seed(y*width,0,true);seed(y*width+width-1,0,true);}grow(true);
 }
 let count=0;
 for(let i=0;i<cut.length;i++)if(core[i]&&labels[i]===-1){seed(i,++count,true);grow(true);}
 // Reuse the queue for simultaneous growth, so a narrow neck is shared between
 // its neighboring labels rather than swallowed by the first component.
 head=0;tail=0;for(let i=0;i<labels.length;i++)if(labels[i]>=0)queue[tail++]=i;
 if(!physicalFrame){
   for(let x=0;x<width;x++){seed(x,0);seed((height-1)*width+x,0);}
   for(let y=0;y<height;y++){seed(y*width,0);seed(y*width+width-1,0);}
 }
 grow();
 // Completely thin disconnected features have no core. Keep them visible and
 // eligible for manual review; only the existing single-pixel exclusion applies.
 for(let i=0;i<cut.length;i++)if(!cut[i]&&labels[i]===-1){seed(i,++count);grow();}
 const components=Array.from({length:count+1},(_,id)=>({id,area:0,bounds:[width,height,0,0]}));
 for(let i=0;i<labels.length;i++)if(labels[i]>=0){const c=components[labels[i]],x=i%width,y=Math.floor(i/width);c.area++;c.bounds[0]=Math.min(c.bounds[0],x);c.bounds[1]=Math.min(c.bounds[1],y);c.bounds[2]=Math.max(c.bounds[2],x);c.bounds[3]=Math.max(c.bounds[3],y);}
 let root=components[0];if(physicalFrame)for(const c of components)if(c.area>root.area)root=c;
 const islands=[],mapping=new Int32Array(count+1);let ignoredIslands=0;
 for(const c of components){if(c===root||!c.area)continue;if(c.area===1){mapping[c.id]=-2;ignoredIslands++;}else{mapping[c.id]=islands.length+1;islands.push({...c,id:mapping[c.id]});}}
 for(let i=0;i<labels.length;i++)if(labels[i]>=0)labels[i]=mapping[labels[i]];
 return {labels,islands,ignoredIslands,bridgeStatus,cutPixels:cut.reduce((sum,v)=>sum+v,0),physicalFrame,minConnectionPx:3,core};
}
