/* ============================================================================
   ROYAL SUMO - SESSION  (match planning: seeds, seating, Crown Cup progress - no DOM, no Sim)
   The session decides WHAT the next match is; main.js builds and runs it. Keeping this pure is what makes the
   rules for seeds and ownership unit-testable:

     seeds   one uint32 per match. A caller-supplied seed (API / ?seed=) plays exactly as given; the matches that
             follow in the same session derive from it (deriveSeed), so rematches differ but the whole sequence is
             reproducible. restart() replays the SAME seed. No seed supplied -> fresh randomness.
     seating the SlotTable is read at every match start, so owners, names and looks survive restarts and cup stages.
   ========================================================================== */
import {OPT_DEFAULTS, normalizeOpts} from './options.js';
import {MAX_PLAYERS} from './tune.js';
import {parseSeed, deriveSeed, randomSeed} from './seed.js';
import {cupOrder, newCup, scoreStage, isFinalStage, standings, champions, rankMatch} from './cup.js';

export class Session{
  constructor(o){
    this.slots=o.slots;this.random=o.random||Math.random;this.maps=o.maps||[];
    this.base=null;this.index=0;this.last=null;       // seed sequence
    this.plan=null;                                    // the match currently / most recently planned
    this.cup=null;
    if(o.urlSeed!==undefined&&o.urlSeed!==null)this.setSeed(o.urlSeed);
  }
  /* ------------------------------------------------------------------ seeds */
  /** Fix the session's base seed (null / '' clears it). The next match plays it exactly. */
  setSeed(v){this.base=parseSeed(v);this.index=0;return this.base}
  /** Seed for a brand-new match. `explicit` (already parsed) becomes the new base. */
  nextSeed(explicit){
    let s;
    if(explicit!==undefined&&explicit!==null){this.base=explicit>>>0;this.index=1;s=this.base}
    else if(this.base!==null){s=this.index===0?this.base:deriveSeed(this.base,this.index);this.index++}
    else s=randomSeed(this.random);
    this.last=s;return s;
  }
  /* ----------------------------------------------------------------- seating */
  /** Apply seating hints from an API call: {players, owners:[..]|{id:owner}, names:[..]|{id:name}} */
  applySeating(spec){
    if(!spec||typeof spec!=='object')return;
    if(spec.players!==undefined)this.slots.setLocalPlayers(+spec.players>=2?2:1);
    const each=(v,fn)=>{if(Array.isArray(v))v.forEach((x,i)=>{if(x!==undefined&&x!==null)fn(i,x)});else if(v&&typeof v==='object')for(const k of Object.keys(v))if(/^\d+$/.test(k))fn(+k,v[k])};
    each(spec.owners,(i,o)=>{this.slots.setOwner(i,o)});
    each(spec.names,(i,nm)=>{this.slots.setName(i,nm)});
  }
  /* ---------------------------------------------------------------- planning */
  _build(opts,o,kind,extra){
    const O=normalizeOpts(opts||OPT_DEFAULTS),n=O.fighters;
    const demo=!!o.demo;
    const p=Object.assign({kind,opts:O,seed:o.seed>>>0,demo,n,slots:this.slots.resolve(n)},extra||{});
    if(!demo)this.plan=p;                              // the title-screen attract match must never become "the last match"
    return p;
  }
  /** A fresh quick match (also used for demos and API scenarios). o: {seed, demo, players, owners, names} */
  planMatch(opts,o={}){
    if(!o.demo){this.cup=null;this.applySeating(o)}
    const parsed=parseSeed(o.seed);
    const seed=o.demo&&parsed===null?randomSeed(this.random):this.nextSeed(parsed===null?undefined:parsed);
    return this._build(opts,{seed,demo:o.demo},'quick');
  }
  /** Play the same match again: same options, same seat table, same seed (or `o.seed`). */
  planReplay(o={}){
    if(!this.plan)return null;
    const p=this.plan,parsed=parseSeed(o.seed);
    if(parsed!==null){this.base=parsed;this.index=1;this.last=parsed}
    const merged=Object.assign({},p.opts,o.opts||{});
    return this._build(merged,{seed:parsed!==null?parsed:p.seed,demo:p.demo},p.kind,p.kind==='cup'?{stage:p.stage,stages:p.stages}:null);
  }
  /** A new match with the same options as the last one but a new seed (the Rematch button). */
  planRematch(){
    if(!this.plan)return null;
    return this.planMatch(this.plan.opts,{});
  }
  /* --------------------------------------------------------------- Crown Cup */
  /** Start a cup on the arena order beginning at opts.map. Returns the plan for arena 1. */
  planCup(opts,o={}){
    this.applySeating(o);
    const O=normalizeOpts(opts||OPT_DEFAULTS),parsed=parseSeed(o.seed);
    const seed=this.nextSeed(parsed===null?undefined:parsed);
    this.cup=newCup({order:cupOrder(O.map,this.maps),n:O.fighters,players:this.slots.localCount(O.fighters),base:O,seed});
    return this.planCupStage();
  }
  cupStageSeed(stage){return stage===0?this.cup.seed:deriveSeed(this.cup.seed,stage)}
  planCupStage(){
    const c=this.cup,seed=this.cupStageSeed(c.stage);this.last=seed;
    return this._build(Object.assign({},c.base,{map:c.order[c.stage],winTarget:1}),{seed},'cup',{stage:c.stage,stages:c.order.length});
  }
  /** Record the arena that just finished (idempotent) and describe the cup state for the results screen. */
  finishCupStage(res){
    const c=this.cup;if(!c)return null;
    scoreStage(c,res);
    const last=isFinalStage(c);
    return {stage:c.stage+1,stages:c.order.length,last,next:last?null:c.order[c.stage+1],
      total:c.total.slice(),gain:c.gain.slice(),wins:c.wins.slice(),kos:c.kos.slice(),
      standings:standings(c),champs:last?champions(c):[]};
  }
  advanceCup(){const c=this.cup;if(!c||isFinalStage(c))return null;c.stage++;return this.planCupStage()}
  endCup(){this.cup=null}
  /** Ordered podium for one finished match (quick match or one cup arena). */
  rank(res){return rankMatch(res)}
}
/** The constructor options for `new Sim(...)` that realise a plan. */
export function simOptions(plan){return Object.assign({},plan.opts,{seed:plan.seed,demo:plan.demo,slots:plan.slots})}
export const MAX_SEATS=MAX_PLAYERS;
