import { clamp, type SharkPose } from "../../../lib/fish-motion";
import { sampleFishFragments } from "../../../lib/fish-particles";

/** Tiles retain the artist's colors/alpha; no derived image asset is created. */
export function drawFishBurst(ctx:CanvasRenderingContext2D,image:HTMLImageElement,seed:string,ageMs:number,x:number,y:number,width:number,height:number,bounds={x:0,y:0,width:1,height:1}):number {
 width*=bounds.width;height*=bounds.height;
 const pieces=sampleFishFragments(seed,ageMs);let visible=0;
 for(const p of pieces){
  if(p.opacity<.015)continue;visible++;
  const w=width*p.width*p.scale,h=height*p.height*p.scale;
  ctx.save();ctx.translate(x+p.x*width,y+p.y*width);ctx.rotate(p.rotation);ctx.globalAlpha=p.opacity;
  const b=p.bevel;ctx.beginPath();ctx.moveTo(-w*.5+b*w,-h*.5);ctx.lineTo(w*.5,-h*.5+b*h);ctx.lineTo(w*.5-b*w,h*.5);ctx.lineTo(-w*.5,h*.5-b*h);ctx.closePath();ctx.clip();
  ctx.drawImage(image,(bounds.x+p.u*bounds.width)*image.naturalWidth,(bounds.y+p.v*bounds.height)*image.naturalHeight,p.width*bounds.width*image.naturalWidth,p.height*bounds.height*image.naturalHeight,-w*.5,-h*.5,w,h);ctx.restore();
 }
 if(ageMs>=0&&ageMs<700){
  const t=ageMs/700;ctx.save();ctx.globalAlpha=(1-t)*(1-t);ctx.strokeStyle="rgba(204,255,245,.75)";ctx.lineWidth=1.8;
  ctx.beginPath();ctx.ellipse(x,y,width*(.12+t*.65),width*(.07+t*.34),0,0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 return visible;
}

export function drawSharkWake(ctx:CanvasRenderingContext2D,shark:SharkPose,width:number,height:number,time:number){
 const unit=shark.size*width;ctx.save();ctx.translate(shark.x*width,shark.y*height);ctx.rotate(shark.pitch);ctx.scale(shark.facing*Math.max(.45,shark.yaw),1);ctx.globalAlpha=shark.opacity;
 for(let i=0;i<10;i++){const t=(time*.7+i*.137)%1;ctx.strokeStyle=`rgba(194,243,243,${(1-t)*.22})`;ctx.lineWidth=1;ctx.beginPath();ctx.arc((-1.45-t*1.5)*unit,(Math.sin(i*2.4+time)*.17-t*.12)*unit,(.015+t*.035)*unit,0,Math.PI*2);ctx.stroke();}
 for(let i=-1;i<=1;i++){ctx.strokeStyle="rgba(177,232,237,.12)";ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-1.15*unit,i*.11*unit);ctx.quadraticCurveTo(-1.9*unit,(i*.16+Math.sin(time*4+i)*.05)*unit,-2.65*unit,i*.21*unit);ctx.stroke();}
 ctx.restore();
}

export function drawFishRelease(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,age:number){
 if(age<0||age>1.2)return;const t=age/1.2;
 ctx.save();ctx.globalAlpha=clamp(1-t)*.55;ctx.strokeStyle="#c8f4de";ctx.lineWidth=1.2;
 for(let i=0;i<8;i++){const a=i*2.39996,r=size*(.18+t*.5);ctx.beginPath();ctx.arc(x+Math.cos(a)*r,y+Math.sin(a)*r*.55-t*size*.2,2+(i%3),0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
