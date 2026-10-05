export function zoomAt(camera,factor,x,y) {
  const scale=Math.min(32,Math.max(.01,camera.scale*factor)),ratio=scale/camera.scale;
  return {scale,x:x-(x-camera.x)*ratio,y:y-(y-camera.y)*ratio};
}
export function fitCamera(width,height,viewWidth,viewHeight) {
  const scale=Math.min(Math.max(1,viewWidth-100)/width,Math.max(1,viewHeight-230)/height,1);
  return {scale,x:(viewWidth-width*scale)/2,y:110+(Math.max(1,viewHeight-230)-height*scale)/2};
}
// Trackpads report scroll as wheel deltas and pinch as Ctrl+wheel.
export function wheelCamera(camera,{deltaX=0,deltaY=0,deltaMode=0,ctrlKey=false},x,y,pageHeight=800) {
  const unit=deltaMode===1?16:deltaMode===2?pageHeight:1;
  if(ctrlKey)return zoomAt(camera,Math.exp(-Math.max(-120,Math.min(120,deltaY*unit))*.01),x,y);
  return {...camera,x:camera.x-deltaX*unit,y:camera.y-deltaY*unit};
}
export function panBetween(camera,previous,next) {
  return {...camera,x:camera.x+next.x-previous.x,y:camera.y+next.y-previous.y};
}
