import {toLab, toRGB} from './quantize.mjs';

// Keep perceived lightness (OKLab L), remove color, and preserve transparency.
export function grayscale(pixels) {
  const output=new Uint8ClampedArray(pixels);
  for(let i=0;i<pixels.length;i+=4) {
    if(!pixels[i+3])continue;
    const gray=toRGB([toLab(pixels[i],pixels[i+1],pixels[i+2])[0],0,0])[0];
    output[i]=output[i+1]=output[i+2]=gray;
  }
  return output;
}
