import clipping from './vendor/polygon-clipping.mjs';
import {buildSheetGeometry,sheetLayers} from './sheet-composition.mjs';
import {sheetScale,pointSegmentDistance,rasterizeCutPath,analyzeSheet} from './stencil-geometry.mjs';

// Work in vector coordinates throughout: rasterizing and retracing the preview
// would erase the saved smoothing and quantize physical bridge widths.
const MAX_POINTS=300000;
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function pathRings(d,tolerance){
 const tokens=d.match(/[MLQZ]|-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)||[];
 let i=0,p=null,ring=null,count=0;const rings=[];
 const point=()=>{const v={x:Number(tokens[i++]),y:Number(tokens[i++])};if(!Number.isFinite(v.x)||!Number.isFinite(v.y))throw Error('Invalid vector coordinates.');return v;};
 const push=v=>{if(++count>MAX_POINTS)throw Error('Sheet is too complex to export. Simplify its boundaries first.');ring.push([v.x,v.y]);};
 function curve(a,c,b,depth=0){
   if(pointSegmentDistance(c,a,b)<=tolerance){push(b);return;}
   if(depth===24)throw Error('Curve could not be resolved at export precision.');
   const ac=midpoint(a,c),cb=midpoint(c,b),m=midpoint(ac,cb);curve(a,ac,m,depth+1);curve(m,cb,b,depth+1);
 }
 while(i<tokens.length){const command=tokens[i++];
   if(command==='M'){if(ring)throw Error('Unclosed cut contour.');p=point();ring=[];push(p);}
   else if(command==='L'&&ring){p=point();push(p);}
   else if(command==='Q'&&ring){const c=point(),b=point();curve(p,c,b);p=b;}
   else if(command==='Z'&&ring){if(ring.length>=3){const a=ring[0],b=ring.at(-1);if(a[0]!==b[0]||a[1]!==b[1])ring.push([...a]);rings.push(ring);}ring=null;}
   else throw Error('Unexpected cut contour command.');
 }
 if(ring)throw Error('Unclosed cut contour.');return rings;
}
function evenOdd(rings){
 // Each ring is an XOR operand, so holes and nested islands follow SVG's
 // even/odd fill rule regardless of their orientation. Batch to bound arguments.
 let groups=rings.map(r=>[[r]]);
 while(groups.length>1){const next=[];for(let i=0;i<groups.length;i+=128)next.push(clipping.xor(...groups.slice(i,i+128)));groups=next;}
 return groups.length?clipping.union(groups[0]):[];
}
export function bridgePolygon(bridge,pxPerMm,tolerance){
 const {a,b}=bridge,r=bridge.widthMm*pxPerMm/2,angle=Math.atan2(b.y-a.y,b.x-a.x);
 if(!Number.isFinite(r)||r<=0)throw Error('Invalid bridge width.');
 const steps=Math.max(8,Math.ceil(Math.PI/(2*Math.acos(Math.max(-1,1-Math.min(tolerance,r)/r))))),ring=[];
 for(const [center,start] of [[b,angle-Math.PI/2],[a,angle+Math.PI/2]])for(let i=0;i<=steps;i++){const theta=start+i*Math.PI/steps;ring.push([center.x+r*Math.cos(theta),center.y+r*Math.sin(theta)]);}
 ring.push([...ring[0]]);return [ring];
}
const number=v=>String(Number(v.toFixed(8)));
function path(polygons,convert=([x,y])=>[x,y]){
 return polygons.flatMap(poly=>poly.map(ring=>ring.slice(0,-1).map((p,i)=>`${i?'L':'M'}${convert(p).map(number).join(' ')}`).join('')+'Z')).join('');
}
function bounds(ring){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of ring){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return {width:x1-x0,height:y1-y0};}

export function buildStencilExport(data){
 const {width,height,plan,treatments,alpha}=data;
 if(!(width>0&&height>0&&plan.activeLayer>0&&plan.longEdgeInches>0))throw Error('Choose a positive intensity and valid sheet dimensions.');
 const {cutPath}=buildSheetGeometry(data),scale=sheetScale(width,height,plan.longEdgeInches),mx=scale.marginX,my=scale.marginY;
 if(!scale.fits)throw Error(`Artwork exceeds the 290 × 590 mm working area. Reduce its long edge to ${scale.maxLongEdgeInches.toFixed(2)} inches or less.`);
 // At most .005 mm or .05 source pixels per curve/capsule approximation.
 const tolerance=Math.min(.05,.005*scale.pxPerMm),rings=pathRings(cutPath,tolerance);
 if(!rings.length)throw Error('This sheet has no openings. Assign an intensity or choose another sheet.');
 const bridges=plan.bridges.filter(b=>b.layer===plan.activeLayer&&b.enabled);
 const inside=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-mx&&p.y>=-my&&p.x<=width+mx&&p.y<=height+my;
 if(bridges.some(b=>!inside(b.a)||!inside(b.b)))throw Error('A bridge is outside the sheet. Move it back or disable it before exporting.');
 let openings=evenOdd(rings);
 // Sequential batches also merge crossing/overlapping bridges without doubled cuts.
 for(let i=0;i<bridges.length;i+=128)openings=clipping.difference(openings,...bridges.slice(i,i+128).map(b=>bridgePolygon(b,scale.pxPerMm,tolerance)));
 const frame=[[[ -mx,-my],[width+mx,-my],[width+mx,height+my],[-mx,height+my],[-mx,-my]]];
 openings=clipping.intersection(openings,frame);
 if(!openings.length)throw Error('No openings remain after bridges. Choose another sheet or edit its bridges.');
 const material=clipping.difference(frame,openings),openingPath=path(openings),warnings=[];
 const disconnected=Math.max(0,material.length-1);
 if(disconnected)warnings.push(`${disconnected} disconnected retained ${disconnected===1?'piece will':'pieces will'} fall out. Add bridges or remove those islands.`);
 const analysis=analyzeSheet(rasterizeCutPath(cutPath,width,height),width,height,bridges,scale.pxPerMm,scale);
 const reviews=analysis.bridgeStatus.filter(b=>b.reason);
 if(reviews.length)warnings.push(`${reviews.length} ${reviews.length===1?'bridge needs':'bridges need'} review: ${[...new Set(reviews.map(b=>b.reason))].join('; ')}.`);
 const narrow=bridges.filter(b=>b.widthMm<2).length;
 if(narrow)warnings.push(`${narrow} ${narrow===1?'bridge is':'bridges are'} below 2 mm. Check material strength with a test cut.`);
 const tiny=openings.flat().filter(r=>{const b=bounds(r);return Math.min(b.width,b.height)/scale.pxPerMm<1;}).length;
 if(tiny)warnings.push(`${tiny} cut ${tiny===1?'contour has':'contours have'} a bounding width or height below 1 mm. Inspect small details.`);
 let unassigned=0;for(let i=0;i<treatments.length;i++)if(alpha[i]&&treatments[i]===-1)unassigned++;
 if(unassigned)warnings.push(`${unassigned.toLocaleString()} unassigned pixels remain retained material.`);
 const widthMm=scale.sheetWidthMm,heightMm=scale.sheetHeightMm;
 const convert=([x,y])=>[(x+mx)/scale.pxPerMm,(y+my)/scale.pxPerMm];
 const d=path(openings,convert),materialPath=path(material,convert);
 const points=openings.flat(2).map(convert);let leftMm=Infinity,topMm=Infinity,rightMm=-Infinity,bottomMm=-Infinity;
 for(const [x,y] of points){leftMm=Math.min(leftMm,x);topMm=Math.min(topMm,y);rightMm=Math.max(rightMm,x);bottomMm=Math.max(bottomMm,y);}
 const cutBounds={leftMm,topMm,widthMm:rightMm-leftMm,heightMm:bottomMm-topMm};
 const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${number(widthMm)}mm" height="${number(heightMm)}mm" viewBox="0 0 ${number(widthMm)} ${number(heightMm)}">\n<title>Stencil Intensity ${plan.activeLayer}</title>\n<desc>Sheet ${number(widthMm)} x ${number(heightMm)} mm. Cuts treatments ${sheetLayers(plan).join(', ')}. Openings only; no outer sheet edge is cut. Bridges are retained material. Cut bounds ${number(cutBounds.widthMm)} x ${number(cutBounds.heightMm)} mm; top-left offset ${number(leftMm)}, ${number(topMm)} mm from working-area origin.</desc>\n<path id="stencil-sheet-${plan.activeLayer}" fill="#000000" fill-rule="evenodd" d="${d}"/>\n</svg>\n`;
 return {svg,d,materialPath,cutBounds,widthMm,heightMm,openingPath,warnings,disconnected,members:sheetLayers(plan),layer:plan.activeLayer,filename:`stencil-intensity-${plan.activeLayer}-${widthMm.toFixed(2)}x${heightMm.toFixed(2)}mm.svg`};
}
