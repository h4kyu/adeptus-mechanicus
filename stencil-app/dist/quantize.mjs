// OKLab conversion: https://bottosson.github.io/posts/oklab/
const linear = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
export function toLab(r,g,b) {
  r=linear(r);g=linear(g);b=linear(b);
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
  const m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
  const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
export function toRGB([L,a,b]) {
  const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
  return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s].map(v=>Math.round(255*Math.max(0,Math.min(1,v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055))));
}
const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
function nearest(p, centers) {
  let id=0,d=Infinity;
  for(let k=0;k<centers.length;k++){const next=distance(p,centers[k]);if(next<d){id=k;d=next;}}
  return id;
}
export function quantize(data, requested=8) {
  // A canonical 5-bit RGB histogram bounds fitting cost and avoids scan-order
  // sampling bias. Each bin stores its actual mean color and alpha weight.
  const bins=new Float64Array(32768*4);
  for(let i=0;i<data.length;i+=4){
    const a=data[i+3];if(!a)continue;
    const p=(((data[i]>>3)<<10)|((data[i+1]>>3)<<5)|(data[i+2]>>3))*4;
    bins[p]+=a;for(let c=0;c<3;c++)bins[p+c+1]+=data[i+c]*a;
  }
  const points=[],weights=[];
  for(let i=0;i<bins.length;i+=4)if(bins[i]){weights.push(bins[i]);points.push(toLab(bins[i+1]/bins[i],bins[i+2]/bins[i],bins[i+3]/bins[i]));}
  const labels=new Int16Array(data.length/4).fill(-1);
  if(!points.length)return {palette:[],labels};
  const K=Math.min(points.length,Math.max(1,Math.min(8,Math.round(requested)||8)));
  let state=0x734ab891;
  const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
  const choose=values=>{let total=0;for(const v of values)total+=v;let target=random()*total;for(let i=0;i<values.length;i++){target-=values[i];if(target<0)return i;}return values.length-1;};
  let centers=[points[choose(weights)].slice()];
  const distances=new Float64Array(points.length).fill(Infinity);
  while(centers.length<K){
    const weighted=points.map((p,i)=>{distances[i]=Math.min(distances[i],distance(p,centers.at(-1)));return distances[i]*weights[i];});
    if(!weighted.some(v=>v>1e-15))break;
    centers.push(points[choose(weighted)].slice());
  }
  // Alternate assignment and weighted averaging until stable, with a fixed cap.
  for(let iteration=0;iteration<30;iteration++){
    const sums=centers.map(()=>[0,0,0,0]);
    points.forEach((p,i)=>{const sum=sums[nearest(p,centers)],w=weights[i];sum[3]+=w;for(let c=0;c<3;c++)sum[c]+=p[c]*w;});
    const updated=sums.filter(s=>s[3]>0).map(s=>s.slice(0,3).map(v=>v/s[3]));
    const stable=updated.length===centers.length && updated.every((p,i)=>distance(p,centers[i])<1e-12);
    centers=updated;if(stable)break;
  }
  centers.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
  for(let i=0;i<labels.length;i++)if(data[i*4+3])labels[i]=nearest(toLab(data[i*4],data[i*4+1],data[i*4+2]),centers);
  return {palette:centers.map(toRGB),labels};
}
