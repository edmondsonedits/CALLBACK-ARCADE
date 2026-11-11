"use client";
import {useEffect,useState} from 'react';
import type {FishFinaleSnapshot} from '../../../lib/arcade/fish-finale';
import {stableHash} from '../../../lib/game/random';
import {drawSwimmingFish} from '../../../lib/fish-art';
type Asset={id:string;kind:'fish'|'scenery';url:string;artistName:string;participantId:string;scale?:number;placement:{x:number;y:number;layer:string}};
export type ReturningArt=Asset & {raster:HTMLCanvasElement};
export function useReturningArt(code:string){
 const [art,setArt]=useState<ReturningArt[]>([]);
 useEffect(()=>{let live=true;const cache=new Map<string,HTMLCanvasElement>();let pending=false;
  const refresh=async()=>{if(pending)return;pending=true;try{const r=await fetch(`/api/rooms/${code}/creations`,{cache:'no-store'});if(!r.ok)return;const data=await r.json() as {assets:Asset[]};const fishCount=new Map<string,number>();const assets=data.assets.filter(a=>{if(a.kind==='scenery')return true;const n=fishCount.get(a.participantId)??0;fishCount.set(a.participantId,n+1);return n<3;}).slice(0,80);const next:ReturningArt[]=[];
   for(const a of assets){if(!live)break;let raster=cache.get(a.url);if(!raster){raster=await new Promise<HTMLCanvasElement|undefined>(resolve=>{const img=new Image();const timer=setTimeout(()=>resolve(undefined),5000);img.onload=()=>{clearTimeout(timer);const c=document.createElement('canvas');c.width=256;c.height=Math.max(1,Math.round(256*img.naturalHeight/img.naturalWidth));c.getContext('2d')?.drawImage(img,0,0,c.width,c.height);resolve(c);};img.onerror=()=>{clearTimeout(timer);resolve(undefined);};img.src=a.url;});if(raster)cache.set(a.url,raster);}if(raster)next.push({...a,raster});}
   const keep=new Set(assets.map(a=>a.url));for(const key of cache.keys())if(!keep.has(key))cache.delete(key);if(live)setArt(next);
  }catch{/* A missing collection never interrupts the game. */}finally{pending=false;}};
  const changed=()=>void refresh();window.addEventListener('callback:creations-changed',changed);void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>{live=false;window.removeEventListener('callback:creations-changed',changed);clearInterval(timer);cache.clear();};
 },[code]);return art;
}
export function drawReturningArt(ctx:CanvasRenderingContext2D,assets:ReturningArt[],snapshot:FishFinaleSnapshot,elapsed:number,width:number,height:number,reduced:boolean){
 ctx.save();for(const a of assets.filter(a=>a.kind==='scenery')){const w=width*.08*(a.scale??1);const h=Math.min(height*.12*(a.scale??1),w*a.raster.height/a.raster.width);ctx.globalAlpha=['cinematic','reveal','voting'].includes(snapshot.phase)?.35:.85;ctx.drawImage(a.raster,a.placement.x*width-w/2,a.placement.y*height-h/2,w,h);}ctx.globalAlpha=1;
 if(['tutorial','drawing','grace'].includes(snapshot.phase)&&elapsed>=15000){const fish=assets.filter(a=>a.kind==='fish');const owners=[...new Set(fish.map(a=>a.participantId))].sort((a,b)=>stableHash(`${snapshot.matchId}:${a}`)-stableHash(`${snapshot.matchId}:${b}`));const slot=Math.floor((elapsed-15000)/27000),within=(elapsed-15000)%27000;const owner=owners[slot%owners.length];const options=fish.filter(a=>a.participantId===owner),guest=options[Math.floor(slot/Math.max(1,owners.length))%options.length];if(guest&&within<6500){const w=width*.13,h=w*guest.raster.height/guest.raster.width,x=reduced?width*.45:width*(1.1-within/6500*1.3);drawSwimmingFish(ctx,guest.raster,elapsed/1000,{x,y:height*.27,width:w,height:h,reducedMotion:reduced});ctx.fillStyle='#fff4d6';ctx.font=`${Math.max(10,width*.012)}px sans-serif`;ctx.textAlign='center';ctx.fillText(`From ${guest.artistName}’s previous aquarium`,x+w/2,height*.27+h+15);}}
 ctx.restore();
}
