import type {JungleBashState,JungleBashInput} from '../practice/games/jungle-bash-simulation';
import {tileIndexAt} from '../practice/games/destructible-floor';
import type {ArenaOptions,ArenaActor,ArenaObject} from './arena-types';
export interface CombatView{core:JungleBashState;options:ArenaOptions}
function safeFloor(s:CombatView,x:number,y:number):boolean {
 if(Math.hypot(x,y)>8.8)return false;
 if(!s.core.floor)return true;
 const i=tileIndexAt(s.core.floor,x,y);return i!==null&&s.core.floor.tiles[i]?.state==='safe';
}
export function combatBotInput(s:CombatView,id:string):JungleBashInput {
 const p=s.core.players[id]!;if(p.eliminated)return {sequence:s.core.tick+1,x:0,y:0,action:'none'};
 const cfg=s.options.difficulty,accuracy=cfg==='hard'?1:cfg==='easy'?.68:.86;
 const nearest=Object.entries(s.core.players).filter(([key,q])=>key!==id&&!q.eliminated).sort((a,b)=>Math.hypot(a[1].x-p.x,a[1].y-p.y)-Math.hypot(b[1].x-p.x,b[1].y-p.y))[0]?.[1];
 let target:{x:number;y:number}=s.core.crate&&!p.carriedCrate?s.core.crate:nearest||{x:0,y:0};
 if(p.health<s.options.health&&s.core.healingFruit)target=s.core.healingFruit;
 let dx=target.x-p.x,dy=target.y-p.y,action:JungleBashInput['action']='none';
 const penguin=s.core.penguin,threat=!!penguin&&penguin.state==='active'&&Math.hypot(penguin.x-p.x,penguin.y-p.y)<2.4;
 if(threat){dx=p.x-penguin!.x;dy=p.y-penguin!.y;action='jump'}
 else if(p.carriedCrate&&nearest&&Math.hypot(nearest.x-p.x,nearest.y-p.y)<6){dx=nearest.x+nearest.vx*.35*accuracy-p.x;dy=nearest.y+nearest.vy*.35*accuracy-p.y;action='throw'}
 else if(!p.carriedCrate&&s.core.crate&&Math.hypot(s.core.crate.x-p.x,s.core.crate.y-p.y)<1.2)action='pickup';
 else if(nearest&&Math.hypot(nearest.x-p.x,nearest.y-p.y)<1.3)action='attack';
 const length=Math.hypot(dx,dy)||1;let x=dx/length*accuracy-p.vx*.24,y=dy/length*accuracy-p.vy*.24;
 if(action==='throw'){x=dx/length;y=dy/length}
 if(!safeFloor(s,p.x+p.vx*.5+x*1.5,p.y+p.vy*.5+y*1.5)){
  let best=-Infinity,bx=0,by=0;
  for(let n=0;n<16;n++){const a=n*Math.PI/8,cx=Math.cos(a),cy=Math.sin(a),tx=p.x+cx*2,ty=p.y+cy*2;if(!safeFloor(s,tx,ty))continue;const score=-((tx-target.x)**2+(ty-target.y)**2);if(score>best){best=score;bx=cx;by=cy}}
  x=bx-p.vx*.35;y=by-p.vy*.35;if(action==='throw')action='none';
 }
 return {sequence:s.core.tick+1,x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y)),action};
}

export function combatActors(core:JungleBashState,options:ArenaOptions):ArenaActor[]{return Object.entries(core.players).map(([id,p])=>({id,x:p.x,y:p.y,height:p.jumpTicks?Math.sin(Math.PI*p.jumpTicks/19)*1.4:0,alive:!p.eliminated,health:p.health,maxHealth:options.health,carrying:p.carriedCrateKind,invulnerable:p.invulnerableTicks>0,heading:Math.atan2(p.facingX,p.facingY)}))}
export function combatObjects(core:JungleBashState):ArenaObject[]{return [...(core.crate?[{id:'crate',kind:'crate',x:core.crate.x,y:core.crate.y,color:core.crate.kind==='steel'?0x8fabc6:0xff6f61,warning:core.crate.kind!=='steel'}]:[]),...(core.healingFruit?[{id:'fruit',kind:'fruit',...core.healingFruit,color:0xff6f61}]:[]),...core.projectiles.map((q,i)=>({id:'crate-shot-'+i,kind:'crate',x:q.x,y:q.y,height:.6,color:q.kind==='steel'?0x8fabc6:0xff6f61,warning:q.kind!=='steel'}))]}
export function timedCombatResult(core:JungleBashState,duration:number){if(!core.finished&&core.tick>=duration*30){const alive=Object.entries(core.players).filter(([,p])=>!p.eliminated),top=Math.max(0,...alive.map(([,p])=>p.health)),winners=alive.filter(([,p])=>p.health===top);core.finished=true;core.winnerId=winners.length===1?winners[0]![0]:null}}
