import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createProjectCodec} from '../dist/project-codec-client.mjs';
import {encodeProject,decodeProject,createProjectStore} from '../dist/projects.mjs';

const fixture=()=>({format:'stencil-studio',version:1,id:'worker-check',name:'Worker check',createdAt:1,updatedAt:2,source:{width:1,height:1,data:new Uint8ClampedArray([10,20,30,128])},result:{labels:new Int32Array([0]),edges:new Uint8Array([1]),regions:[{id:0,area:1,bounds:[0,0,0,0],paletteIndex:0}],ignoredPixels:0,palette:[[10,20,30]],colorLabels:new Int16Array([0])},assignments:new Int16Array([-2]),settings:{},view:{}});
function realWorker(){
  const moduleUrl=new URL('../dist/project-codec-worker.mjs',import.meta.url).href;
  const thread=new Worker(`const {parentPort}=require('node:worker_threads');import(${JSON.stringify(moduleUrl)}).then(({processProjectJob})=>parentPort.on('message',job=>parentPort.postMessage(processProjectJob(job))));`,{eval:true});
  const adapter={postMessage:value=>thread.postMessage(value),terminate:()=>thread.terminate()};
  thread.on('message',data=>adapter.onmessage?.({data}));thread.on('error',error=>adapter.onerror?.(error));
  return adapter;
}
test('real worker takes an independent snapshot and round trips without detaching editor arrays',async t=>{
  const codec=createProjectCodec({makeWorker:realWorker});t.after(()=>codec.dispose());
  const project=fixture(),expected=structuredClone(project),saving=codec.encode(project);
  project.assignments[0]=-1;project.source.data[0]=99;
  const encoded=await saving;
  assert.equal(encoded,encodeProject(expected));assert.deepEqual(await codec.decode(encoded),expected);
  assert.equal(project.source.data.byteLength,4);assert.equal(project.source.data[0],99);
  const latest=await codec.encode(project);assert.deepEqual(decodeProject(latest),project);
});
test('invalid data rejects without breaking later worker jobs',async t=>{
  const codec=createProjectCodec({makeWorker:realWorker});t.after(()=>codec.dispose());
  await assert.rejects(codec.decode('{broken'));
  await assert.rejects(codec.encode({...fixture(),assignments:new Int16Array([7])}));
  assert.deepEqual(await codec.decode(await codec.encode(fixture())),fixture());
  await assert.rejects(codec.encode({...fixture(),uncloneable:()=>{}}),/prepare project data/);
  assert.deepEqual(await codec.decode(encodeProject(fixture())),fixture());
});
test('request IDs route replies and worker failure rejects all pending jobs before retry',async()=>{
  const workers=[];
  const codec=createProjectCodec({makeWorker:()=>{const worker={jobs:[],postMessage(value){this.jobs.push(value);},terminate(){this.terminated=true;}};workers.push(worker);return worker;}});
  const a=codec.encode({a:1}),b=codec.decode('b'),first=workers[0];
  first.onmessage({data:{id:first.jobs[1].id,value:'second'}});first.onmessage({data:{id:first.jobs[0].id,value:'first'}});
  assert.deepEqual(await Promise.all([a,b]),['first','second']);
  const c=codec.encode({}),d=codec.decode('');
  const failures=Promise.all([assert.rejects(c,/worker failed/),assert.rejects(d,/worker failed/)]);
  first.onerror({preventDefault(){}});await failures;assert.equal(first.terminated,true);
  const retry=codec.encode({}),second=workers[1];first.onerror({});first.onmessageerror();second.onmessage({data:{id:second.jobs[0].id,value:'retried'}});assert.equal(await retry,'retried');
  const closing=codec.decode('');const rejected=assert.rejects(closing,/closed/);codec.dispose();await rejected;await assert.rejects(codec.encode({}),/closed/);
});
test('disk API waits for worker encoding, keeps create-only semantics and sends no write on codec failure',async t=>{
  const originalFetch=globalThis.fetch,calls=[];t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({saved:true}),text:async()=>'serialized'};};
  let finish;
  const codec={encode:()=>new Promise(resolve=>{finish=resolve;}),decode:async text=>({decoded:text})};
  const store=createProjectStore({codec}),saving=store.put(fixture(),{createOnly:true});
  assert.equal(calls.length,0);finish('encoded snapshot');await saving;
  assert.equal(calls[0].options.body,'encoded snapshot');assert.equal(calls[0].options.headers['If-None-Match'],'*');
  assert.deepEqual(await store.get('worker-check'),{decoded:'serialized'});
  const previous=calls.length;
  await assert.rejects(createProjectStore({codec:{encode:async()=>{throw Error('worker unavailable');}}}).put(fixture()),/worker unavailable/);
  assert.equal(calls.length,previous);
});
