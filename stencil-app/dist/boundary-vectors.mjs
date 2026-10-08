// Trace each interface once. Neighboring treatments reuse the same curve in reverse.
const assigned=t=>t===-2||t>=1;
const same=(a,b)=>a.x===b.x&&a.y===b.y;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const area=points=>points.slice(1).reduce((sum,b,i)=>sum+points[i].x*b.y-b.x*points[i].y,0)/2;
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function simplify(points,tolerance){
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
  while(stack.length){const [a,b]=stack.pop();let best=tolerance,index=-1;for(let i=a+1;i<b;i++){const d=segmentDistance(points[i],points[a],points[b]);if(d>best){best=d;index=i;}}if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}}
  return points.filter((_,i)=>keep[i]);
}
function rounded(points,tolerance,preserve){
  const closed=same(points[0],points.at(-1)),raw=points;
  // Remove collinear grid points first; long runs identify intentional sharp corners.
  points=points.filter((p,i)=>i===0||i===points.length-1||cross(points[i-1],p,points[i+1])!==0);
  const pins=new Set([0,points.length-1]),locked=new Set();
  for(let i=1;i<points.length-1;i++)if(preserve&&distance(points[i-1],points[i])>=Math.max(3,tolerance*4)&&distance(points[i],points[i+1])>=Math.max(3,tolerance*4)){pins.add(i);locked.add(points[i]);}
  if(closed&&preserve&&distance(points.at(-2),points[0])>=Math.max(3,tolerance*4)&&distance(points[0],points[1])>=Math.max(3,tolerance*4))locked.add(points[0]);
  if(closed){let far=1;for(let i=2;i<points.length-1;i++)if(distance(points[0],points[i])>distance(points[0],points[far]))far=i;pins.add(far);}
  const anchors=[...pins].sort((a,b)=>a-b);let reduced=[];
  for(let i=1;i<anchors.length;i++)reduced.push(...simplify(points.slice(anchors[i-1],anchors[i]+1),tolerance/2).slice(i===1?0:1));
  if(closed&&(reduced.length<4||area(reduced)*area(raw)<=0||Math.abs(area(reduced))<Math.abs(area(raw))*.5))reduced=points;
  const segments=[],line=(a,b)=>{if(!same(a,b))segments.push({a,b});};
  const vertices=closed?reduced.slice(0,-1):reduced;
  function corner(i){const p=vertices[i],a=vertices[(i-1+vertices.length)%vertices.length],b=vertices[(i+1)%vertices.length];
    const fixed=!closed&&(i===0||i===vertices.length-1)||preserve&&locked.has(p);
    const r=fixed?0:Math.min(tolerance/2,distance(p,a)/4,distance(p,b)/4);
    const towards=q=>{const d=distance(p,q)||1;return {x:p.x+(q.x-p.x)*r/d,y:p.y+(q.y-p.y)*r/d};};
    return {p,entry:towards(a),exit:towards(b)};
  }
  const corners=vertices.map((_,i)=>corner(i));
  for(let i=0;i<corners.length;i++){
    const c=corners[i];if(!same(c.entry,c.exit))segments.push({a:c.entry,c:c.p,b:c.exit});
    if(i+1<corners.length||closed)line(c.exit,corners[(i+1)%corners.length].entry);
  }
  return segments;
}
const exact=points=>points.slice(1).map((b,i)=>({a:points[i],b}));
function flatten(segments){const result=[];for(const s of segments){const count=s.c?Math.max(2,Math.ceil(Math.sqrt(distance(s.a,s.c)+distance(s.c,s.b))*4)):1;let a=s.a;
  for(let i=1;i<=count;i++){const t=i/count,b=i===count?s.b:{x:(1-t)**2*s.a.x+2*t*(1-t)*s.c.x+t*t*s.b.x,y:(1-t)**2*s.a.y+2*t*(1-t)*s.c.y+t*t*s.b.y};result.push({a,b});a=b;}}
 return result;
}
function intersects(a,b){
 const shared=[a.a,a.b].some(p=>same(p,b.a)||same(p,b.b));
 const c1=cross(a.a,a.b,b.a),c2=cross(a.a,a.b,b.b),c3=cross(b.a,b.b,a.a),c4=cross(b.a,b.b,a.b),epsilon=1e-8;
 if(shared){if(Math.abs(c1)>epsilon||Math.abs(c2)>epsilon)return false;const axis=Math.abs(a.a.x-a.b.x)>Math.abs(a.a.y-a.b.y)?'x':'y';return Math.min(Math.max(a.a[axis],a.b[axis]),Math.max(b.a[axis],b.b[axis]))-Math.max(Math.min(a.a[axis],a.b[axis]),Math.min(b.a[axis],b.b[axis]))>epsilon;}
 if(c1*c2>epsilon||c3*c4>epsilon)return false;
 return Math.max(Math.min(a.a.x,a.b.x),Math.min(b.a.x,b.b.x))<=Math.min(Math.max(a.a.x,a.b.x),Math.max(b.a.x,b.b.x))+epsilon&&Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y))<=Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))+epsilon;
}
// A spatial grid checks nearby segments instead of comparing every pair.
function conflicts(chains,cell){
 const grid=new Map(),bad=new Set();let id=0;
 for(let chain=0;chain<chains.length;chain++)for(const segment of flatten(chains[chain].segments)){
   const entry={...segment,chain,id:id++},seen=new Set();
   const x0=Math.floor(Math.min(entry.a.x,entry.b.x)/cell),x1=Math.floor(Math.max(entry.a.x,entry.b.x)/cell),y0=Math.floor(Math.min(entry.a.y,entry.b.y)/cell),y1=Math.floor(Math.max(entry.a.y,entry.b.y)/cell);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=`${x},${y}`,bucket=grid.get(key)||[];
     for(const other of bucket)if(!seen.has(other.id)){seen.add(other.id);if(intersects(entry,other)){bad.add(chain);bad.add(other.chain);}}
     bucket.push(entry);grid.set(key,bucket);
   }
 }
 return bad;
}
const number=n=>String(Math.round(n*1000)/1000);
const coordinate=p=>`${number(p.x)} ${number(p.y)}`;
function commands(segments,reverse=false){return (reverse?[...segments].reverse().map(s=>({a:s.b,b:s.a,c:s.c})):segments).map(s=>s.c?`Q${coordinate(s.c)} ${coordinate(s.b)}`:`L${coordinate(s.b)}`).join('');}
export function traceBoundaries(treatments,alpha,width,height,{tolerance=1,preserveCorners=true}={}){
 if(!Number.isFinite(tolerance)||tolerance<0||tolerance>8||treatments.length!==width*height||alpha.length!==width*height)throw Error('Invalid boundary input.');
 const edges=[],vertices=new Map(),stride=width+1;
 const at=(x,y)=>x<0||y<0||x>=width||y>=height||!alpha[y*width+x]?-3:treatments[y*width+x];
 const point=id=>({x:id%stride,y:Math.floor(id/stride)});
 function add(a,b,left,right){if(left===right||!assigned(left)&&!assigned(right))return;const id=edges.length;edges.push({a,b,left,right,pair:[left,right].sort((a,b)=>a-b).join('/'),chain:-1});for(const v of [a,b]){if(!vertices.has(v))vertices.set(v,[]);vertices.get(v).push(id);}}
 for(let y=0;y<=height;y++)for(let x=0;x<width;x++)add(y*stride+x,y*stride+x+1,at(x,y-1),at(x,y));
 for(let x=0;x<=width;x++)for(let y=0;y<height;y++)add(y*stride+x,(y+1)*stride+x,at(x,y),at(x-1,y));
 const joint=v=>{const ids=vertices.get(v);return ids.length!==2||edges[ids[0]].pair!==edges[ids[1]].pair;};
 const chains=[];
 function walk(first,start){let e=first,v=start;const points=[point(v)],id=chains.length;
   while(true){const edge=edges[e];edge.chain=id;edge.forward=edge.a===v;v=edge.forward?edge.b:edge.a;points.push(point(v));if(v===start||joint(v))break;const next=vertices.get(v).find(i=>i!==e);if(edges[next].chain>=0)break;e=next;}
   chains.push({points,segments:tolerance?rounded(points,tolerance,preserveCorners):exact(points),protected:false});
 }
 for(const [v,ids] of vertices)if(joint(v))for(const id of ids)if(edges[id].chain<0)walk(id,v);
 edges.forEach((e,id)=>{if(e.chain<0)walk(id,e.a);});
 // Reject changed chains that cross any other boundary. Recheck against restored chains.
 if(tolerance)for(let pass=0;pass<4;pass++){
   const bad=conflicts(chains,Math.max(4,tolerance*2));if(!bad.size)break;
   let changed=false;for(const id of bad)if(!chains[id].protected){chains[id].segments=exact(chains[id].points);chains[id].protected=true;changed=true;}
   if(!changed)break;
   if(pass===3)for(const chain of chains){chain.segments=exact(chain.points);chain.protected=true;}
 }
 // Walk directed raster edges around each treatment; replace each shared chain once.
 const paths=[],treatmentSet=new Set(edges.flatMap(e=>[e.left,e.right]).filter(assigned));
 for(const treatment of treatmentSet){
   const outgoing=new Map(),visited=new Set(),directed=[];
   edges.forEach((edge,id)=>{if(edge.left!==treatment&&edge.right!==treatment)return;const forward=edge.right===treatment,a=forward?edge.a:edge.b,b=forward?edge.b:edge.a;const item={id,a,b,forward};directed.push(item);if(!outgoing.has(a))outgoing.set(a,[]);outgoing.get(a).push(item);});
   let d='';
   for(const start of directed){if(visited.has(start.id))continue;let current=start;const refs=[];
     do{visited.add(current.id);const edge=edges[current.id],ref={id:edge.chain,reverse:current.forward!==edge.forward};if(refs.at(-1)?.id!==ref.id)refs.push(ref);
       const candidates=(outgoing.get(current.b)||[]).filter(next=>!visited.has(next.id));if(!candidates.length)break;
       const a=point(current.a),b=point(current.b),rank=next=>{const c=point(next.b),turn=cross(a,b,c),dot=(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y);return turn>0?0:dot>0?1:turn<0?2:3;};
       current=candidates.sort((a,b)=>rank(a)-rank(b)||a.id-b.id)[0];
     }while(current.id!==start.id);
     if(refs.length>1&&refs[0].id===refs.at(-1).id)refs.pop();
     const first=refs[0],segments=chains[first.id].segments,p=first.reverse?segments.at(-1).b:segments[0].a;
     d+=`M${coordinate(p)}`+refs.map(ref=>commands(chains[ref.id].segments,ref.reverse)).join('')+'Z';
   }
   paths.push({treatment,d});
 }
 const stroke=chains.map(c=>`M${coordinate(c.segments[0].a)}`+commands(c.segments)+(same(c.points[0],c.points.at(-1))?'Z':'')).join('');
 return {paths,stroke,sourceEdges:edges.length,segments:chains.reduce((sum,c)=>sum+c.segments.length,0),protectedChains:chains.filter(c=>c.protected).length};
}
