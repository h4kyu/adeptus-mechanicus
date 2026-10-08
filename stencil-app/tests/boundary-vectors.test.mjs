import test from 'node:test';
import assert from 'node:assert/strict';
import {traceBoundaries} from '../dist/boundary-vectors.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
const trace=(values,width,recipe={tolerance:1,preserveCorners:true},alpha=new Uint8Array(values.length).fill(255))=>traceBoundaries(Int16Array.from(values),alpha,width,values.length/width,recipe);
// Read the generated vector shapes to test coverage, not their particular encoding.
function rings(d){const tokens=d.match(/[MLQZ]|-?\d+(?:\.\d+)?/g)||[];let i=0,p=null,ring=null,result=[];const point=()=>({x:+tokens[i++],y:+tokens[i++]});
 while(i<tokens.length){const type=tokens[i++];if(type==='M'){p=point();ring=[p];result.push(ring);}else if(type==='L'){p=point();ring.push(p);}else if(type==='Q'){const a=p,c=point(),b=point();for(let k=1;k<=20;k++){const t=k/20;ring.push({x:(1-t)**2*a.x+2*t*(1-t)*c.x+t*t*b.x,y:(1-t)**2*a.y+2*t*(1-t)*c.y+t*t*b.y});}p=b;}}
 return result;
}
function inside(d,x,y){let odd=false;for(const ring of rings(d))for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if((a.y>y)!==(b.y>y)&&x<a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y))odd=!odd;}return odd;}
test('large intentional corners stay sharp, while curved stairs become fewer vector segments',()=>{
 const square=trace(Array(400).fill(1),20);assert.equal(square.segments,4);assert.doesNotMatch(square.paths[0].d,/Q/);
 const circle=Array.from({length:1600},(_,i)=>(i%40-19.5)**2+(Math.floor(i/40)-19.5)**2<225?1:-1),out=trace(circle,40);
 assert.ok(out.segments<out.sourceEdges);assert.match(out.paths[0].d,/Q/);assert.equal(inside(out.paths[0].d,20,20),true);
});
test('neighboring treatments share smoothed edges without gaps or overlap',()=>{
 const values=Array.from({length:400},(_,i)=>i%20<5+Math.floor(Math.floor(i/20)/2)?1:2),out=trace(values,20,{tolerance:2,preserveCorners:false});
 for(let y=2.17;y<18;y+=.73)for(let x=2.13;x<18;x+=.61)assert.equal(out.paths.filter(p=>inside(p.d,x,y)).length,1);
});
test('holes, disconnected pieces and transparency remain distinct',()=>{
 const values=Array.from({length:225},(_,i)=>{const x=i%15,y=Math.floor(i/15);return x>=5&&x<10&&y>=5&&y<10?-2:1;});
 const out=trace(values,15),outer=out.paths.find(p=>p.treatment===1),hole=out.paths.find(p=>p.treatment===-2);
 assert.equal(inside(outer.d,7,7),false);assert.equal(inside(hole.d,7,7),true);assert.equal(inside(outer.d,2,2),true);
 const diagonals=trace([1,-1,-1,1],2);assert.equal(rings(diagonals.paths[0].d).length,2);
 assert.equal(trace([1,1,1,1],2,undefined,new Uint8Array(4)).paths.length,0);
});
test('zero smoothing traces exact pixel edges and does not mutate assignments',()=>{
 const values=Int16Array.from([1,-2,1,-2]),before=values.slice();const out=traceBoundaries(values,new Uint8Array(4).fill(255),2,2,{tolerance:0,preserveCorners:true});
 assert.deepEqual(values,before);assert.doesNotMatch(out.stroke,/Q/);assert.equal(out.segments,out.sourceEdges);
});
test('smoothing recipe round trips and rejects invalid settings',()=>{
 const p={format:'stencil-studio',version:1,name:'Boundary test',source:{width:1,height:1,data:new Uint8ClampedArray([20,20,20,255])},result:{labels:new Int32Array([0]),edges:new Uint8Array([1]),regions:[{id:0,area:1,bounds:[0,0,0,0],paletteIndex:0}],ignoredPixels:0,palette:[[20,20,20]],colorLabels:new Int16Array([0])},assignments:new Int16Array([-2]),settings:{},view:{},boundaryRefinement:{tolerance:1.5,preserveCorners:true}};
 assert.deepEqual(decodeProject(encodeProject(p)).boundaryRefinement,p.boundaryRefinement);
 p.boundaryRefinement.tolerance=100;assert.throws(()=>decodeProject(encodeProject(p)));
});

test('5px retries narrow jagged strips without reducing an unrelated boundary',()=>{
 const width=80,height=70,recipe={tolerance:5,preserveCorners:false};
 const circle=Int16Array.from({length:width*height},(_,i)=>(i%width-60)**2+(Math.floor(i/width)-35)**2<144?2:-1);
 const values=Int16Array.from(circle,(value,i)=>{const x=i%width,y=Math.floor(i/width),left=20+Math.round(8*Math.sin(y/4));return y>3&&y<66&&x>=left&&x<left+2?1:value;});
 const original=values.slice(),out=trace(values,width,recipe),isolated=trace(circle,width,recipe);
 assert.ok(out.reducedChains>0);assert.equal(out.minimumTolerance,1.25);assert.equal(out.protectedChains,0);
 assert.match(out.paths.find(p=>p.treatment===1).d,/Q/);
 assert.equal(out.paths.find(p=>p.treatment===2).d,isolated.paths.find(p=>p.treatment===2).d);
 assert.deepEqual(values,original);
});
