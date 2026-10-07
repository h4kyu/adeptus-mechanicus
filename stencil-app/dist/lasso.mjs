// Even/odd scanline fill: pair polygon crossings on each pixel-center row.
// This handles concave and self-crossing paths without resizing the source.
export function lassoMask(points,width,height,eligible=()=>true){
  const mask=new Uint8Array(width*height);if(points.length<3)return mask;
  let low=height,high=0;for(const p of points){low=Math.min(low,p.y);high=Math.max(high,p.y);}
  for(let y=Math.max(0,Math.ceil(low-.5));y<Math.min(height,Math.ceil(high-.5));y++){
    const row=y+.5,crossings=[];
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[j],b=points[i];if((a.y>row)!==(b.y>row))crossings.push(a.x+(row-a.y)*(b.x-a.x)/(b.y-a.y));
    }
    crossings.sort((a,b)=>a-b);
    for(let pair=0;pair+1<crossings.length;pair+=2){
      const left=Math.max(0,Math.ceil(crossings[pair]-.5)),right=Math.min(width,Math.ceil(crossings[pair+1]-.5));
      for(let x=left;x<right;x++){const i=y*width+x;if(eligible(i))mask[i]=1;}
    }
  }
  return mask;
}
