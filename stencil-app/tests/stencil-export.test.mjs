import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStencilExport,pathRings,bridgePolygon} from '../dist/stencil-export.mjs';
import {newStencilPlan} from '../dist/stencil-plan.mjs';
import {buildSheetGeometry} from '../dist/sheet-composition.mjs';
import {rasterizeCutPath,pointSegmentDistance} from '../dist/stencil-geometry.mjs';

function fixture(){
 const width=40,height=30,treatments=new Int16Array(width*height).fill(-2),alpha=new Uint8Array(width*height).fill(255);
 for(let y=3;y<27;y++)for(let x=3;x<37;x++)treatments[y*width+x]=x<20?1:2;
 return {width,height,treatments,alpha,plan:{...newStencilPlan(),longEdgeInches:40/25.4,marginMm:5,sheetIncludes:{1:[2]}}};
}
const bridge=(id,a,b,widthMm=2,extra={})=>({id,layer:1,a,b,widthMm,enabled:true,needsReview:false,...extra});
const raster=(out,f)=>rasterizeCutPath(out.openingPath,f.width,f.height);
function contains(d,x,y){
 let inside=false;for(const ring of pathRings(d,.00001))for(let i=1;i<ring.length;i++){
   const [ax,ay]=ring[i-1],[bx,by]=ring[i];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }return inside;
}
test('exports a plain compound path in mm with openings only and a shared working area and no mutations',()=>{
 const f=fixture(),before=structuredClone(f),out=buildStencilExport(f);
 assert.equal(out.widthMm,590);assert.equal(out.heightMm,290);assert.match(out.svg,/width="590mm" height="290mm" viewBox="0 0 590 290"/);
 assert.equal((out.svg.match(/<path /g)||[]).length,1);assert.doesNotMatch(out.svg,/<(?:mask|image|use|clipPath|line|rect|text)\b|stroke=|transform=/);
 assert.equal(contains(out.d,1,1),false);assert.equal(contains(out.d,280,135),true);assert.equal(contains(out.materialPath,1,1),true);assert.deepEqual(out.cutBounds,{leftMm:278,topMm:133,widthMm:34,heightMm:24});assert.equal(pathRings(out.d,.001).length,1);assert.deepEqual(f,before);
 f.plan.activeLayer=2;const other=buildStencilExport(f);assert.equal(other.widthMm,out.widthMm);assert.equal(other.heightMm,out.heightMm);
});
test('subtracts crossing bridge capsules, ignores disabled bridges and other sheets',()=>{
 const f=fixture();f.plan.bridges=[bridge('v',{x:20,y:1},{x:20,y:29}),bridge('h',{x:1,y:15},{x:39,y:15}),bridge('off',{x:10,y:0},{x:10,y:30},6,{enabled:false}),bridge('other',{x:30,y:0},{x:30,y:30},6,{layer:2})];
 const out=buildStencilExport(f),cut=raster(out,f);
 for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)assert.equal(cut[y*f.width+x],Number(x>=3&&x<37&&y>=3&&y<27&&Math.abs(x+.5-20)>1&&Math.abs(y+.5-15)>1));
 assert.equal(out.disconnected,0);assert.equal(out.warnings.length,0);
});
test('preserves nested holes and reports vector islands including single-pixel specks',()=>{
 const f=fixture();for(let y=10;y<20;y++)for(let x=12;x<28;x++)f.treatments[y*40+x]=-2;
 f.treatments[15*40+20]=1;f.treatments[5*40+5]=-2;
 const out=buildStencilExport(f),cut=raster(out,f);
 assert.equal(cut[12*40+15],0);assert.equal(cut[15*40+20],1);assert.equal(cut[5*40+5],0);
 assert.equal(out.disconnected,2);assert.match(out.warnings.join(' '),/disconnected/);
 f.plan.bridges=[bridge('a',{x:20,y:1},{x:20,y:12},2)];assert.equal(buildStencilExport(f).disconnected,1);
});
test('uses direct overlap membership, transparency, unassigned pixels and saved smoothing',()=>{
 const f=fixture();f.recipe={tolerance:2,preserveCorners:false};f.plan.sheetIncludes={1:[2],2:[3]};
 f.treatments[0]=3;f.alpha[4*40+4]=0;f.treatments[4*40+30]=-1;
 const out=buildStencilExport(f),expected=rasterizeCutPath(buildSheetGeometry(f).cutPath,40,30);
 assert.deepEqual(raster(out,f),expected);assert.deepEqual(out.members,[1,2]);assert.match(out.warnings.join(' '),/1 unassigned/);
 assert.equal(raster(out,f)[0],0);
});
test('reuses a cached curved path, flattens curves at bounded deviation and keeps fractional width',()=>{
 const f=fixture();f.cachedCutPath='M3 3L30 3Q37 3 37 10L37 27L3 27Z';f.paths=[];
 f.plan.bridges=[bridge('a',{x:20,y:1},{x:20,y:29},2.35)];const out=buildStencilExport(f);
 assert.equal(contains(out.openingPath,18.82,15),true);assert.equal(contains(out.openingPath,18.83,15),false);
 assert.equal(contains(out.openingPath,21.17,15),false);assert.equal(contains(out.openingPath,21.18,15),true);
 const rings=pathRings(f.cachedCutPath,.005),ring=rings[0];
 for(let t=0;t<=1;t+=.01){const p={x:(1-t)**2*30+2*(1-t)*t*37+t*t*37,y:(1-t)**2*3+2*(1-t)*t*3+t*t*10};
   let distance=Infinity;for(let i=1;i<ring.length;i++)distance=Math.min(distance,pointSegmentDistance(p,{x:ring[i-1][0],y:ring[i-1][1]},{x:ring[i][0],y:ring[i][1]}));assert.ok(distance<=.005);
 }
});
test('capsules include round endpoints within the physical approximation tolerance',()=>{
 const b=bridge('a',{x:10,y:10},{x:20,y:10},3.5),ring=bridgePolygon(b,1,.005)[0];
 for(const [x,y] of ring)assert.ok(Math.abs(pointSegmentDistance({x,y},b.a,b.b)-1.75)<1e-10);
 for(let i=1;i<ring.length;i++){const p={x:(ring[i-1][0]+ring[i][0])/2,y:(ring[i-1][1]+ring[i][1])/2};assert.ok(pointSegmentDistance(p,b.a,b.b)>=1.745-1e-10);}
});
test('dimensions scale while physical bridge width remains fixed',()=>{
 const f=fixture();f.plan.bridges=[bridge('a',{x:20,y:1},{x:20,y:29},2)];f.plan.longEdgeInches*=2;
 const out=buildStencilExport(f);assert.equal(out.widthMm,590);assert.equal(out.heightMm,290);
 assert.equal(contains(out.d,293.99,145),true);assert.equal(contains(out.d,294.01,145),false);
 assert.equal(contains(out.d,295.99,145),false);assert.equal(contains(out.d,296.01,145),true);
});
test('reports review flags and small details without silently removing them',()=>{
 const f=fixture();f.plan.longEdgeInches/=2;f.treatments.fill(-2);f.treatments[5*40+5]=1;
 const out=buildStencilExport(f);assert.match(out.warnings.join(' '),/below 1 mm/);assert.equal(raster(out,f)[5*40+5],1);
 f.plan.bridges=[bridge('review',{x:0,y:0},{x:5.5,y:5.5},.25,{needsReview:true})];assert.match(buildStencilExport(f).warnings.join(' '),/review/);
});
test('rejects empty, fully covered or outside-sheet geometry without producing a file',()=>{
 const f=fixture();f.plan.activeLayer=3;assert.throws(()=>buildStencilExport(f),/no openings/);
 f.plan.activeLayer=1;f.plan.bridges=[bridge('a',{x:-300,y:0},{x:10,y:10})];assert.throws(()=>buildStencilExport(f),/outside the sheet/);
 f.plan.bridges=[bridge('a',{x:0,y:15},{x:40,y:15},60)];assert.throws(()=>buildStencilExport(f),/No openings remain/);
});
test('diagonal contacts and irregular nested raster regions preserve even/odd coverage',()=>{
 let seed=4921;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let run=0;run<8;run++){
   const f=fixture();for(let i=0;i<f.treatments.length;i++)f.treatments[i]=random()>.45?1:-2;
   f.plan.bridges=[bridge('diagonal',{x:-1,y:0},{x:41,y:30},2.35)];
   const out=buildStencilExport(f),cut=raster(out,f),b=f.plan.bridges[0];
   for(let y=0;y<30;y++)for(let x=0;x<40;x++){
     const distance=pointSegmentDistance({x:x+.5,y:y+.5},b.a,b.b);
     if(Math.abs(distance-1.175)<.005)continue;
     assert.equal(cut[y*40+x],Number(f.treatments[y*40+x]===1&&distance>1.175));
   }
 }
});

test('portrait sheets rotate the working area and oversize artwork is rejected',()=>{
 const f=fixture();f.plan.longEdgeInches=24;
 assert.throws(()=>buildStencilExport(f),/exceeds/);
 f.plan.longEdgeInches=40/25.4;f.width=30;f.height=40;
 const out=buildStencilExport(f);assert.equal(out.widthMm,290);assert.equal(out.heightMm,590);
 // Legacy padding no longer controls sheet dimensions or cut placement.
 f.plan.marginMm=80;assert.equal(buildStencilExport(f).svg,out.svg);
});
test('bridges can anchor in the extra horizontal shielding area',()=>{
 const f=fixture();f.plan.bridges=[bridge('long',{x:-200,y:15},{x:39,y:15})];
 const out=buildStencilExport(f);assert.equal(out.warnings.length,0);
 assert.equal(contains(out.d,280,145),false);
});
