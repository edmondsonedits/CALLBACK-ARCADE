import {createDrainBashState,stepDrainBash,type DrainBashState} from '../practice/games/drain-bash';
import {ARENA_DEFAULTS,arenaFields,normalizeArenaOptions,type ArenaOptions,type ArenaGame,type ArenaFrame,type ArenaInput} from './arena-types';
import {combatBotInput,combatActors,combatObjects,timedCombatResult} from './combat-common';
export const DRAIN_ARENAS=[
 {id:'junction',name:'Sump Junction',skill:'Learn when to spend Homing, Burst and Sonic charges from mystery crates.'},
 {id:'flood',name:'Floodgate Spiral',skill:'Lead your aim and brake against the circulating flood current.'},
 {id:'echo',name:'Echo Vault',skill:'Bank special projectiles off the vault rim to attack from a new angle.'},
] as const;
const defaults:ArenaOptions={...ARENA_DEFAULTS,arena:'junction'};
export interface DrainMatch{game:DrainBashState;options:ArenaOptions;}
export function createDrainMatch(ids:string[],seed:number,input:ArenaOptions):DrainMatch {const options=normalizeArenaOptions(input,DRAIN_ARENAS),game=createDrainBashState([...new Set(ids)].slice(0,10),seed);game.core.hazardScale=options.hazards;for(const p of Object.values(game.core.players))p.health=options.health;return {game,options}}
export function stepDrainMatch(s:DrainMatch,inputs:Record<string,ArenaInput>):DrainMatch {
 if(s.game.core.finished)return structuredClone(s);const game=structuredClone(s.game),{options}=s;
 if(options.arena==='flood')for(const p of Object.values(game.core.players))if(!p.eliminated){p.vx-=p.y*.018*options.hazards;p.vy+=p.x*.018*options.hazards}
 if(options.arena==='echo')for(const p of game.projectiles){const r=Math.hypot(p.x,p.y),dot=p.x*p.vx+p.y*p.vy;if(r>8.9&&dot>0){const k=2*dot/(r*r);p.vx=(p.vx-k*p.x)*.92;p.vy=(p.vy-k*p.y)*.92}}
 const next=stepDrainBash(game,inputs);if(s.game.mysteryPickup&&!next.mysteryPickup)next.mysteryReadyAtTick=next.core.tick+Math.round(210/options.hazards);timedCombatResult(next.core,options.duration);return {game:next,options};
}
export function drainBotInput(s:DrainMatch,id:string):ArenaInput {
 const p=s.game.core.players[id]!,power=s.game.specials[id]!,base=combatBotInput({core:s.game.core,options:s.options},id);if(p.eliminated)return base;
 const target=Object.entries(s.game.core.players).filter(([key,q])=>key!==id&&!q.eliminated).sort((a,b)=>Math.hypot(a[1].x-p.x,a[1].y-p.y)-Math.hypot(b[1].x-p.x,b[1].y-p.y))[0]?.[1];
 if(power.weapon&&power.ammo>0&&target&&Math.hypot(target.x-p.x,target.y-p.y)<(power.weapon==='homing'?7:3.6))return {...base,action:'special'};
 if((!power.weapon||power.ammo===0)&&s.game.mysteryPickup&&!p.carriedCrate){const q=s.game.mysteryPickup,dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;return {...base,x:dx/len-p.vx*.2,y:dy/len-p.vy*.2,action:len<1.2?'pickup':'none'}}
 return base;
}
export function drainFrame(s:DrainMatch):ArenaFrame {
 const theme=s.options.arena==='flood'?{sky:0x102b3b,floor:0x478d95,rim:0x46dbdc}:s.options.arena==='echo'?{sky:0x211938,floor:0x70608b,rim:0x9c7cff}:{sky:0x142331,floor:0x678b86,rim:0x9dba73};
 const own=s.game.specials[Object.keys(s.game.core.players)[0]!]!;
 return {tick:s.game.core.tick,finished:s.game.core.finished,winners:s.game.core.winnerId?[s.game.core.winnerId]:[],actors:combatActors(s.game.core,s.options),objects:[...combatObjects(s.game.core),
 ...(s.game.mysteryPickup?[{id:'mystery',kind:'power',...s.game.mysteryPickup,color:0x9c7cff,label:'?'}]:[]),
 ...s.game.projectiles.map((p,i)=>({id:'power-shot-'+i,kind:'orb',x:p.x,y:p.y,height:.65,radius:.2,color:p.kind==='homing'?0x9c7cff:0xff6f61})),
 ...s.game.waves.map((w,i)=>({id:'wave-'+i,kind:'wave',x:w.x,y:w.y,radius:w.radius,color:0x46dbdc})),
 ...(s.options.arena==='flood'?[{id:'flow',kind:'wave',x:0,y:0,radius:4,color:0x46dbdc}]:[])],radius:10,theme,
 status:(s.options.arena==='flood'?'Clockwise current · ':s.options.arena==='echo'?'Rim rebounds · ':'Mystery arsenal · ')+(own.weapon?own.weapon.toUpperCase()+' · '+own.ammo+' charges':'Collect a purple mystery crate'),skill:DRAIN_ARENAS.find(a=>a.id===s.options.arena)!.skill};
}
export const DRAIN_GAME:ArenaGame<DrainMatch>={id:'drain-bash',title:'Drain Bash · Sump Siege',summary:'Master a mystery arsenal, ride flood currents and bank shots through the Echo Vault. Custom ten-contestant Crown Cups.',arenas:DRAIN_ARENAS,defaults,fields:arenaFields(DRAIN_ARENAS).map(f=>f.id==='hazards'?{...f,label:'Power intensity'}:f),create:createDrainMatch,step:stepDrainMatch,bot:drainBotInput,frame:drainFrame,
 controls:[{action:'pickup',label:'Grab / Throw',key:'KeyE'},{action:'jump',label:'Jump',key:'Space'},{action:'special',label:'Weapon',key:'KeyF'}]};
