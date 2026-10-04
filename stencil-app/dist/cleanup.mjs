import {detectRegions} from './regions.mjs';

// Region adjacency graph: edge weights count shared pixel sides, not corners.
export function mergeSmallRegions(pixels, width, height, colorLabels, minimum=20) {
  const limit=Math.max(1,Math.round(minimum)||1);
  const detected=detectRegions(pixels,width,height,{mode:'quantized',colorLabels,minSize:1});
  const nodes=detected.regions.map(r=>({area:r.area,color:r.paletteIndex,parent:r.id,neighbors:new Map()}));
  const labels=detected.labels, heap=[];
  const less=(a,b)=>a.area<b.area || (a.area===b.area && a.id<b.id);
  function push(id) {
    const n=nodes[id];if(n.color<0 || n.area>=limit)return;
    const entry={id,area:n.area};let i=heap.length;heap.push(entry);
    while(i){const p=(i-1)>>1;if(!less(entry,heap[p]))break;heap[i]=heap[p];i=p;}heap[i]=entry;
  }
  function pop() {
    const first=heap[0],last=heap.pop();if(!heap.length)return first;
    let i=0;
    while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length && less(heap[c+1],heap[c]))c++;if(!less(heap[c],last))break;heap[i]=heap[c];i=c;}
    heap[i]=last;return first;
  }
  function connect(a,b) {
    if(a===b || nodes[a].color<0 || nodes[b].color<0)return;
    nodes[a].neighbors.set(b,(nodes[a].neighbors.get(b)||0)+1);
    nodes[b].neighbors.set(a,(nodes[b].neighbors.get(a)||0)+1);
  }
  for(let i=0;i<labels.length;i++) {
    if(i%width+1<width)connect(labels[i],labels[i+1]);
    if(i+width<labels.length)connect(labels[i],labels[i+width]);
  }
  let merges=0;
  function absorb(from,to) {
    const a=nodes[from],b=nodes[to];
    a.parent=to;b.area+=a.area;b.neighbors.delete(from);
    for(const [neighbor,border] of a.neighbors) {
      nodes[neighbor].neighbors.delete(from);
      if(neighbor===to)continue;
      const total=(b.neighbors.get(neighbor)||0)+border;
      b.neighbors.set(neighbor,total);nodes[neighbor].neighbors.set(to,total);
    }
    a.neighbors.clear();merges++;
  }
  nodes.forEach((_,id)=>push(id));
  while(heap.length) {
    const {id,area}=pop(),n=nodes[id];
    if(n.parent!==id || n.area!==area || n.area>=limit)continue;
    let target=-1,best=-1;
    for(const [other,border] of n.neighbors) {
      if(border>best || (border===best && other<target)){target=other;best=border;}
    }
    if(target<0)continue; // An isolated opaque piece cannot cross transparency.
    absorb(id,target);
    // Recoloring can connect previously separate pieces of the target color.
    // Coalesce them now so subsequent size decisions use the true region size.
    let joined=true;
    while(joined) {
      joined=false;
      for(const other of nodes[target].neighbors.keys())if(nodes[other].color===nodes[target].color) {
        absorb(other,target);joined=true;break;
      }
    }
    push(target);
  }
  function root(id) {
    let r=id;while(nodes[r].parent!==r)r=nodes[r].parent;
    while(id!==r){const next=nodes[id].parent;nodes[id].parent=r;id=next;}return r;
  }
  const output=new Int16Array(colorLabels.length);let changedPixels=0;
  for(let i=0;i<output.length;i++){output[i]=nodes[root(labels[i])].color;if(output[i]!==colorLabels[i])changedPixels++;}
  return {labels:output,merges,changedPixels};
}
