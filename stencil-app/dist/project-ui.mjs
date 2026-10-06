import {createBrowserProjectStore,createProjectStore,encodeProject,decodeProject,validateProject,PROJECT_VERSION} from './projects.mjs';
export function setupProjects(editor) {
  const $=id=>document.getElementById(id),store=createProjectStore();
  let current=null,dirty=0,saved=0,timer,running=null,restoring=false,busy=false,lastError='';
  const library=$('project-library');
  function error(e){const message=`${e.message || 'Project operation failed.'}${current?' Your open project is still available; export it for a backup.':''}`;lastError=message;$('project-error').textContent=message;$('error').textContent=message;}
  function status(text){$('save-status').textContent=text;}
  function title(){ $('project-title').textContent=current?.name||'Projects';$('project-rename').disabled=$('project-export').disabled=!current; }
  function changed(){if(!current||restoring)return;dirty++;status('Saving…');clearTimeout(timer);timer=setTimeout(()=>flush().catch(error),650);}
  async function snapshot(){const data=await editor.snapshot();return {...current,...data,format:'stencil-studio',version:PROJECT_VERSION,updatedAt:Date.now()};}
  async function flush(){
    clearTimeout(timer);if(running)return running;
    running=(async()=>{while(current&&saved!==dirty){const generation=dirty;const p=await snapshot();await store.put(p);saved=generation;current.updatedAt=p.updatedAt;}if(current){status('Saved in repo');if(lastError&&$('error').textContent===lastError)$('error').textContent='';$('project-error').textContent='';lastError='';}})().catch(e=>{status('Not saved · export a backup');throw e;}).finally(()=>{running=null;});
    return running;
  }
  async function act(fn){if(busy)return;busy=true;document.querySelector('.project-menu').open=false;$('project-error').textContent='';try{await fn();}catch(e){error(e);}finally{busy=false;}}
  function created(name){document.querySelector('.project-menu').open=false;current={id:crypto.randomUUID(),name:name.replace(/\.[^.]+$/,'').slice(0,200)||'Untitled project',createdAt:Date.now()};dirty=0;saved=0;title();$('library-close').hidden=false;library.close();changed();}
  async function open(id){await flush();const p=await store.get(id);if(!p)throw Error('This project is no longer in the library.');validateProject(p);restoring=true;try{await editor.restore(p);current={id:p.id,name:p.name,createdAt:p.createdAt,updatedAt:p.updatedAt};dirty=saved=0;title();status('Saved in repo');library.close();}finally{restoring=false;}}
  async function ask({title,message,value,action}) {
    const dialog=$('project-dialog');dialog.returnValue='cancel';$('project-dialog-title').textContent=title;$('project-dialog-message').textContent=message;
    $('project-name-label').hidden=value===undefined;$('project-name').value=value||'';$('project-name').required=value!==undefined;$('project-dialog-action').textContent=action;
    return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='accept'?(value===undefined?true:$('project-name').value.trim()):null),{once:true});dialog.showModal();if(value!==undefined){$('project-name').focus();$('project-name').select();}});
  }
  async function rename(id){const p=id===current?.id?current:await store.get(id);if(!p)return;
    const name=await ask({title:'Rename project',message:'Choose a name for this artwork.',value:p.name,action:'Save name'});if(!name)return;
    if(id===current?.id){current.name=name;title();changed();await flush();}else {p.name=name;p.updatedAt=Date.now();await store.put(p);}if(library.open)await list();}
  async function remove(id){const p=await store.get(id);if(!p)return;
    if(!await ask({title:'Delete project?',message:`Delete “${p.name}”? This removes its local copy and cannot be undone. Export a backup first if you want to keep it.`,action:'Delete project'}))return;
    if(id===current?.id){await flush();await store.delete(id);current=null;dirty=saved=0;editor.clear();title();status('No project open');}else await store.delete(id);await list();}
  function button(label,fn){const b=document.createElement('button');b.textContent=label;b.type='button';b.addEventListener('click',()=>act(fn));return b;}
  async function list(){
    const items=await store.list(),grid=$('project-grid');grid.replaceChildren();
    $('project-empty').hidden=items.length>0;
    for(const p of items){const card=document.createElement('article');card.className='project-card';
      const openButton=button('',()=>open(p.id));openButton.className='project-open';
      const img=document.createElement('img');img.alt='';img.src=p.thumbnail||'';
      const name=document.createElement('strong');name.textContent=p.name;
      const date=document.createElement('span');date.textContent=`${p.id===current?.id?'Open · ':''}${new Date(p.updatedAt).toLocaleString()}`;
      openButton.append(img,name,date);
      const actions=document.createElement('div');actions.className='project-card-actions';actions.append(button('Rename',()=>rename(p.id)),button('Delete',()=>remove(p.id)));card.append(openButton,actions);grid.append(card);
    }
    $('library-close').hidden=!current;
  }
  async function show(){library.showModal();$('library-close').hidden=!current;try{await flush();}finally{await list();}}
  $('all-projects').addEventListener('click',()=>act(show));
  $('library-close').addEventListener('click',()=>library.close());
  library.addEventListener('cancel',e=>{if(!current||busy)e.preventDefault();});
  $('project-new').addEventListener('click',()=>$('file').click());
  $('library-new').addEventListener('click',()=>$('file').click());
  $('library-sample').addEventListener('click',()=>{if(!busy)editor.sample();});
  $('project-rename').addEventListener('click',()=>act(()=>rename(current.id)));
  $('project-retry').addEventListener('click',()=>act(async()=>{await flush();if(library.open)await list();}));
  $('project-export').addEventListener('click',()=>act(async()=>{
    const p=await snapshot(),blob=new Blob([encodeProject(p)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=p.name.replace(/[^a-z0-9 _-]/gi,'_')+'.stencil.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }));
  $('library-migrate').addEventListener('click',()=>act(async()=>{
    await flush();const browserStore=createBrowserProjectStore();let copied=0,skipped=0;
    for(const item of await browserStore.list()){
      const project=await browserStore.get(item.id);validateProject(project);editor.validateSettings(project.settings);
      const result=await store.put(project,{createOnly:true});if(result.created===false)skipped++;else copied++;
    }
    await list();$('migration-status').textContent=`${copied} copied to the repo${skipped?`, ${skipped} already present`:''}. Browser copies kept.`;
  }));
  $('library-import').addEventListener('click',()=>$('project-import').click());
  $('menu-import').addEventListener('click',()=>$('project-import').click());
  $('project-import').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(!file)return;act(async()=>{
    const p=decodeProject(await file.text());editor.validateSettings(p.settings);await flush();p.id=crypto.randomUUID();p.createdAt=p.updatedAt=Date.now();p.thumbnail=editor.thumbnail(p.source);await store.put(p);await open(p.id);
  });});
  document.addEventListener('input',e=>{if(e.target.type!=='number'&&e.target.closest('#inspector,#floating-settings'))changed();});
  document.addEventListener('change',e=>{if(e.target.closest('#inspector,#floating-settings'))changed();});
  window.addEventListener('beforeunload',e=>{if(current&&saved!==dirty){e.preventDefault();e.returnValue='';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush().catch(error);});
  title();status('No project open');
  return {changed,flush,created,get active(){return !!current;},start:()=>act(show),report:error};
}
