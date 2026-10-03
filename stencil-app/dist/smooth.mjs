import { toLab, toRGB } from './quantize.mjs';

// One non-recursive bilateral pass: every output reads only the original input.
// Gaussian spatial and OKLab-distance weights suppress mixing across strong edges.
export function bilateral(data, width, height, {radius=2, strength=.06}={}) {
  const output=new Uint8ClampedArray(data);
  radius=Math.max(0,Math.min(5,Math.round(radius)));
  if(!radius || strength<=0)return output;
  const labs=new Float32Array(width*height*3);
  for(let i=0;i<width*height;i++) if(data[i*4+3])labs.set(toLab(data[i*4],data[i*4+1],data[i*4+2]),i*3);
  const offsets=[],spatialSigma=Math.max(.5,radius/2),colorDenom=2*strength*strength;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++) {
    if(dx*dx+dy*dy<=radius*radius)offsets.push([dx,dy,Math.exp(-(dx*dx+dy*dy)/(2*spatialSigma*spatialSigma))]);
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const i=y*width+x,p=i*3,a=data[i*4+3]/255;
    if(!a)continue;
    let weight=0,L=0,A=0,B=0;
    for(const [dx,dy,spatial] of offsets) {
      const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
      const j=ny*width+nx,q=j*3,alpha=data[j*4+3]/255;if(!alpha)continue;
      const distance=(labs[p]-labs[q])**2+(labs[p+1]-labs[q+1])**2+(labs[p+2]-labs[q+2])**2;
      // Low-opacity neighbors contribute less; opacity itself is never blurred.
      const w=spatial*Math.exp(-distance/colorDenom)*alpha;
      weight+=w;L+=labs[q]*w;A+=labs[q+1]*w;B+=labs[q+2]*w;
    }
    output.set(toRGB([L/weight,A/weight,B/weight]),i*4);
  }
  return output;
}
