import http from 'node:http';
import {readFile,writeFile,rename,unlink,mkdir,readdir,lstat,realpath,open} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {decodeProject} from './dist/projects.mjs';

const appDirectory=path.dirname(fileURLToPath(import.meta.url));
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id);
const summary=p=>({id:p.id,name:p.name,updatedAt:p.updatedAt,thumbnail:p.thumbnail});
function problem(status,message){return Object.assign(Error(message),{status});}

export function createDiskStore(directory=path.join(appDirectory,'projects')) {
  const cache=new Map();
  // Serial writes also make create-only browser migration safe against autosave.
  let pending=Promise.resolve();
  const mutate=action=>{const next=pending.then(action);pending=next.catch(()=>{});return next;};
  const file=id=>{if(!validId(id))throw problem(400,'Invalid project ID.');return path.join(directory,id+'.stencil.json');};
  async function safeFile(target){try{if((await lstat(target)).isSymbolicLink())throw problem(400,'Project files cannot be symbolic links.');}catch(e){if(e.code!=='ENOENT')throw e;}}
  async function prepare(){await mkdir(directory,{recursive:true});if((await lstat(directory)).isSymbolicLink())throw problem(400,'The projects folder cannot be a symbolic link.');}
  async function get(id){const target=file(id);await safeFile(target);try{return await readFile(target,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  return {
    get,
    async list(){await pending;await prepare();const projects=[];
      for(const name of await readdir(directory)){
        if(!name.endsWith('.stencil.json'))continue;
        const id=name.slice(0,-13);if(!validId(id))continue;
        const target=file(id);await safeFile(target);const stat=await lstat(target),previous=cache.get(id);
        if(previous?.mtime===stat.mtimeMs&&previous.size===stat.size){projects.push(previous.value);continue;}
        try{const p=decodeProject(await readFile(target,'utf8'));if(p.id!==id)throw Error('File name and project ID differ.');const value=summary(p);cache.set(id,{mtime:stat.mtimeMs,size:stat.size,value});projects.push(value);}
        catch(e){throw problem(422,`Cannot read project ${name}: ${e.message}`);}
      }
      return projects.sort((a,b)=>b.updatedAt-a.updatedAt);
    },
    put(id,text,{createOnly=false}={}){return mutate(async()=>{
      const target=file(id);let p;try{p=decodeProject(text);}catch(e){throw problem(400,e.message);}
      if(p.id!==id||!Number.isFinite(p.updatedAt)||!Number.isFinite(p.createdAt))throw problem(400,'Invalid project metadata.');
      await prepare();await safeFile(target);
      if(createOnly&&await get(id)!==null)return {created:false};
      const temporary=path.join(directory,`.saving-${randomUUID()}`);
      try{
        await writeFile(temporary,text,{flag:'wx',mode:0o600});
        const handle=await open(temporary,'r+');try{await handle.sync();}finally{await handle.close();}
        // Rename is atomic: interruption leaves either the old or complete new file.
        await rename(temporary,target);cache.delete(id);
      }finally{await unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
      return {saved:true};
    });},
    delete(id){return mutate(async()=>{const target=file(id);await safeFile(target);try{await unlink(target);}catch(e){if(e.code!=='ENOENT')throw e;}cache.delete(id);});}
  };
}

export function createStudioServer({directory,staticDirectory=path.join(appDirectory,'dist'),maxBytes=512*1024*1024}={}) {
  const store=createDiskStore(directory);
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));}
  const server=http.createServer(async(req,res)=>{
    try {
      // Bind to loopback and reject foreign hosts/origins, including DNS rebinding.
      const port=server.address().port,hosts=[`127.0.0.1:${port}`,`localhost:${port}`],host=req.headers.host;
      if(!hosts.includes(host))throw problem(403,'Local access only.');
      if(req.headers.origin&&req.headers.origin!==`http://${host}`)throw problem(403,'Cross-origin access is not allowed.');
      if(req.headers['sec-fetch-site']==='cross-site')throw problem(403,'Cross-site access is not allowed.');
      const url=new URL(req.url,`http://${host}`),route=url.pathname;
      if(route.startsWith('/api/')){
        const match=/^\/api\/projects\/([a-zA-Z0-9_-]{1,100})$/.exec(route),id=match?.[1];
        if(req.method==='GET'&&route==='/api/projects'){json(res,200,await store.list());return;}
        if(req.method==='GET'&&id){const text=await store.get(id);if(text===null)throw problem(404,'Project not found.');res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(text);return;}
        if(!id)throw problem(404,'Unknown project route.');
        if(!['PUT','DELETE'].includes(req.method))throw problem(405,'Method not allowed.');
        if(req.headers['x-stencil-client']!=='1')throw problem(403,'Missing editor request header.');
        if(req.method==='DELETE'){await store.delete(id);json(res,200,{deleted:true});return;}
        if(req.headers['content-type']!=='application/json')throw problem(415,'Expected a project JSON file.');
        if(Number(req.headers['content-length'])>maxBytes)throw problem(413,'Project exceeds the 512 MB save limit.');
        const chunks=[];let bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>maxBytes)throw problem(413,'Project exceeds the 512 MB save limit.');chunks.push(chunk);}
        const result=await store.put(id,Buffer.concat(chunks).toString('utf8'),{createOnly:req.headers['if-none-match']==='*'});json(res,200,result);return;
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw problem(405,'Method not allowed.');
      const root=await realpath(staticDirectory),target=await realpath(path.join(root,decodeURIComponent(route==='/'?'/index.html':route)));
      if(!target.startsWith(root+path.sep))throw problem(403,'Path is outside the app.');
      const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[path.extname(target)];
      if(!mime)throw problem(404,'File not found.');
      const data=await readFile(target);res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
    }catch(e){if(!res.headersSent)json(res,e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:e.code==='ENOENT'?'File not found.':'Could not access project files. Check disk space and folder permissions.'});else res.destroy();}
  });
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8765);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535.');
  const server=createStudioServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Stop the old preview server or choose PORT=8767.`:error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Stencil Studio: http://127.0.0.1:${port}\nProjects: ${path.join(appDirectory,'projects')}`));
}
