import type { JungleBashInput } from '../practice/games/jungle-bash-simulation';
export type ArenaInput = JungleBashInput;
export type ArenaOptions = {
 arena:string;players:number;difficulty:'easy'|'normal'|'hard';duration:number;crowns:number;
 health:number;pace:number;hazards:number;seed:number;name:string;sound:boolean;graphics:string;haptics:boolean;
};
export interface ArenaActor { id:string;x:number;y:number;height?:number;heading?:number;alive:boolean;health:number;maxHealth:number;score?:number;carrying?:string|null;invulnerable?:boolean;benched?:boolean;mounted?:boolean; }
export interface ArenaObject { id:string;kind:string;x:number;y:number;height?:number;radius?:number;color?:number;warning?:boolean;label?:string; }
export interface ArenaFrame {
 tick:number;finished:boolean;winners:string[];actors:ArenaActor[];objects:ArenaObject[];remainingSeconds?:number;
 floor?:{size:number;halfExtent:number;tiles:{state:string;ticksRemaining:number}[]}|null;
 bounds?:{x:number;y:number};
 radius:number;theme:{sky:number;floor:number;rim:number};status:string;skill:string;
}
export interface ArenaGame<State> {
 id:string;title:string;summary:string;arenas:readonly {id:string;name:string;skill:string}[];
 defaults:ArenaOptions;fields:readonly Record<string,unknown>[];
 create(ids:string[],seed:number,options:ArenaOptions):State;
 step(state:State,inputs:Record<string,ArenaInput>):State;
 bot(state:State,id:string):ArenaInput;frame(state:State):ArenaFrame;
 controls:readonly {action:string;label:string;key:string}[];
}
export const ARENA_DEFAULTS:ArenaOptions={arena:'classic',players:6,difficulty:'normal',duration:60,crowns:3,health:3,pace:1,hazards:1,seed:712,name:'YOU',sound:false,graphics:'balanced',haptics:false};
export function arenaFields(arenas:readonly {id:string;name:string}[]):Record<string,unknown>[] {return [
 {id:'arena',label:'Arena',choices:arenas.map(m=>({value:m.id,label:m.name}))},
 {id:'players',label:'Contestants (all bots in Watch mode)',min:2,max:10,step:1},
 {id:'difficulty',label:'Bot skill',choices:['easy','normal','hard'].map(value=>({value,label:value[0]!.toUpperCase()+value.slice(1)}))},
 {id:'duration',label:'Round seconds',min:30,max:90,step:15},
 {id:'crowns',label:'Crowns to win',min:1,max:7,step:1},
 {id:'health',label:'Starting hearts',min:1,max:3,step:1},
 {id:'pace',label:'Game speed',min:.75,max:1.25,step:.05},
 {id:'hazards',label:'Hazard intensity',min:.5,max:1.5,step:.1},
 {id:'seed',label:'Arena seed',min:1,max:999999,step:1},
 {id:'name',label:'Your name',type:'text'},
 {id:'sound',label:'Sound effects',type:'checkbox'},
 {id:'haptics',label:'Touch vibration',type:'checkbox'},
 {id:'graphics',label:'Graphics',choices:['performance','balanced','quality'].map(value=>({value,label:value}))},
]}
export function normalizeArenaOptions(input:ArenaOptions,arenas:readonly {id:string}[]):ArenaOptions {
 const number=(value:number,fallback:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(+value)?+value:fallback));
 return {...ARENA_DEFAULTS,...input,arena:arenas.some(a=>a.id===input.arena)?input.arena:arenas[0]!.id,
 players:Math.round(number(input.players,6,2,10)),duration:number(input.duration,60,30,90),crowns:Math.round(number(input.crowns,3,1,7)),
 health:Math.round(number(input.health,3,1,3)),pace:number(input.pace,1,.75,1.25),hazards:number(input.hazards,1,.5,1.5),
 seed:Math.round(number(input.seed,712,1,999999)),difficulty:['easy','normal','hard'].includes(input.difficulty)?input.difficulty:'normal',
 name:String(input.name||'YOU').replace(/[<>]/g,'').slice(0,20)};
}
export const botNames=['YOU','RUFUS','MABEL','GREGOR','PIP','BEA','OSWALD','TILLY','BARNABY','WREN'];
