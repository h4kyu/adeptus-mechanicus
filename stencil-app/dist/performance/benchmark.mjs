import {decodeProject,encodeProject} from '../projects.mjs';
import {decodeProjectFast} from './codec-prototype.mjs';
const $=id=>document.getElementById(id),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function measure(name,operation,check){
  $('status').textContent=name;await pause(80);
  let last=performance.now(),gap=0;
  const timer=setInterval(()=>{const now=performance.now();gap=Math.max(gap,now-last);last=now;},16);
  const start=performance.now(),value=await operation(),duration=performance.now()-start;
  await pause(40);clearInterval(timer);
  const checked=check(value),row=document.createElement('tr');
  for(const item of [name,`${duration.toFixed(1)} ms`,`${gap.toFixed(1)} ms`,checked?'Pass':'FAIL']){const td=document.createElement('td');td.textContent=item;row.append(td);}
  $('results').append(row);console.log('[benchmark]',JSON.stringify({name,durationMs:duration,maxHeartbeatGapMs:gap,checked}));return value;
}
function workerRun(worker,action,value){return new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.error?reject(Error(data.error)):resolve(data.value);worker.onerror=event=>reject(Error(event.message||'Worker failed'));worker.postMessage({action,value});});}
$('run').addEventListener('click',async()=>{
  $('run').disabled=true;$('results').replaceChildren();const worker=new Worker('./codec-worker.mjs',{type:'module'});
  try{
    const list=await(await fetch('/api/projects')).json(),entry=list.find(p=>p.name==='Four-Tone Inverted Bonsai Waterfall');if(!entry)throw Error('Bonsai project is missing.');
    const text=await(await fetch('/api/projects/'+entry.id)).text();let project;
    const shape=value=>value.source.width===1159&&value.source.height===1358&&value.result.regions.length===43096;
    project=await measure('Current decode (main thread)',()=>decodeProject(text),shape);
    $('project').textContent=`${entry.name} · ${project.source.width} × ${project.source.height} · ${project.result.regions.length.toLocaleString()} regions · ${(text.length/1e6).toFixed(1)} MB JSON`;
    const encoded=await measure('Current encode (main thread)',()=>encodeProject(project),value=>value.length>0);
    await measure('Loop decode prototype (main thread)',()=>decodeProjectFast(text),shape);
    await measure('Loop decode prototype (worker)',()=>workerRun(worker,'decode',text),shape);
    await measure('Current encode + validation (worker)',()=>workerRun(worker,'encode',project),value=>value===encoded);
    $('status').textContent='Complete. Worker encoding is byte-identical to the current codec. Full deep equality of the decoding prototype is checked separately by the Node benchmark.';
  }catch(error){$('status').textContent='Failed: '+error.message;}finally{worker.terminate();$('run').disabled=false;}
});
