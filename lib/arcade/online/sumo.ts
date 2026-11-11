import {
  Sim, MAP_ORDER, FIXED_DT, normalizeOpts, deriveSeed, cupOrder, newCup,
  scoreStage, isFinalStage, standings, champions, rankMatch,
  type SumoCup, type SumoEvent, type SumoRank,
} from "./sumo-core.mjs";
import { persistSumoSim, restoreSumoSim, type PackedSumoSim } from "./sumo-codec";
import type { OnlineEngine, OnlineInput, OnlineView } from "./types";

export interface SumoOnlineState {
  version:1;ids:string[];seed:number;tick:number;mode:"quick"|"cup";
  simulation:PackedSumoSim;cup:SumoCup|null;lastSequences:Record<string,number>;
  events:SumoEvent[];finished:boolean;
}
export interface SumoOnlineRenderView {
  kind:"royal-sumo-v1.3";tick:number;sim:PackedSumoSim;hazard:unknown;events:SumoEvent[];
  cup:SumoCup|null;ranking:SumoRank[];seatIds:string[];
}
const bounded = (value:unknown,low:number,high:number,fallback=0):number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(low,Math.min(high,value)) : fallback;
function controls(sim:Sim,state:SumoOnlineState,inputs:Record<string,OnlineInput>,botIds:string[]):void {
  const bots = new Set(botIds);
  state.ids.forEach((id,i) => {
    const bot = bots.has(id);
    sim.setOwner(i,bot ? "bot" : "remote");
    if (bot) return;
    const command = inputs[id],out = sim.inputs[i];
    out.mx = bounded(command?.x,-1,1);out.mz = bounded(command?.y,-1,1);
    const length = Math.hypot(out.mx,out.mz);if (length > 1) {out.mx/=length;out.mz/=length;}
    out.bashDown = command?.bashDown === true || command?.action === "charge";
    out.bashPower = -1;out.dash = false;
    // Transport supplies the latest level every tick; action edges use monotonic sequences.
    if (command && Number.isSafeInteger(command.seq) && command.seq > (state.lastSequences[id] ?? -1)) {
      state.lastSequences[id] = command.seq;
      out.dash = command.dash === true || command.action === "dash";
      if (command.action === "bash" || typeof command.bashPower === "number" && command.bashPower >= 0)
        out.bashPower = bounded(command.bashPower,.18,1,.35);
    }
  });
}
function startStage(state:SumoOnlineState,botIds:string[]):Sim {
  const cup = state.cup!;
  const stageSeed = cup.stage === 0 ? state.seed : deriveSeed(state.seed,cup.stage);
  const sim = new Sim({ ...cup.base,map:cup.order[cup.stage],winTarget:1,seed:stageSeed,
    slots:state.ids.map((id,i) => ({owner:botIds.includes(id) ? "bot" : "remote",name:`P${i+1}`,style:i})),
  });
  sim.startMatch();return sim;
}
export const SUMO_ONLINE_ENGINE:OnlineEngine = {
  id:"sumo",title:"Royal Sumo",controls:[
    {action:"charge",label:"Hold BASH",hold:true,key:"Space"},
    {action:"dash",label:"DASH",key:"Shift"},
  ],
  create(ids,seed,options,botIds) {
    if (ids.length < 2 || ids.length > 10 || new Set(ids).size !== ids.length) throw new Error("Sumo requires two to ten unique seats");
    const mode = options.mode === "cup" ? "cup" : "quick";
    const opts = normalizeOpts({...options,fighters:ids.length});
    const sim = new Sim({...opts,seed:seed>>>0,winTarget:mode === "cup" ? 1 : opts.winTarget,
      slots:ids.map((id,i) => ({owner:botIds.includes(id) ? "bot" : "remote",name:`P${i+1}`,style:i})),
    });
    sim.startMatch();
    const state:SumoOnlineState = {version:1,ids:ids.slice(),seed:seed>>>0,tick:0,mode,
      simulation:persistSumoSim(sim),cup:mode === "cup" ? newCup({order:cupOrder(String(opts.map),MAP_ORDER),n:ids.length,players:ids.length-botIds.length,base:opts,seed:seed>>>0}) : null,
      lastSequences:{},events:sim.drain(),finished:false};
    state.simulation = persistSumoSim(sim);return state;
  },
  step(value,inputs,botIds) {
    const previous = value as SumoOnlineState;
    if (previous.finished) return previous;
    const state:SumoOnlineState = {...previous,lastSequences:{...previous.lastSequences},cup:previous.cup ? structuredClone(previous.cup) : null};
    let sim = restoreSumoSim(state.simulation);
    controls(sim,state,inputs,botIds);
    // Exactly four original 120 Hz physics steps, independent of browser hit-stop/time scaling.
    for (let i=0;i<4;i++) sim.step(FIXED_DT);
    state.tick++;
    state.events = sim.drain();
    if (sim.phase === "matchend") {
      if (state.cup) {
        scoreStage(state.cup,{winner:sim.matchWinner,stats:sim.stats,n:sim.n});
        if (isFinalStage(state.cup)) state.finished = true;
        else {state.cup.stage++;sim=startStage(state,botIds);state.events.push(...sim.drain());}
      } else state.finished = true;
    }
    state.simulation = persistSumoSim(sim);return state;
  },
  publicState(value):OnlineView {
    const state = value as SumoOnlineState,sim = restoreSumoSim(state.simulation);
    const ranking = state.cup ? standings(state.cup) : rankMatch({n:sim.n,winner:sim.matchWinner,crowns:sim.crowns,stats:sim.stats});
    const winners = state.finished ? (state.cup ? champions(state.cup) : sim.matchWinner >= 0 ? [sim.matchWinner] : []).map(i => state.ids[i]) : [];
    const scores = Object.fromEntries(state.ids.map((id,i) => [id,state.cup ? state.cup.total[i] : sim.crowns[i]]));
    const view:SumoOnlineRenderView = {kind:"royal-sumo-v1.3",tick:state.tick,sim:state.simulation,
      hazard:sim.hudInfo(),events:state.events,cup:state.cup,ranking,seatIds:state.ids.slice()};
    return {view,winners,scores,finished:state.finished};
  },
};
