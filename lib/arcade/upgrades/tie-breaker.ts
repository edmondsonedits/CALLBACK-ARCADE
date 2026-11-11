import{createTieBreakerState,stepTieBreaker,type TieBreakerState}from'../practice/games/tie-breaker-engine';
import{createDestructibleFloor,markFloorTile}from'../practice/games/destructible-floor';
import{seededRandom}from'../practice/games/rhythm-engine';
import{ARENA_DEFAULTS,arenaFields,normalizeArenaOptions,type ArenaOptions,type ArenaGame,type ArenaFrame,type ArenaInput}from'./arena-types';
import{combatBotInput,combatActors,combatObjects}from'./combat-common';
export const TIE_ARENAS=[{id:'court',name:'Duellist’s Court',skill:'Win crate control and aim a clean throw in a compact duel.'},{id:'wind',name:'Crosswind Duel',skill:'Read changing crosswinds and lead moving targets.'},{id:'ruins',name:'Broken Crown',skill:'Break the floor with explosives and time jumps between safe tiles.'}]as const;
export interface TieTournament{ids:string[];roster:string[];qualified:string[];pairIndex:number;stage:number;duel:TieBreakerState;options:ArenaOptions;seed:number;tick:number;overtime:number;completedDuels:number;finished:boolean;winners:string[];}
function applyArena(s:TieTournament){s.duel.core.hazardScale=s.options.hazards;for(const p of Object.values(s.duel.core.players))p.health=s.overtime?1:s.options.health;if(s.options.arena==='ruins'){s.duel.core.floor=createDestructibleFloor(7,9,Math.round(60/s.options.hazards));s.duel.core.gapJumping=true}}
function newDuel(s:TieTournament){s.duel=createTieBreakerState(s.roster.slice(s.pairIndex,s.pairIndex+2),s.seed+s.completedDuels*7919+s.overtime*3571);applyArena(s)}
export function createTieTournament(playerIds:string[],seed:number,input:ArenaOptions):TieTournament {
 const options=normalizeArenaOptions(input,TIE_ARENAS);options.duration=Math.min(30,Math.max(15,+input.duration||30));const ids=[...new Set(playerIds)].slice(0,10);if(ids.length<2)throw Error('A duel bracket needs at least two entrants');
 const random=seededRandom(seed),roster=ids.slice(1);for(let i=roster.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[roster[i],roster[j]]=[roster[j]!,roster[i]!]}roster.unshift(ids[0]!);
 const s:TieTournament={ids,roster,qualified:[],pairIndex:0,stage:1,duel:createTieBreakerState(roster.slice(0,2),seed),options,seed,tick:0,overtime:0,completedDuels:0,finished:false,winners:[]};applyArena(s);return s;
}
function qualify(s:TieTournament,winner:string){s.qualified.push(winner);s.completedDuels++;s.overtime=0;s.pairIndex+=2;if(s.pairIndex===s.roster.length-1){s.qualified.push(s.roster[s.pairIndex]!);s.pairIndex++}if(s.pairIndex>=s.roster.length){s.roster=[...s.qualified];s.qualified=[];s.pairIndex=0;s.stage++}if(s.roster.length===1){s.finished=true;s.winners=[s.roster[0]!]}else newDuel(s)}
export function stepTieTournament(s:TieTournament,inputs:Record<string,ArenaInput>):TieTournament {
 if(s.finished)return structuredClone(s);const next=structuredClone(s);next.tick++;
 if(next.options.arena==='wind'&&next.duel.intermissionTicks===0){const wind=Math.cos(next.tick/180*Math.PI)*.05*next.options.hazards;for(const p of Object.values(next.duel.core.players))if(!p.eliminated)p.vx+=wind}
 if(next.overtime){if(next.duel.core.crate)next.duel.core.crate.kind='steel';for(const p of Object.values(next.duel.core.players)){if(p.carriedCrate)p.carriedCrateKind='steel';p.carriedFuseTicks=null}for(const p of next.duel.core.projectiles){p.kind='steel';p.fuseTicks=null}}
 if(next.duel.core.floor&&next.duel.core.tick>90&&next.duel.core.tick%Math.round(90/next.options.hazards)===0){const n=(Math.floor(next.duel.core.tick/30)*11+Math.abs(next.seed))%49;markFloorTile(next.duel.core.floor,-9+(n%7+.5)*18/7,-9+(Math.floor(n/7)+.5)*18/7)}
 if(!next.duel.core.finished&&next.duel.core.tick>=next.options.duration*30){const living=Object.entries(next.duel.core.players).filter(([,p])=>!p.eliminated),top=Math.max(0,...living.map(([,p])=>p.health)),best=living.filter(([,p])=>p.health===top);next.duel.core.finished=true;next.duel.core.winnerId=best.length===1?best[0]![0]:null}
 const priorRound=next.duel.roundNumber;next.duel=stepTieBreaker(next.duel,inputs);if(next.duel.roundNumber!==priorRound)applyArena(next);
 if(next.duel.finished){if(next.duel.winnerId)qualify(next,next.duel.winnerId);else{next.overtime++;newDuel(next)}}return next;
}
export function tieBotInput(s:TieTournament,id:string):ArenaInput {if(!s.duel.core.players[id])return{sequence:s.tick+1,x:0,y:0,action:'none'};return combatBotInput({core:s.duel.core,options:s.options},id)}
export function tieFrame(s:TieTournament):ArenaFrame {
 const active=combatActors(s.duel.core,s.options),theme=s.options.arena==='wind'?{sky:0x183553,floor:0x83b5bd,rim:0x46dbdc}:s.options.arena==='ruins'?{sky:0x231e3d,floor:0xb59a84,rim:0x9c7cff}:{sky:0x172451,floor:0xc6b99b,rim:0xffd84b};
 return{tick:s.tick,remainingSeconds:Math.max(0,s.options.duration-s.duel.core.tick/30),finished:s.finished,winners:s.winners,actors:s.ids.map((id,i)=>active.find(p=>p.id===id)||{id,x:Math.cos(i/10*Math.PI*2)*12,y:Math.sin(i/10*Math.PI*2)*12,alive:false,health:0,maxHealth:s.options.health,benched:s.roster.includes(id)||s.qualified.includes(id)}),objects:combatObjects(s.duel.core),floor:s.duel.core.floor,radius:10,theme,
 status:`${s.ids.length}-entrant bracket · stage ${s.stage} · duel ${s.completedDuels+1} · game ${s.duel.roundNumber}/3`+(s.overtime?' · SUDDEN DEATH: one heart, steel crates':''),skill:TIE_ARENAS.find(a=>a.id===s.options.arena)!.skill};
}
export const TIE_GAME:ArenaGame<TieTournament>={id:'tie-breaker',title:'Tie-Breaker · Crown Gauntlet',summary:'Enter a bracket with up to ten contestants. Two duel at a time in best-of-three matches; every entrant plays. Draws trigger steel-crate sudden death.',arenas:TIE_ARENAS,defaults:{...ARENA_DEFAULTS,arena:'court',duration:30,crowns:1},fields:arenaFields(TIE_ARENAS).map(f=>f.id==='duration'?{...f,label:'Seconds per duel round',min:15,max:30,step:5}:f),create:createTieTournament,step:stepTieTournament,bot:tieBotInput,frame:tieFrame,controls:[{action:'pickup',label:'Grab / Throw',key:'KeyE'},{action:'jump',label:'Jump',key:'Space'},{action:'attack',label:'Shove',key:'KeyQ'}]};
