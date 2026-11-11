export interface RenderFighter {id:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;alive:boolean;[key:string]:unknown}
export function interpolatePartyFighters(previous:RenderFighter[],current:RenderFighter[],alpha:number,extrapolationMs:number):RenderFighter[]{
 const t=Math.max(0,Math.min(1,alpha)),dt=Math.max(0,Math.min(33,extrapolationMs))/1000;
 return current.map(f=>{const old=previous.find(p=>p.id===f.id);if(!old||!f.alive||old.alive!==f.alive||Math.hypot(f.x-old.x,f.z-old.z)>3)return {...f};return {...f,x:old.x+(f.x-old.x)*t+f.vx*dt,y:old.y+(f.y-old.y)*t+f.vy*dt,z:old.z+(f.z-old.z)*t+f.vz*dt};});
}
