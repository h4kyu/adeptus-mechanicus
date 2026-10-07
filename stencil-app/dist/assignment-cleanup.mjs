import {UNASSIGNED} from './assignments.mjs';
// Four-connected components of the effective treatments, not the source segmentation.
export function cleanupAssignments(treatments,alpha,width,height,minimum=20,scope='unassigned'){
  const n=width*height,limit=Math.max(1,Math.round(minimum)||1);
  if(treatments.length!==n||alpha.length!==n||!['unassigned','all'].includes(scope))throw Error('Invalid cleanup input.');
  const components=new Int32Array(n).fill(-1),queue=new Int32Array(n),nodes=[];
  for(let seed=0;seed<n;seed++){
    if(!alpha[seed]||components[seed]>=0)continue;
    const id=nodes.length,treatment=treatments[seed];let head=0,tail=1;queue[0]=seed;components[seed]=id;
    const visit=i=>{if(alpha[i]&&components[i]<0&&treatments[i]===treatment){components[i]=id;queue[tail++]=i;}};
    while(head<tail){const i=queue[head++],x=i%width;
      if(x)visit(i-1);if(x+1<width)visit(i+1);if(i>=width)visit(i-width);if(i+width<n)visit(i+width);
    }
    nodes.push({parent:id,area:tail,treatment,neighbors:new Map()});
  }
  function connect(a,b){if(a<0||b<0||a===b)return;const x=nodes[a].neighbors,y=nodes[b].neighbors;x.set(b,(x.get(b)||0)+1);y.set(a,(y.get(a)||0)+1);}
  for(let i=0;i<n;i++){if(i%width+1<width)connect(components[i],components[i+1]);if(i+width<n)connect(components[i],components[i+width]);}
  const eligible=node=>node.area<limit&&(scope==='all'||node.treatment===UNASSIGNED),heap=[];
  const less=(a,b)=>a.area<b.area||(a.area===b.area&&a.id<b.id);
  function push(id){const node=nodes[id];if(!eligible(node))return;const entry={id,area:node.area};let i=heap.length;heap.push(entry);
    while(i){const p=(i-1)>>1;if(!less(entry,heap[p]))break;heap[i]=heap[p];i=p;}heap[i]=entry;
  }
  function pop(){const first=heap[0],last=heap.pop();if(!heap.length)return first;let i=0;
    while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&less(heap[c+1],heap[c]))c++;if(!less(heap[c],last))break;heap[i]=heap[c];i=c;}heap[i]=last;return first;
  }
  function absorb(from,to){const a=nodes[from],b=nodes[to];a.parent=to;b.area+=a.area;b.neighbors.delete(from);
    for(const [other,border] of a.neighbors){nodes[other].neighbors.delete(from);if(other===to)continue;const sum=(b.neighbors.get(other)||0)+border;b.neighbors.set(other,sum);nodes[other].neighbors.set(to,sum);}
    a.neighbors.clear();
  }
  nodes.forEach((_,id)=>push(id));
  while(heap.length){
    const {id,area}=pop(),node=nodes[id];if(node.parent!==id||node.area!==area||!eligible(node))continue;
    // Add shared edges by treatment, even when that treatment has disconnected pieces.
    // Unassigned is never a destination: cleanup cannot erase an intentional assignment.
    const borders=new Map();
    for(const [other,border] of node.neighbors){const value=nodes[other].treatment;if(value!==UNASSIGNED)borders.set(value,(borders.get(value)||0)+border);}
    let treatment=null,best=-1;
    for(const [value,border] of borders)if(border>best||(border===best&&value<treatment)){treatment=value;best=border;}
    if(treatment===null)continue;
    let target=-1;for(const other of node.neighbors.keys())if(nodes[other].treatment===treatment&&(target<0||other<target))target=other;
    absorb(id,target);
    // Joining through the absorbed patch can connect several same-treatment pieces.
    let joined=true;while(joined){joined=false;for(const other of nodes[target].neighbors.keys())if(nodes[other].treatment===treatment){absorb(other,target);joined=true;break;}}
    push(target);
  }
  function root(id){let r=id;while(nodes[r].parent!==r)r=nodes[r].parent;while(id!==r){const next=nodes[id].parent;nodes[id].parent=r;id=next;}return r;}
  const labels=treatments.slice();let changedPixels=0,changedPatches=0,remainingPatches=0;
  for(let id=0;id<nodes.length;id++){const r=root(id);if(nodes[id].treatment!==nodes[r].treatment)changedPatches++;if(r===id&&eligible(nodes[id]))remainingPatches++;}
  for(let i=0;i<n;i++)if(components[i]>=0){labels[i]=nodes[root(components[i])].treatment;if(labels[i]!==treatments[i])changedPixels++;}
  return {labels,changedPixels,changedPatches,remainingPatches};
}
