import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createDiskStore,createStudioServer} from '../server.mjs';
import {encodeProject,decodeProject} from '../dist/projects.mjs';
const fixture=(id='one')=>({format:'stencil-studio',version:1,id,name:'Test artwork',createdAt:1,updatedAt:2,source:{width:1,height:1,data:new Uint8ClampedArray([10,20,30,128])},result:{labels:new Int32Array([0]),edges:new Uint8Array([1]),regions:[{id:0,area:1,bounds:[0,0,0,0],paletteIndex:0}],ignoredPixels:0,palette:[[10,20,30]],colorLabels:new Int16Array([0])},assignments:new Int16Array([-2]),settings:{},view:{}});
async function directory(t){const dir=await mkdtemp(path.join(tmpdir(),'stencil-store-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('disk projects survive store restart and rename without losing pixels or assignments',async t=>{
  const dir=await directory(t),store=createDiskStore(dir),p=fixture();await store.put(p.id,encodeProject(p));
  assert.deepEqual(decodeProject(await readFile(path.join(dir,'one.stencil.json'),'utf8')),p);
  const reopened=createDiskStore(dir);assert.deepEqual(decodeProject(await reopened.get('one')),p);
  p.name='Renamed';p.updatedAt=3;await reopened.put(p.id,encodeProject(p));assert.equal((await reopened.list())[0].name,'Renamed');
  assert.deepEqual(await readdir(dir),['one.stencil.json']);
});
test('invalid replacement and failed disk writes preserve previously saved data',async t=>{
  const dir=await directory(t),store=createDiskStore(dir),p=fixture();await store.put(p.id,encodeProject(p));
  await assert.rejects(store.put(p.id,'{}'));assert.deepEqual(decodeProject(await store.get(p.id)),p);
  const blocked=path.join(dir,'not-a-directory');await writeFile(blocked,'occupied');await assert.rejects(createDiskStore(blocked).put(p.id,encodeProject(p)));
  assert.deepEqual(decodeProject(await store.get(p.id)),p);
});
test('migration copies once and cannot overwrite an existing repo project',async t=>{
  const store=createDiskStore(await directory(t)),p=fixture();await store.put(p.id,encodeProject(p),{createOnly:true});
  const older={...p,name:'Old browser name'};assert.deepEqual(await store.put(p.id,encodeProject(older),{createOnly:true}),{created:false});assert.equal(decodeProject(await store.get(p.id)).name,p.name);
});
test('deletion affects only the selected project and persists after restart',async t=>{
  const dir=await directory(t),store=createDiskStore(dir);for(const id of ['one','two'])await store.put(id,encodeProject(fixture(id)));
  await store.delete('one');assert.equal(await store.get('one'),null);assert.deepEqual((await createDiskStore(dir).list()).map(p=>p.id),['two']);
});
test('path traversal and symlinks cannot read or replace unrelated files',async t=>{
  const dir=await directory(t),store=createDiskStore(dir),outside=path.join(dir,'untouched');await writeFile(outside,'original');
  await assert.rejects(store.put('../escape',encodeProject(fixture())));await symlink(outside,path.join(dir,'one.stencil.json'));
  await assert.rejects(store.get('one'));await assert.rejects(store.delete('one'));await assert.rejects(store.put('one',encodeProject(fixture())));assert.equal(await readFile(outside,'utf8'),'original');
});
async function serverFixture(t){const server=createStudioServer({directory:await directory(t),maxBytes:1024*1024});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>new Promise(resolve=>server.close(resolve)));return server.address().port;}
function request(port,route,{method='GET',headers={},body=''}={}){return new Promise((resolve,reject)=>{const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,text,headers:res.headers}));});req.on('error',reject);req.end(body);});}
test('HTTP API saves, lists, reopens, migrates and deletes portable project files',async t=>{
  const port=await serverFixture(t),p=fixture(),headers={'X-Stencil-Client':'1','Content-Type':'application/json'};
  assert.equal((await request(port,'/api/projects/one',{method:'PUT',headers,body:encodeProject(p)})).status,200);
  assert.equal(JSON.parse((await request(port,'/api/projects')).text)[0].name,p.name);
  assert.deepEqual(decodeProject((await request(port,'/api/projects/one')).text),p);
  assert.equal(JSON.parse((await request(port,'/api/projects/one',{method:'PUT',headers:{...headers,'If-None-Match':'*'},body:encodeProject({...p,name:'older'})})).text).created,false);
  assert.equal((await request(port,'/api/projects/one',{method:'DELETE',headers})).status,200);assert.equal((await request(port,'/api/projects/one')).status,404);
});
test('HTTP API refuses foreign sites, unexpected hosts, missing headers and malformed writes',async t=>{
  const port=await serverFixture(t),body=encodeProject(fixture());
  for(const headers of [{Origin:'https://elsewhere.test'}, {Host:'elsewhere.test'}, {'Sec-Fetch-Site':'cross-site'}])assert.equal((await request(port,'/api/projects',{headers})).status,403);
  assert.equal((await request(port,'/api/projects/one',{method:'PUT',body})).status,403);
  assert.equal((await request(port,'/api/projects/one',{method:'PUT',headers:{'X-Stencil-Client':'1'},body})).status,415);
  assert.equal((await request(port,'/api/projects/one',{method:'PUT',headers:{'X-Stencil-Client':'1','Content-Type':'application/json'},body:'{}'})).status,400);
  assert.equal((await request(port,'/api/projects/one',{method:'PUT',headers:{'X-Stencil-Client':'1','Content-Type':'application/json','Content-Length':2*1024*1024}})).status,413);
});
test('server serves the editor without exposing repo files',async t=>{
  const port=await serverFixture(t);assert.match((await request(port,'/')).text,/Your projects/);
  assert.equal((await request(port,'/app.mjs')).headers['content-type'],'text/javascript');
  assert.equal((await request(port,'/../server.mjs')).status,404);
  assert.equal((await request(port,'/projects/one.stencil.json')).status,404);
});
