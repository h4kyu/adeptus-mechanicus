// Read-only, real-project codec benchmark. Pass a copied .stencil.json file.
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {decodeProject,encodeProject} from '../dist/projects.mjs';
import {decodeProjectFast} from '../dist/performance/codec-prototype.mjs';
const file=process.argv[2];
if(!file)throw Error('Usage: node stencil-app/diagnostics/benchmark-project.mjs /path/to/copied.stencil.json');
const text=await readFile(file,'utf8'),results=[];
function measure(name,run){const start=performance.now(),value=run();results.push({name,ms:Number((performance.now()-start).toFixed(1))});return value;}
const project=measure('current decode',()=>decodeProject(text));
const fast=measure('loop decode prototype',()=>decodeProjectFast(text));
assert.deepEqual(fast,project);
const encoded=measure('current encode',()=>encodeProject(project));
assert.equal(encodeProject(fast),encoded);
console.log(JSON.stringify({file,bytes:Buffer.byteLength(text),pixels:project.source.width*project.source.height,regions:project.result.regions.length,results,checks:'Deep equality and identical re-encoding passed; no files written.'},null,2));
