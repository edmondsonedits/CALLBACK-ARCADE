import {SNOW_GAME} from '../upgrades/snow-bash';import {DRAIN_GAME} from '../upgrades/drain-bash';import {JUNGLE_GAME} from '../upgrades/jungle-bash';import {TIE_GAME} from '../upgrades/tie-breaker';import {MANIC_GAME} from '../upgrades/manic-panic';import {RUBBLE_GAME} from '../upgrades/rubble-alliance';import {DRAGON_GAME} from '../upgrades/dragon-drop';import {VOLT_GAME} from '../upgrades/volt-vault';
import type {ArenaGame,ArenaInput,ArenaOptions} from '../upgrades/arena-types';import type {OnlineEngine,OnlineInput} from './types';
interface ArenaState<T> {core:T;ids:string[];options:ArenaOptions}
function adapt<T>(game:ArenaGame<T>):OnlineEngine {return {
 id:game.id,title:game.title,controls:game.controls,
 create(ids,seed,options){const normalized={...game.defaults,...options,players:ids.length} as ArenaOptions;return {core:game.create(ids,seed,normalized),ids:[...ids],options:normalized} satisfies ArenaState<T>},
 step(raw,inputs,bots){const s=raw as ArenaState<T>,frame=game.frame(s.core);const input:Record<string,ArenaInput>={};for(const id of s.ids){if(bots.includes(id)){input[id]=game.bot(s.core,id);continue;}const p=inputs[id];const actor=frame.actors.find(a=>a.id===id);let action=p?.action;if(action==='pickup'&&actor?.carrying)action='throw';const allowed=game.controls.some(c=>c.action===action)||action==='throw';input[id]={sequence:p?.seq??frame.tick+1,x:p?.x??0,y:p?.y??0,action:allowed?action as ArenaInput['action']:'none'};}return {...s,core:game.step(s.core,input)};},
 publicState(raw){const s=raw as ArenaState<T>,frame=game.frame(s.core);return {view:{kind:'arena',frame,options:s.options},finished:frame.finished,winners:frame.winners,scores:Object.fromEntries(frame.actors.map(p=>[p.id,p.score??(frame.winners.includes(p.id)?1:0)]))};},
 }}
export const ARENA_ONLINE_ENGINES:readonly OnlineEngine[]=[adapt(SNOW_GAME),adapt(DRAIN_GAME),adapt(JUNGLE_GAME),adapt(TIE_GAME),adapt(MANIC_GAME),adapt(RUBBLE_GAME),adapt(DRAGON_GAME),adapt(VOLT_GAME)];
export function arenaOnlineInput(input:OnlineInput):ArenaInput{return {sequence:input.seq,x:input.x,y:input.y,action:input.action as ArenaInput['action']}}
