import {toLab} from './quantize.mjs';
import {traceBoundaries} from './boundary-vectors.mjs';

// Grow only through four-connected source pixels close to the clicked color.
// Compare to the fixed seed so a gradient cannot drift into unrelated colors.
export function selectSourceShape(pixels,width,height,seed,tolerance=.12){
  const n=width*height;
  if(pixels.length!==n*4||!Number.isInteger(seed.x)||!Number.isInteger(seed.y)||seed.x<0||seed.y<0||seed.x>=width||seed.y>=height||!Number.isFinite(tolerance)||tolerance<0||tolerance>.4)throw Error('Invalid automatic shape selection.');
  const first=seed.y*width+seed.x;
  if(!pixels[first*4+3])throw Error('Click an opaque part of the original image.');
  const target=toLab(...pixels.subarray(first*4,first*4+3)),visited=new Uint8Array(n),queue=new Int32Array(n),treatments=new Int16Array(n).fill(-1);
  let head=0,tail=1;queue[0]=first;visited[first]=1;treatments[first]=1;
  const visit=i=>{
    if(visited[i])return;visited[i]=1;
    if(!pixels[i*4+3])return;
    const lab=toLab(...pixels.subarray(i*4,i*4+3));
    if(Math.hypot(...lab.map((v,c)=>v-target[c]))>tolerance+1e-12)return;
    treatments[i]=1;queue[tail++]=i;
  };
  while(head<tail){const i=queue[head++],x=i%width;
    if(x)visit(i-1);if(x+1<width)visit(i+1);if(i>=width)visit(i-width);if(i+width<n)visit(i+width);
  }
  // Reuse the exact shared-boundary tracer, then remove only collinear points.
  // This keeps the selected source-pixel silhouette, including enclosed holes.
  const path=traceBoundaries(treatments,new Uint8Array(n).fill(1),width,height,{tolerance:0}).paths.find(p=>p.treatment===1)?.d;
  const rings=(path?.match(/M[^Z]+Z/g)||[]).map(part=>{
    const numbers=part.match(/\d+(?:\.\d+)?/g).map(Number),points=[];
    for(let i=0;i<numbers.length;i+=2)points.push({x:numbers[i],y:numbers[i+1]});
    if(points[0].x===points.at(-1).x&&points[0].y===points.at(-1).y)points.pop();
    return points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x);});
  });
  const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const b=ring[(i+1)%ring.length];return sum+p.x*b.y-b.x*p.y;},0));
  rings.sort((a,b)=>area(b)-area(a));
  if(!rings.length||rings.reduce((count,r)=>count+r.length,0)>10000)throw Error('This outline is too complex to edit. Try a different tolerance or Draw lasso.');
  return {points:rings[0],...(rings.length>1?{holes:rings.slice(1)}:{}),autoSelect:{...seed,tolerance},pixelCount:tail};
}
