import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultLayout,sheetLayout,fittedPair,suggestSheetJoin,offsetCutPath,bridgeOnPiece} from '../dist/sheet-layout.mjs';
import {newStencilPlan,validateStencilPlan} from '../dist/stencil-plan.mjs';
import {buildStencilExport,pathRings} from '../dist/stencil-export.mjs';
import {buildPreviewSheets,previewSvg} from '../dist/stencil-preview.mjs';
import {analyzeSheet,rasterizeCutPath} from '../dist/stencil-geometry.mjs';
import {analyzeLayoutSheet} from '../dist/panel-analysis.mjs';
import {suggestBridges} from '../dist/auto-bridges.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';

const pair=(extra={})=>({...newStencilPlan(),longEdgeInches:400/25.4,layout:{...defaultLayout(),mode:'pair',trimJoin:true,...extra}});
function fixture(){
  const width=400,height=300,treatments=new Int16Array(width*height).fill(-2),alpha=new Uint8Array(width*height).fill(255);
  for(let y=100;y<200;y++)for(let x=50;x<350;x++)treatments[y*width+x]=1;
  return {width,height,treatments,alpha,plan:pair(),palette:[[0,0,0],[200,200,200]]};
}
function contains(d,x,y){let inside=false;for(const ring of pathRings(d,.0001))for(let i=1;i<ring.length;i++){const [ax,ay]=ring[i-1],[bx,by]=ring[i];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}return inside;}
test('Bonsai fits two portrait working areas at 15 inches without resizing, with clamped feasible joins',()=>{
  const plan={...pair(),longEdgeInches:15},g=sheetLayout(1159,1358,plan);
  assert.equal(g.fits,true);assert.equal(g.frames.length,2);assert.equal(g.heightInches,15);assert.equal(g.sheetWidthMm,290);
  assert.ok(Math.abs(g.frames[0].x+g.frames[0].width-g.frames[1].x-10*g.pxPerMm)<1e-9);
  assert.equal(sheetLayout(1159,1358,{...plan,layout:{...plan.layout,mode:'single'}}).fits,false);
  for(const split of [0,1]){const edge=sheetLayout(1159,1358,{...plan,layout:{...plan.layout,split}});assert.ok(edge.frames[0].x<=1e-8);assert.ok(edge.frames[1].x+edge.frames[1].width>=1159-1e-8);}
  assert.equal(sheetLayout(1159,1358,{...plan,longEdgeInches:50}).fits,false);
  assert.equal(sheetLayout(1159,1358,{...plan,layout:fittedPair(1159,1358,plan)}).fits,true);
});
test('join search prefers an explicit retained band across all intensities and flags unavoidable crossings',()=>{
  const f=fixture();f.treatments.fill(1);
  // A shared 25 mm retained band, away from the center; both orientations are considered.
  for(let y=0;y<f.height;y++)for(let x=130;x<155;x++)f.treatments[y*f.width+x]=-2;
  const hint=suggestSheetJoin(f);assert.equal(hint.cutPixels,0);assert.equal(hint.layout.axis,'x');assert.ok(hint.layout.split>.32&&hint.layout.split<.4);
  for(let y=0;y<f.height;y++)for(let x=130;x<155;x++)f.treatments[y*f.width+x]=2;
  assert.ok(suggestSheetJoin(f).cutPixels>0);
  assert.throws(()=>suggestSheetJoin({...f,plan:{...f.plan,longEdgeInches:100}}),/does not fit/);
});
test('each export uses its own full working area and duplicated overlap at unchanged scale',()=>{
  const f=fixture(),before=structuredClone(f),a=buildStencilExport(f),g=sheetLayout(f.width,f.height,f.plan);
  f.plan.layout.activePiece=1;const b=buildStencilExport(f);
  assert.equal(a.widthMm,290);assert.equal(b.heightMm,590);assert.equal(b.assemblyOffsetMm.xMm,280);assert.equal(a.assemblyOffsetMm.xMm,0);
  assert.match(a.filename,/piece-a/);assert.match(b.filename,/piece-b/);assert.match(b.svg,/Shared openings are duplicated/);
  assert.equal(contains(a.openingPath,200,150),true);assert.equal(contains(b.openingPath,200,150),true);
  assert.equal(contains(a.openingPath,300,150),false);assert.equal(contains(b.openingPath,300,150),true);
  assert.ok(a.joinOpeningAreaMm2>0);assert.match(a.warnings.join(' '),/join overlap crosses/);
  assert.doesNotMatch(a.svg,/<rect|<line|<mask|registration-mark/);assert.equal((a.svg.match(/<path /g)||[]).length,1);
  for(const [out,frame] of [[a,g.frames[0]],[b,g.frames[1]]])assert.equal(contains(out.d,200-frame.x,150-frame.y),true);
  f.plan.layout.activePiece=0;assert.deepEqual(f,before);
});
test('piece-specific bridges affect only their own piece and bleach preview clips them to stock',()=>{
  const f=fixture();f.plan.bridges=[{id:'a',layer:1,piece:0,a:{x:200,y:90},b:{x:200,y:210},widthMm:3,enabled:true,needsReview:false}];
  const a=buildStencilExport(f);f.plan.layout.activePiece=1;const b=buildStencilExport(f);
  assert.equal(contains(a.openingPath,200,150),false);assert.equal(contains(b.openingPath,200,150),true);
  const g=sheetLayout(f.width,f.height,f.plan);assert.equal(bridgeOnPiece(f.plan.bridges[0],f.plan,g,1),false);
  const data=buildPreviewSheets(f),svg=previewSvg(data,{mode:'bleach'});assert.match(svg.body,/clip-path="url\(#preview-bridge-frame-0\)"/);
  assert.match(previewSvg(data,{mode:'sheet',layer:1,piece:1}).body,/preview-material/);
});
test('horizontal joins preserve assembled opening coverage and local millimeter placement',()=>{
  const f=fixture();f.plan.layout={...f.plan.layout,axis:'y',orientation:'landscape'};
  const g=sheetLayout(f.width,f.height,f.plan),a=buildStencilExport(f);f.plan.layout.activePiece=1;const b=buildStencilExport(f);
  assert.equal(a.widthMm,590);assert.equal(a.heightMm,290);assert.equal(b.assemblyOffsetMm.yMm,280);
  for(let y=0;y<f.height;y+=3)for(let x=0;x<f.width;x+=3){
    const px=x+.5,py=y+.5;
    const covered=g.frames.map((r,i)=>({inside:px>=r.x&&py>=r.y&&px<r.x+r.width&&py<r.y+r.height,out:i?b:a,frame:r})).filter(p=>p.inside);
    const assembled=covered.length>0&&covered.every(p=>contains(p.out.openingPath,px,py));
    assert.equal(assembled,px>=50&&px<350&&py>=100&&py<200);
    for(const p of covered)assert.equal(contains(p.out.d,(px-p.frame.x)/g.pxPerMm,(py-p.frame.y)/g.pxPerMm),contains(p.out.openingPath,px,py));
  }
});
test('physical edge cuts cannot falsely connect two retained stock pieces via a virtual frame',()=>{
  const width=20,height=20,cut=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=9;x<11;x++)cut[y*width+x]=1;
  const analysis=analyzeSheet(cut,width,height,[],1,0,{physicalFrame:true});
  assert.equal(analysis.islands.length,1);assert.equal(analysis.islands[0].area,180);
  const bridges=suggestBridges(cut,width,height,analysis,1,0,2,1.5);assert.equal(bridges.length,1);
  assert.equal(analyzeSheet(cut,width,height,bridges,1,0,{physicalFrame:true}).islands.length,0);
  assert.equal(bridges.every(b=>b.a.x>=0&&b.b.x<width&&b.a.y>=0&&b.b.y<height),true);
});
test('a blank second piece needs uncut shielding rather than an empty SVG',()=>{
  const f=fixture();f.cachedCutPath='M50 100L80 100L80 200L50 200Z';f.paths=[];f.plan.layout.activePiece=1;
  assert.throws(()=>buildStencilExport(f),/Use uncut Mylar/);
  assert.throws(()=>analyzeLayoutSheet('',4000,3000,{...pair(),longEdgeInches:1}),error=>error.code==='SHEET_ANALYSIS_LIMIT');
});
test('uncut joining stock margins block export until openings avoid them or trimming is chosen',()=>{
  const f=fixture();f.plan.layout.trimJoin=false;
  assert.throws(()=>buildStencilExport(f),/uncut stock border would block/);
  for(let y=0;y<f.height;y++)for(let x=187;x<214;x++)if(x<195||x>=205)f.treatments[y*f.width+x]=-2;
  assert.doesNotThrow(()=>buildStencilExport(f));
  f.plan.layout.activePiece=1;assert.doesNotThrow(()=>buildStencilExport(f));
  const untrimmed=previewSvg(buildPreviewSheets(f),{mode:'bleach'}).body;
  f.plan.layout.trimJoin=true;const trimmed=previewSvg(buildPreviewSheets(f),{mode:'bleach'}).body;
  assert.notEqual(untrimmed,trimmed);
});
test('pair analysis returns artwork-aligned island labels and translates auto bridges',()=>{
  const f=fixture(),d='M50 90L350 90L350 210L50 210ZM70 120L100 120L100 180L70 180Z';
  const {result,suggestions}=analyzeLayoutSheet(d,f.width,f.height,f.plan,true);
  assert.equal(result.labels.length,f.width*f.height);assert.ok(result.labels[150*f.width+85]>0);assert.ok(suggestions.length);
  assert.equal(suggestions.every(b=>b.piece===0),true);
  assert.deepEqual(rasterizeCutPath(offsetCutPath('M2 2L8 2L8 8L2 8Z',1,2),12,12),rasterizeCutPath('M3 4L9 4L9 10L3 10Z',12,12));
});
test('layout persistence accepts legacy plans and rejects malformed layout or piece identities',()=>{
  assert.doesNotThrow(()=>validateStencilPlan(newStencilPlan(),400,300,2));assert.doesNotThrow(()=>validateStencilPlan(pair(),400,300,2));
  for(const update of [{axis:'diagonal'},{overlapMm:0},{split:2},{activePiece:4},{orientation:'square'},{trimJoin:'yes'}]){
    const plan=pair(update);assert.throws(()=>validateStencilPlan(plan,400,300,2));
  }
  const plan=pair();plan.bridges=[{id:'bad',layer:1,piece:2,a:{x:1,y:1},b:{x:2,y:2},widthMm:2,enabled:true,needsReview:false}];assert.throws(()=>validateStencilPlan(plan,400,300,2));
  plan.bridges[0].piece=1;
  const n=400*300,project={format:'stencil-studio',version:1,name:'Two sheets',source:{width:400,height:300,data:new Uint8ClampedArray(n*4).fill(255)},result:{labels:new Int32Array(n),edges:new Uint8Array(n),regions:[{id:0,area:n,bounds:[0,0,399,299],paletteIndex:0}],ignoredPixels:0,palette:[[0,0,0],[200,200,200]],colorLabels:new Int16Array(n)},assignments:new Int16Array([1]),settings:{},view:{},stencilPlan:plan};
  assert.deepEqual(decodeProject(encodeProject(project)),project);
});
