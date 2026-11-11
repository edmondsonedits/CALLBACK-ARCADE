import { Sim, FIXED_DT, MAP_ORDER, normalizeOpts, deriveSeed, cupOrder, newCup, scoreStage, isFinalStage, standings, champions, rankMatch, type SumoCup, type SumoEvent, type SumoRank } from "../arcade/online/sumo-core.mjs";
import { persistSumoSim, restoreSumoSim, type PackedSumoSim } from "../arcade/online/sumo-codec";
import { partyResultEventKey } from "./protocol";
import type { PartyControlMessage, PartyInputMessage, PartyRole } from "./protocol";

export type PartyPhase="LOBBY"|"COUNTDOWN"|"PLAYING"|"RESULTS";
export interface PartySeat {id:string;name:string;memberId:string|null;connected:boolean;disconnectedAt:number|null}
export interface PartyInput {seq:number;x:number;y:number;bashDown:boolean;dash:boolean;receivedAt:number}
export interface PartyResult {v:1;partyId:string;roomCode:string;matchId:string;epoch:number;eventKey:string;winners:string[];scores:Record<string,number>;round:number}
export interface SumoParty {
 version:1;partyId:string;roomCode:string;matchId:string;epoch:number;tick:number;phase:PartyPhase;paused:boolean;pauseReason:string|null;
 phaseEndsAt:number|null;startedAt:number|null;updatedAt:number;sessionExpiresAt:number;displayAttachedAt:number|null;displayLastSeenAt:number|null;
 roster:PartySeat[];activeIds?:string[];botEnabled?:Record<string,boolean>;botIds:string[];options:Record<string,unknown>;mode:"quick"|"cup";seed:number;simulation:PackedSumoSim|null;liveSimulation:Sim|null;cup:SumoCup|null;
 inputs:Record<string,PartyInput>;lastSequences:Record<string,number>;controlSequences:Record<string,number>;connectedActors:Record<string,string>;
 events:SumoEvent[];lastResult:PartyResult|null;resultOutbox:PartyResult[];lastCheckpointAt:number;
}
export interface CreateSumoPartyInput {partyId:string;roomCode:string;matchId:string;roster:Array<{id:string;name:string;memberId:string}>;options?:Record<string,unknown>;now:number;seed?:number}
const neutral=(seq:number,now:number):PartyInput=>({seq,x:0,y:0,bashDown:false,dash:false,receivedAt:now});
export const activeSumoSeats=(party:SumoParty)=>party.roster.filter(s=>!party.activeIds||party.activeIds.includes(s.id));
function assertText(value:string,max:number){if(!value||value.length>max)throw new Error("PARTY_PREPARE_INVALID")}
function buildSim(party:SumoParty,map:string,seed:number):Sim{
 const options=normalizeOpts({...party.options,map,fighters:activeSumoSeats(party).length,seed,winTarget:party.mode==="cup"?1:Number(party.options.winTarget??2),slots:activeSumoSeats(party).map((seat,i)=>({owner:seat.memberId===null?"bot":"remote",name:seat.name,style:i}))});
 const sim=new Sim(options);sim.startMatch();return sim;
}
export function createSumoParty(input:CreateSumoPartyInput):SumoParty{
 assertText(input.partyId,80);if(!/^[A-Z0-9]{4,8}$/u.test(input.roomCode))throw new Error("PARTY_PREPARE_INVALID");assertText(input.matchId,120);
 if(!Array.isArray(input.roster)||input.roster.length>10||new Set(input.roster.map(x=>x.id)).size!==input.roster.length||new Set(input.roster.map(x=>x.memberId)).size!==input.roster.length)throw new Error("PARTY_ROSTER_INVALID");
 const ids=Array.from({length:10},(_,i)=>String(i).padStart(2,"0")),source=new Map(input.roster.map(seat=>[seat.id,seat]));
 const roster=ids.map(id=>{const s=source.get(id);if(s){if(typeof s.name!=="string"||!s.name.trim()||s.name.length>40||typeof s.memberId!=="string"||!s.memberId||s.memberId.length>120)throw new Error("PARTY_ROSTER_INVALID");return {id,name:s.name.trim(),memberId:s.memberId,connected:false,disconnectedAt:input.now}}return {id,name:`P${Number(id)+1}`,memberId:null,connected:false,disconnectedAt:null}});
 const seed=(input.seed??0x51a70)>>>0,opts={...(input.options??{})},mode=opts.mode==="cup"?"cup":"quick";
 return {version:1,partyId:input.partyId,roomCode:input.roomCode,matchId:input.matchId,epoch:0,tick:0,phase:"LOBBY",paused:false,pauseReason:null,phaseEndsAt:null,startedAt:null,updatedAt:input.now,sessionExpiresAt:input.now+20*60_000,displayAttachedAt:null,displayLastSeenAt:null,roster,botIds:roster.filter(s=>s.memberId===null).map(s=>s.id),options:opts,mode,seed,simulation:null,liveSimulation:null,cup:null,inputs:Object.fromEntries(ids.map(id=>[id,neutral(-1,input.now)])),lastSequences:{},controlSequences:{},connectedActors:{},events:[],lastResult:null,resultOutbox:[],lastCheckpointAt:input.now};
}
export function setPartySeatConnection(party:SumoParty,memberId:string,connected:boolean,now:number,actorId?:string):void{
 const seat=party.roster.find(x=>x.memberId===memberId);if(!seat)return;seat.connected=connected;seat.disconnectedAt=connected?null:now;
 if(connected&&actorId)party.connectedActors[memberId]=actorId;else if(!connected)delete party.connectedActors[memberId];
}
export function acceptPartyInput(party:SumoParty,memberId:string,msg:PartyInputMessage,now:number):boolean{
 if(party.phase!=="PLAYING"||party.paused||msg.epoch!==party.epoch)return false;
 const seat=party.roster.find(x=>x.memberId===memberId);if(!seat||party.connectedActors[memberId]===undefined&&seat.connected===false)return false;
 if(msg.seq<=(party.lastSequences[seat.id]??-1))return false;
 party.lastSequences[seat.id]=msg.seq;party.inputs[seat.id]={seq:msg.seq,x:Math.max(-1,Math.min(1,msg.x)),y:Math.max(-1,Math.min(1,msg.y)),bashDown:msg.bashDown,dash:msg.dash,receivedAt:now};return true;
}
export function controlSumoParty(party:SumoParty,role:PartyRole,msg:Pick<PartyControlMessage,"operation"|"seq"|"epoch"|"seatId"|"enabled">,now:number):{ok:boolean;reason?:string}{
 if(role!=="host")return {ok:false,reason:"PARTY_ROLE_FORBIDDEN"};if(msg.epoch!==party.epoch)return {ok:false,reason:"PARTY_STALE_EPOCH"};
 const prior=party.controlSequences.host??-1;if(msg.seq<=prior)return {ok:false,reason:"PARTY_DUPLICATE_ACTION"};party.controlSequences.host=msg.seq;
 if(msg.operation==="bot"){if(party.phase!=="LOBBY"&&party.phase!=="RESULTS")return {ok:false,reason:"PARTY_PHASE_INVALID"};const seat=party.roster.find(s=>s.id===msg.seatId);if(!seat||seat.memberId!==null||typeof msg.enabled!=="boolean")return {ok:false,reason:"PARTY_BOT_INVALID"};party.botEnabled={...party.botEnabled,[seat.id]:msg.enabled};return {ok:true};}
 if(msg.operation==="start"){
   if(party.pauseReason==="pilot-session-expired")return {ok:false,reason:"PARTY_SESSION_EXPIRED"};if(party.phase!=="LOBBY"&&party.phase!=="RESULTS")return {ok:false,reason:"PARTY_PHASE_INVALID"};if(party.resultOutbox.length>=32)return {ok:false,reason:"PARTY_RESULT_BACKLOG"};
   const active=party.roster.filter(s=>s.memberId!==null||party.botEnabled?.[s.id]!==false);if(active.length<2)return {ok:false,reason:"PARTY_NOT_ENOUGH_PLAYERS"};party.activeIds=active.map(s=>s.id);
   party.epoch++;party.tick=0;party.events=[];party.simulation=null;party.liveSimulation=null;party.cup=null;party.paused=false;party.pauseReason=null;party.startedAt=now+3_000;party.phaseEndsAt=party.startedAt;party.phase="COUNTDOWN";party.lastSequences={};party.inputs=Object.fromEntries(party.roster.map(s=>[s.id,neutral(-1,now)]));
  if(party.mode==="cup"){const opts=normalizeOpts({...party.options,fighters:activeSumoSeats(party).length});party.cup=newCup({order:cupOrder(String(opts.map),MAP_ORDER),n:activeSumoSeats(party).length,players:activeSumoSeats(party).filter(s=>s.memberId).length,base:opts,seed:party.seed})}return {ok:true};
 }
 if(msg.operation==="pause"){
  if(party.phase!=="PLAYING"||party.paused)return {ok:false,reason:"PARTY_PHASE_INVALID"};party.paused=true;party.pauseReason="host";party.epoch++;party.inputs=Object.fromEntries(party.roster.map(s=>[s.id,neutral(party.inputs[s.id]?.seq??-1,now)]));return {ok:true};
 }
 if(msg.operation==="resume"){
  if(party.phase!=="PLAYING"||!party.paused)return {ok:false,reason:"PARTY_PHASE_INVALID"};party.paused=false;party.pauseReason=null;party.displayLastSeenAt=now;party.epoch++;party.inputs=Object.fromEntries(party.roster.map(s=>[s.id,neutral(-1,now)]));party.lastSequences={};return {ok:true};
 }
 if(msg.operation==="lobby"){
   if(party.phase==="LOBBY")return {ok:false,reason:"PARTY_PHASE_INVALID"};party.phase="LOBBY";party.activeIds=undefined;party.paused=false;party.pauseReason=null;party.epoch++;party.phaseEndsAt=null;party.startedAt=null;party.simulation=null;party.liveSimulation=null;party.cup=null;party.events=[];return {ok:true};
 }
 return {ok:false,reason:"PARTY_CONTROL_INVALID"};
}
function acceptInputsIntoSim(party:SumoParty,sim:Sim,now:number):void{
 activeSumoSeats(party).forEach((seat,i)=>{
  const bot=party.botIds.includes(seat.id)||(seat.disconnectedAt!==null&&now-seat.disconnectedAt>=60_000);
  sim.setOwner(i,bot?"bot":"remote");const command=party.inputs[seat.id]??neutral(-1,now),fresh=now-command.receivedAt<=200,input=sim.inputs[i];
  input.mx=fresh?command.x:0;input.mz=fresh?command.y:0;if(Math.hypot(input.mx,input.mz)>1){const m=Math.hypot(input.mx,input.mz);input.mx/=m;input.mz/=m;}
  input.bashDown=fresh&&command.bashDown;input.bashPower=-1;input.dash=false;
  const fighter=sim.fighters[i] as unknown as Record<string,unknown>|undefined,lastPartySeq=Number(fighter?.lastPartySeq??-1);
  if(fresh&&command.seq>lastPartySeq){if(command.dash)input.dash=true;if(fighter)fighter.lastPartySeq=command.seq;}
 });
}
function makeResult(party:SumoParty,sim:Sim):PartyResult{
 const rank=party.cup?standings(party.cup):rankMatch({winner:sim.matchWinner,n:sim.n,crowns:sim.crowns,stats:sim.stats});
 const winIds=party.cup?champions(party.cup):sim.matchWinner>=0?[sim.matchWinner]:[];
 const winners=winIds.map(i=>activeSumoSeats(party)[i]!.id),scores=Object.fromEntries(activeSumoSeats(party).map((s,i)=>[s.id,party.cup?party.cup.total[i]:sim.crowns[i]]));
 void rank;return {v:1,partyId:party.partyId,roomCode:party.roomCode,matchId:party.matchId,epoch:party.epoch,eventKey:partyResultEventKey(party.partyId,party.matchId,party.epoch),winners,scores,round:sim.round};
}
export function stepSumoParty(party:SumoParty,now:number):void{
 party.updatedAt=now;if(party.pauseReason==="pilot-session-expired")return;party.tick++;
 if(now>=party.sessionExpiresAt){if(party.phase!=="RESULTS"){party.phase="LOBBY";party.startedAt=null;party.liveSimulation=null;party.simulation=null;party.cup=null;party.events=[]}party.paused=true;party.pauseReason="pilot-session-expired";party.epoch++;party.phaseEndsAt=null;party.inputs=Object.fromEntries(party.roster.map(s=>[s.id,neutral(party.inputs[s.id]?.seq??-1,now)]));return;}
 for(const seat of party.roster){const input=party.inputs[seat.id];if(input&&now-input.receivedAt>200)party.inputs[seat.id]=neutral(input.seq,now);}
 for(const seat of party.roster)if(seat.disconnectedAt!==null&&now-seat.disconnectedAt>=60_000&&!party.botIds.includes(seat.id)){party.botIds.push(seat.id);party.inputs[seat.id]=neutral(party.inputs[seat.id]?.seq??-1,now);const index=activeSumoSeats(party).findIndex(s=>s.id===seat.id);if(index>=0)party.liveSimulation?.setOwner(index,"bot");}
 if(party.phase==="PLAYING"&&!party.paused&&party.displayAttachedAt!==null&&now-(party.displayLastSeenAt??party.displayAttachedAt)>2_000){party.paused=true;party.pauseReason="display-disconnected";party.epoch++;party.inputs=Object.fromEntries(party.roster.map(s=>[s.id,neutral(party.inputs[s.id]?.seq??-1,now)]));}
 if(party.phase==="COUNTDOWN"&&party.startedAt!==null&&now>=party.startedAt){
  const stage=party.cup?.stage??0,map=party.cup?.order[stage]??String(party.options.map??"keep"),seed=stage===0?party.seed:deriveSeed(party.seed,stage);const sim=buildSim(party,map,seed);party.events.push(...sim.drain());party.liveSimulation=sim;party.simulation=persistSumoSim(sim);party.phase="PLAYING";party.startedAt=null;party.phaseEndsAt=null;party.displayLastSeenAt=now;
 }
 if(party.phase!=="PLAYING"||party.paused||!party.liveSimulation)return;
 const sim=party.liveSimulation;acceptInputsIntoSim(party,sim,now);
 for(let i=0;i<2;i++)sim.step(FIXED_DT);
 party.events=sim.drain();
 if(sim.phase==="matchend"){
  if(party.cup){scoreStage(party.cup,{winner:sim.matchWinner,stats:sim.stats,n:sim.n});if(isFinalStage(party.cup)){party.phase="RESULTS";party.lastResult=makeResult(party,sim);party.resultOutbox.push(party.lastResult)}else{party.cup.stage++;const next=buildSim(party,party.cup.order[party.cup.stage]!,deriveSeed(party.seed,party.cup.stage));party.events.push(...next.drain());party.liveSimulation=next;party.simulation=persistSumoSim(next);return}}
  else{party.phase="RESULTS";party.lastResult=makeResult(party,sim);party.resultOutbox.push(party.lastResult)}
 }
 if(party.phase==="RESULTS")party.simulation=persistSumoSim(sim);
}
export interface SumoCheckpoint {v:1;party:SumoParty}
export function checkpointSumoParty(party:SumoParty,now:number):SumoCheckpoint{party.lastCheckpointAt=now;const data={...party,simulation:party.liveSimulation?persistSumoSim(party.liveSimulation):party.simulation,liveSimulation:null};return {v:1,party:structuredClone(data)}}
export function restoreSumoParty(saved:SumoCheckpoint):SumoParty{if(saved.v!==1||!saved.party||saved.party.version!==1)throw new Error("PARTY_CHECKPOINT_INVALID");const party=structuredClone(saved.party);party.lastResult??=party.resultOutbox.at(-1)??null;party.liveSimulation=party.simulation?restoreSumoSim(party.simulation):null;if(party.phase==="PLAYING"){party.paused=true;party.pauseReason="recovered";party.epoch++;party.inputs=Object.fromEntries(party.roster.map(s=>[s.id,neutral(party.inputs[s.id]?.seq??-1,party.updatedAt)]));}for(const seat of party.roster)if(seat.memberId){seat.connected=false;seat.disconnectedAt??=party.updatedAt;}party.connectedActors={};return party}

const FIGHTER_FIELDS=["x","y","z","vx","vy","vz","px","py","pz","fx","fz","alive","falling","kind","state","stab","charge","chargeFull","charging","bashT","bashDur","bashPower","bashHit","bashConn","bashSerial","bashCd","dashT","dashSerial","dashHit","dashConn","dashCd","stagger","recover","teeter","fallT","fallStart","fallBy","fallCause","down","downT","downStage","downSide","spinV","spinT","protect","winner"] as const;
export interface SumoDynamicSnapshot {view:{kind:"royal-sumo-v1.3";tick:number;dynamic:{phase:PartyPhase;paused:boolean;epoch:number;serverTime:number;simTime:number;simPhase:string;phaseT:number;round:number;winner:number;matchWinner:number;crowns:number[];stats:unknown;fighterFields:readonly string[];fighters:Array<unknown[]>;arena:Record<string,unknown>|null;hazard:unknown;events:SumoEvent[];cup:SumoCup|null;ranking:SumoRank[];seatIds:string[]}};players:Array<{id:string;name:string}>;finished:boolean;winners:string[];scores:Record<string,number>}
function compactArenaValue(value:unknown):unknown{
 if(typeof value==="number")return Number.isFinite(value)?Math.round(value*1000)/1000:null;
 if(Array.isArray(value))return value.map(compactArenaValue);
 if(value&&typeof value==="object"){const out:Record<string,unknown>={};for(const [key,item] of Object.entries(value))if(typeof item!=="function"&&item!==undefined)out[key]=compactArenaValue(item);return out}
 return value;
}
function dynamicArena(arena:Record<string,unknown>|null):Record<string,unknown>|null{return arena?compactArenaValue(arena) as Record<string,unknown>:null}
export function projectSumoSnapshot(party:SumoParty,options:{kind:PartyRole;now:number}):SumoDynamicSnapshot{
 const sim=party.liveSimulation??(party.simulation?restoreSumoSim(party.simulation):null),ranking=sim?(party.cup?standings(party.cup):rankMatch({winner:sim.matchWinner,n:sim.n,crowns:sim.crowns,stats:sim.stats})):[];
 const scores=party.phase==="RESULTS"?Object.fromEntries(activeSumoSeats(party).map((s,i)=>[s.id,party.cup?.total[i]??sim?.crowns[i]??0])):{};
 const dynamic={phase:party.phase,paused:party.paused,epoch:party.epoch,serverTime:options.now,simTime:sim?.t??0,simPhase:sim?.phase??"idle",phaseT:sim?.phaseT??0,round:sim?.round??0,winner:sim?.winner??-2,matchWinner:sim?.matchWinner??-1,crowns:sim?.crowns.slice(0,sim.n)??[],stats:party.phase==="RESULTS"?(sim?.stats??[]):[],fighterFields:FIGHTER_FIELDS,
  fighters:sim?sim.fighters.map(f=>FIGHTER_FIELDS.map(key=>(f as unknown as Record<string,unknown>)[key]??null)):[],
  arena:dynamicArena(sim?.arena??null),hazard:sim?.hudInfo()??null,events:party.events.slice(-1),cup:party.cup,ranking:party.phase==="RESULTS"?ranking:[],seatIds:[]};
 return {view:{kind:"royal-sumo-v1.3",tick:party.tick,dynamic},players:[],finished:party.phase==="RESULTS",winners:party.phase==="RESULTS"?(party.lastResult?.winners??[]):[],scores};
}
export function projectSumoBootstrap(party:SumoParty):{view:{kind:"royal-sumo-v1.3";tick:number;sim:PackedSumoSim|null;hazard:unknown;events:SumoEvent[];cup:SumoCup|null;ranking:SumoRank[];seatIds:string[]};players:Array<{id:string;name:string}>;finished:boolean;winners:string[];scores:Record<string,number>}{
 const dynamic=projectSumoSnapshot(party,{kind:"display",now:party.updatedAt}),sim=party.liveSimulation??(party.simulation?restoreSumoSim(party.simulation):null);
 return {view:{kind:"royal-sumo-v1.3",tick:party.tick,sim:sim?persistSumoSim(sim):null,hazard:sim?.hudInfo()??null,events:party.events.slice(-32),cup:party.cup,ranking:dynamic.view.dynamic.ranking,seatIds:activeSumoSeats(party).map(s=>s.id)},players:activeSumoSeats(party).map(s=>({id:s.id,name:s.name})),finished:dynamic.finished,winners:dynamic.winners,scores:party.phase==="RESULTS"?Object.fromEntries(activeSumoSeats(party).map((s,i)=>[s.id,party.cup?.total[i]??sim?.crowns[i]??0])):{}};
}
