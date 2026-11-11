import {combatBotInput} from './combat-common';
import { createJungleBashState,stepJungleBash,type JungleBashState,type JungleBashInput } from '../practice/games/jungle-bash-simulation';
import {createDestructibleFloor,markFloorTile} from '../practice/games/destructible-floor';
import {ARENA_DEFAULTS,arenaFields,normalizeArenaOptions,type ArenaOptions,type ArenaGame,type ArenaFrame} from './arena-types';
export const SNOW_ARENAS=[
 {id:'palace',name:'Polar Palace',skill:'Bait the sleeping penguin, then jump or brake before it charges.'},
 {id:'crosswind',name:'Crosswind Glacier',skill:'Read the wind reversal and brake against drifting momentum.'},
 {id:'thaw',name:'Thawing Lake',skill:'Leave cracking ice early and plan a safe route through shrinking islands.'},
] as const;
export const SNOW_DEFAULTS:ArenaOptions={...ARENA_DEFAULTS,arena:'palace'};
export interface SnowMatch {core:JungleBashState;options:ArenaOptions;wind:number;}
export function createSnowMatch(playerIds:string[],seed:number,input:ArenaOptions):SnowMatch {
 const options=normalizeArenaOptions(input,SNOW_ARENAS),core=createJungleBashState([...new Set(playerIds)].slice(0,10),seed,'snow-bash');
 core.hazardScale=options.hazards;for(const p of Object.values(core.players))p.health=options.health;
 if(options.arena==='thaw')core.floor=createDestructibleFloor(7,9,60);
 return {core,options,wind:0};
}
export function stepSnowMatch(state:SnowMatch,inputs:Record<string,JungleBashInput>):SnowMatch {
 if(state.core.finished)return structuredClone(state);
 const core=structuredClone(state.core),{options}=state;
 const wind=options.arena==='crosswind'?Math.sin(core.tick/180*Math.PI)*options.hazards*.06:0;
 for(const p of Object.values(core.players))if(!p.eliminated)p.vx+=wind;
 if(core.penguin&&core.penguin.state==='active'){
  const target=Object.values(core.players).filter(p=>!p.eliminated).sort((a,b)=>Math.hypot(a.x-core.penguin!.x,a.y-core.penguin!.y)-Math.hypot(b.x-core.penguin!.x,b.y-core.penguin!.y))[0];
  if(target){const dx=target.x-core.penguin.x,dy=target.y-core.penguin.y,d=Math.hypot(dx,dy);if(d>0){const travel=Math.min(d,2.8/30*Math.abs(options.hazards-1))*Math.sign(options.hazards-1);core.penguin.x+=dx/d*travel;core.penguin.y+=dy/d*travel}}
 }
 if(core.floor&&core.tick>90&&core.tick%Math.max(15,Math.round(60/options.hazards))===0){
  const floor=core.floor,index=(Math.floor(core.tick/Math.max(15,Math.round(60/options.hazards)))*17+core.seed)%floor.tiles.length;
  const size=floor.halfExtent*2/floor.size;
  markFloorTile(floor,-floor.halfExtent+(index%floor.size+.5)*size,-floor.halfExtent+(Math.floor(index/floor.size)+.5)*size);
 }
 const next=stepJungleBash(core,inputs);
 if(!next.finished&&next.tick>=options.duration*30){
  const alive=Object.entries(next.players).filter(([,p])=>!p.eliminated),health=Math.max(0,...alive.map(([,p])=>p.health));
  const leaders=alive.filter(([,p])=>p.health===health);next.finished=true;next.winnerId=leaders.length===1?leaders[0]![0]:null;
 }
 return {core:next,options,wind};
}
export const snowBotInput=(s:SnowMatch,id:string):JungleBashInput=>combatBotInput(s,id);
export function snowFrame(s:SnowMatch):ArenaFrame {
 const p=s.core.penguin!,theme=s.options.arena==='crosswind'?{sky:0x172451,floor:0xb3def5,rim:0x46dbdc}:s.options.arena==='thaw'?{sky:0x172c48,floor:0xbedbe8,rim:0x65baf0}:{sky:0x121a3b,floor:0xdaeaf3,rim:0xa2c4f2};
 return {tick:s.core.tick,finished:s.core.finished,winners:s.core.winnerId?[s.core.winnerId]:[],radius:10,theme,floor:s.core.floor,
 actors:Object.entries(s.core.players).map(([id,p])=>({id,x:p.x,y:p.y,height:p.jumpTicks?Math.sin(Math.PI*p.jumpTicks/19)*1.4:0,alive:!p.eliminated,health:p.health,maxHealth:s.options.health,carrying:p.carriedCrateKind,invulnerable:p.invulnerableTicks>0,heading:Math.atan2(p.facingX,p.facingY)})),
 objects:[{id:'penguin',kind:'penguin',x:p.x,y:p.y,radius:.9,warning:p.state==='warning'||p.state==='active',label:p.state.toUpperCase()},
 ...(s.core.crate?[{id:'crate',kind:'crate',x:s.core.crate.x,y:s.core.crate.y,color:s.core.crate.kind==='steel'?0x8fabc6:0xff6f61}]:[]),
 ...(s.core.healingFruit?[{id:'fruit',kind:'fruit',...s.core.healingFruit,color:0xff6f61}]:[]),
 ...s.core.projectiles.map((q,i)=>({id:'shot-'+i,kind:'crate',x:q.x,y:q.y,height:.6,color:q.kind==='steel'?0x8fabc6:0xff6f61,warning:q.kind!=='steel'}))],
 status:s.options.arena==='crosswind'?`Wind ${s.wind<0?'←':'→'} · reversal every 6 seconds`:s.options.arena==='thaw'?'Cracking ice will collapse · keep an escape route':`Penguin ${p.state} · grab a crate and aim before throwing`,
 skill:SNOW_ARENAS.find(a=>a.id===s.options.arena)!.skill};
}
export const SNOW_GAME:ArenaGame<SnowMatch>={id:'snow-bash',title:'Snow Bash · Polar Panic',summary:'Crates, slippery ice and one very grumpy penguin. Learn three arenas and compete in a custom Crown Cup.',arenas:SNOW_ARENAS,defaults:SNOW_DEFAULTS,fields:arenaFields(SNOW_ARENAS),create:createSnowMatch,step:stepSnowMatch,bot:snowBotInput,frame:snowFrame,
 controls:[{action:'pickup',label:'Grab / Throw',key:'KeyE'},{action:'jump',label:'Jump',key:'Space'},{action:'attack',label:'Shove',key:'KeyQ'}]};
