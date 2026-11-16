// A single worker serializes snapshots without blocking drawing or detaching
// the live editor's arrays. A worker failure rejects saves and permits retry.
export function createProjectCodec({makeWorker=()=>new Worker(new URL('./project-codec-worker.mjs',import.meta.url),{type:'module'})}={}){
  let worker=null,nextId=0,disposed=false;
  const pending=new Map();
  function fail(message){
    worker?.terminate();worker=null;
    for(const {reject} of pending.values())reject(Error(message));
    pending.clear();
  }
  function request(action,value){
    if(disposed)return Promise.reject(Error('Project codec is closed.'));
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      try{
        if(!worker){
          const active=worker=makeWorker();
          active.onmessage=({data})=>{
            if(worker!==active)return;
            const job=pending.get(data.id);if(!job)return;
            pending.delete(data.id);
            if(data.error)job.reject(Error(data.error));else job.resolve(data.value);
          };
          active.onerror=event=>{event.preventDefault?.();if(worker===active)fail('Project save/load worker failed. Retry the operation; your open project is still available.');};
          active.onmessageerror=()=>{if(worker===active)fail('Could not read the project worker response. Retry the operation.');};
        }
        pending.set(id,{resolve,reject});
        // Structured cloning freezes this snapshot before any later edit runs.
        worker.postMessage({id,action,value});
      }catch(error){pending.delete(id);reject(Error(`Could not prepare project data: ${error.message}`));}
    });
  }
  return {
    encode:project=>request('encode',project),
    decode:text=>request('decode',text),
    dispose(){disposed=true;fail('Project codec is closed.');}
  };
}
