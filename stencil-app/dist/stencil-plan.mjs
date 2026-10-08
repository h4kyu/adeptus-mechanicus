export const newStencilPlan=()=>({version:1,longEdgeInches:15,marginMm:12.7,activeLayer:1,hiddenLayers:[],showSheet:false,showIslands:true,bridgeWidthMm:3,autoBridgeMinMm:1.5,autoBridgeMaxMm:2,sheetIncludes:{},bridges:[]});
export function validateStencilPlan(plan,width,height,paletteCount){
 const fail=()=>{throw Error('Invalid stencil sheet or bridge data.');},number=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 if(!plan||plan.version!==1||!number(plan.longEdgeInches,1,100)||!number(plan.marginMm,1,100)||!number(plan.bridgeWidthMm,.25,25)||!Number.isInteger(plan.activeLayer)||plan.activeLayer<1||plan.activeLayer>7||typeof plan.showSheet!=='boolean'||typeof plan.showIslands!=='boolean'||!Array.isArray(plan.hiddenLayers)||!Array.isArray(plan.bridges))fail();
 if(plan.hiddenLayers.some(v=>!Number.isInteger(v)||v< -2||v===0||v>7))fail();
 const min=plan.autoBridgeMinMm===undefined?1.5:plan.autoBridgeMinMm,max=plan.autoBridgeMaxMm===undefined?2:plan.autoBridgeMaxMm;
 if(!number(min,.25,25)||!number(max,.25,25)||min>max)fail();
 if(plan.sheetIncludes!==undefined){
   const groups=plan.sheetIncludes;if(!groups||typeof groups!=='object'||Array.isArray(groups))fail();
   for(const [key,members] of Object.entries(groups))if(!/^[1-7]$/.test(key)||!Array.isArray(members)||new Set(members).size!==members.length||members.some(v=>!Number.isInteger(v)||v<1||v>7||v===Number(key)))fail();
 }
 const ids=new Set();
 for(const b of plan.bridges){if(typeof b.id!=='string'||!b.id||ids.has(b.id)||!Number.isInteger(b.layer)||b.layer<1||b.layer>7||!number(b.widthMm,.25,25)||typeof b.enabled!=='boolean'||typeof b.needsReview!=='boolean')fail();ids.add(b.id);for(const p of [b.a,b.b])if(!p||!number(p.x,-width*100,width*101)||!number(p.y,-height*100,height*101))fail();}
 return plan;
}
// Bridge history is separate from assignment history: a drag is committed once on release.
export function createBridgeHistory(){const past=[],future=[];return {
 commit(before,after){if(JSON.stringify(before)===JSON.stringify(after))return false;past.push(structuredClone(before));future.length=0;return true;},
 undo(current){if(!past.length)return null;future.push(structuredClone(current));return past.pop();},
 redo(current){if(!future.length)return null;past.push(structuredClone(current));return future.pop();},
 get canUndo(){return !!past.length;},get canRedo(){return !!future.length;}
};}
