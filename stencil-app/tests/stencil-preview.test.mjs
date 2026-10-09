import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPreviewSheets,previewSvg,bleachColor} from '../dist/stencil-preview.mjs';
import {newStencilPlan} from '../dist/stencil-plan.mjs';
import {rasterizeCutPath} from '../dist/stencil-geometry.mjs';
function fixture(){
 const width=30,height=20,treatments=new Int16Array(width*height).fill(-2),alpha=new Uint8Array(width*height).fill(255);
 for(let y=2;y<18;y++)for(let x=2;x<28;x++)treatments[y*width+x]=x<15?1:2;
 const plan={...newStencilPlan(),sheetIncludes:{1:[2]},bridges:[{id:'a',layer:1,a:{x:10,y:0},b:{x:10,y:20},widthMm:2,enabled:true,needsReview:false},{id:'off',layer:2,a:{x:20,y:0},b:{x:20,y:20},widthMm:4,enabled:false,needsReview:false}]};
 return {width,height,treatments,alpha,palette:[[0,0,0],[100,100,100],[240,240,240]],plan};
}
test('preview uses independent overlapping sheet geometry and only enabled bridges',()=>{
 const f=fixture(),before=structuredClone(f),data=buildPreviewSheets(f);
 assert.deepEqual(data.sheets.map(s=>s.members),[[1,2],[2]]);assert.equal(data.sheets[0].bridges.length,1);assert.equal(data.sheets[1].bridges.length,0);
 assert.equal(rasterizeCutPath(data.sheets[0].cutPath,30,20)[5*30+5],1);assert.equal(rasterizeCutPath(data.sheets[1].cutPath,30,20)[5*30+5],0);assert.deepEqual(f,before);
});
test('Mylar mask cuts openings but restores bridge material at its physical width',()=>{
 const data=buildPreviewSheets(fixture()),svg=previewSvg(data,{mode:'sheet',layer:1});
 assert.match(svg.body,/fill="black" fill-rule="evenodd"/);assert.match(svg.body,new RegExp(`stroke="white" stroke-width="${2*data.scale.pxPerMm}"`));assert.match(svg.body,/fill="#dce6e9" mask=/);
 assert.doesNotMatch(svg.body,/preview-pass|stroke="#239baf"/);assert.ok(svg.viewBox.startsWith('-'));
});
test('bleach preview paints strongest last, masks each pass separately and supports hidden passes',()=>{
 const data=buildPreviewSheets(fixture()),svg=previewSvg(data,{mode:'bleach'});
 assert.ok(svg.body.indexOf(`fill="${bleachColor(data.sheets[0].level)}"`)<svg.body.indexOf(`fill="${bleachColor(data.sheets[1].level)}"`));
 assert.match(svg.body,/id="preview-pass-1"[^]*stroke="black"/);assert.match(svg.body,/id="preview-pass-2"/);
 const hidden=previewSvg(data,{mode:'bleach',enabled:[1]});assert.doesNotMatch(hidden.body,/preview-pass-2/);
 const none=previewSvg(data,{mode:'bleach',enabled:[]});assert.match(none.body,/fill="#24282b"/);assert.doesNotMatch(none.body,/preview-pass-/);
});
test('saved smoothing and cached sheet paths are reused without altering preview geometry',()=>{
 const f=fixture();f.recipe={tolerance:1,preserveCorners:false};const data=buildPreviewSheets(f);
 const sheetPaths=Object.fromEntries(data.sheets.map(s=>[s.members.join(','),s.cutPath]));assert.deepEqual(buildPreviewSheets({...f,sheetPaths}),data);
});
