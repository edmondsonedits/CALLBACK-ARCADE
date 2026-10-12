/* ============================================================================
   ROYAL SUMO - CONTROL  (the application service behind the menus and window.RoyalSumo)
   ----------------------------------------------------------------------------
   Match flow, seating and input routing in one place, with no DOM and no rendering, so every rule here is unit-tested
   in node. main.js supplies the host callbacks and wires the result to the page:

     host.sim()             the running Sim, or null
     host.launch(plan,how)  build + start a Sim for a Session plan   (how: 'game' | 'menu')
     host.baseOptions()     match options currently chosen in Settings (defaults for scenario())
     host.seatsChanged()    seats or names were changed (re-layout touch controls, refresh labels)

   Who drives a fighter:   'local'  a person on this device (device p1 or p2)
                           'remote' an external controller, through multiplayer.submitInput
                           'bot'    the AI
   The SlotTable is the source of truth between matches; the running Sim is told about every change as it happens.
   ========================================================================== */
import {OPT_DEFAULTS, normalizeOpts} from './options.js';
import {RemoteInputs} from './remote.js';
import {MAX_PLAYERS} from './tune.js';
import {VERSIONS} from './versions.js';

const optKeys=Object.keys(OPT_DEFAULTS);
/** the recognised match options inside an arbitrary caller object */
export function pickOptions(o){const r={};if(o&&typeof o==='object')for(const k of optKeys)if(o[k]!==undefined)r[k]=o[k];return r}
const toInt=v=>{const n=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?Number(v):NaN);return Number.isInteger(n)?n:-1};

export class Control{
  constructor(o){
    this.session=o.session;this.slots=o.slots;this.host=o.host;
    this.remote=o.remote||new RemoteInputs();
    this.now=o.now||(()=>Date.now());
    this._tmp={mx:0,mz:0,bashDown:false,bashPower:-1,dash:false};
  }
  /* ------------------------------------------------------------- match flow */
  /** Menu START. f = {mode:'quick'|'cup', players:1|2} */
  startFromMenu(opts,f){
    const players=f&&+f.players>=2?2:1;
    const plan=(f&&f.mode==='cup')?this.session.planCup(opts,{players}):this.session.planMatch(opts,{players});
    this.host.launch(plan,'game');return plan;
  }
  /** Same options and seating, a new seed (Rematch button). */
  rematch(){const p=this.session.planRematch()||this._fresh({});this.host.launch(p,'game');return p}
  /** Same match again: same seed unless `o.seed` is given. Other option keys in `o` override the rules. */
  restart(o){
    o=(o&&typeof o==='object')?o:{};
    const p=this.session.planReplay({seed:o.seed,opts:pickOptions(o)})||this._fresh(o);
    this.host.launch(p,'game');return p;
  }
  nextStage(){const p=this.session.advanceCup();if(p)this.host.launch(p,'game');return p}
  quitToTitle(){this.session.endCup()}
  /** The title-screen attract match: bots only, never counted as a match, never consumes the seed sequence. */
  startDemo(map){
    const base=normalizeOpts(this.host.baseOptions());
    const p=this.session.planMatch(Object.assign({},base,{map:map||base.map,fighters:5,difficulty:'hard',length:'short',winTarget:1}),{demo:true});
    this.host.launch(p,'menu');return p;
  }
  /** API entry: a fresh match from {map,fighters,...options, seed, demo, players, owners, names}. */
  scenario(o){
    o=(o&&typeof o==='object')?o:{};
    const opts=normalizeOpts(Object.assign({},this.host.baseOptions(),pickOptions(o)));
    const p=this.session.planMatch(opts,{seed:o.seed,demo:!!o.demo,players:o.players,owners:o.owners,names:o.names});
    this.host.launch(p,'game');return p;
  }
  _fresh(o){return this.session.planMatch(normalizeOpts(Object.assign({},this.host.baseOptions(),pickOptions(o))),{seed:o.seed})}
  setSeed(v){return this.session.setSeed(v)}

  /* ------------------------------------------------------------------ seats */
  /** how many seats the current (or next) match has */
  seatCount(){
    const p=this.session.plan;if(p)return p.n;
    const s=this.host.sim();if(s&&!s.demo)return s.n;
    return normalizeOpts(this.host.baseOptions()).fighters;
  }
  getSlots(){return this.slots.snapshot(this.seatCount())}
  /** Change who drives seat i, now and for every later match. Returns the seat's record, or null if refused. */
  setOwner(i,owner,opts){
    i=toInt(i);
    if(!this.slots.setOwner(i,owner,opts))return null;
    this.remote.clear(i);
    const sim=this.host.sim();if(sim&&!sim.demo&&i<sim.n)sim.setOwner(i,owner);
    this.host.seatsChanged();
    return this.slots.snapshot(Math.max(this.seatCount(),i+1))[i];
  }
  /** v0.21 shorthand. true: person (seat 0 plays on this device, other seats are remote), false: bot, or an owner name. */
  setHumanSlot(i,on,opts){
    i=toInt(i);
    const owner=typeof on==='string'?on:(on?(i===0?'local':'remote'):'bot');
    return this.setOwner(i,owner,opts);
  }
  /** Custom name for a seat (sanitised, persisted). '' restores the default. Returns the name now shown, or null. */
  setPlayerName(i,name){
    i=toInt(i);if(!this.slots.valid(i))return null;
    this.slots.setName(i,name);
    const dn=this.slots.displayName(i,this.seatCount());
    const sim=this.host.sim();if(sim&&!sim.demo&&i<sim.n)sim.setSeatName(i,dn);
    this.host.seatsChanged();
    return dn;
  }
  /** Look (0..9, or -1 = automatic). Takes effect from the next match. */
  setLook(i,style){i=toInt(i);return this.slots.valid(i)?this.slots.setStyle(i,style):null}
  /** Fixed bot skill for one seat ('' = follow the match difficulty). Takes effect from the next match. */
  setBotSkill(i,skill){i=toInt(i);return this.slots.valid(i)?this.slots.setSkill(i,skill):null}
  /** Restart as a match with n fighters (2..10). */
  setFighterCount(n){
    n=Number(n);if(!isFinite(n))return false;
    const cur=this.session.plan?this.session.plan.opts:normalizeOpts(this.host.baseOptions());
    const p=this.session.planMatch(Object.assign({},cur,{fighters:n}),{});
    this.host.launch(p,'game');return p.n;
  }
  /** External command for a remote-owned seat. Returns true when it was accepted. */
  submitInput(i,cmd){
    i=toInt(i);
    if(!this.slots.isRemote(i))return false;
    const sim=this.host.sim();if(!sim||sim.demo||i>=sim.n||sim.ownerOf(i)!=='remote')return false;
    return this.remote.submit(i,cmd,this.now());
  }

  /* ------------------------------------------------------------ input routing */
  /** Copy this frame's input into every human-driven seat.  local = {p1:{mx,mz,bashDown,dash}, p2:{...}} */
  routeInputs(sim,local,now){
    if(!sim||sim.demo)return;
    const tmp=this._tmp;
    for(let i=0;i<sim.n;i++){
      const owner=sim.seats[i].owner;if(owner==='bot')continue;
      const inp=sim.inputs[i];
      if(owner==='remote'){
        this.remote.read(i,now,tmp);
        inp.mx=tmp.mx;inp.mz=tmp.mz;inp.bashDown=tmp.bashDown;
        if(tmp.bashPower>=0)inp.bashPower=tmp.bashPower;
        if(tmp.dash)inp.dash=true;
      }else{
        const s=this.slots.get(i),src=s&&s.device?local[s.device]:null;
        if(src){inp.mx=src.mx;inp.mz=src.mz;inp.bashDown=!!src.bashDown;if(src.dash)inp.dash=true}
        else{inp.mx=0;inp.mz=0;inp.bashDown=false}
      }
    }
  }
  /** The seat a local device currently drives in the running match, or -1. */
  deviceSeat(dev,sim){
    sim=sim||this.host.sim();if(!sim||sim.demo)return -1;
    const i=this.slots.deviceSeat(dev,sim.n);
    return i>=0&&sim.seats[i].owner==='local'?i:-1;
  }
  /** Both local devices in use -> the screen is shared (two sets of controls). */
  isSplit(sim){sim=sim||this.host.sim();return !!sim&&!sim.demo&&this.deviceSeat('p1',sim)>=0&&this.deviceSeat('p2',sim)>=0}

  /* -------------------------------------------------------------- reporting */
  /** Sim snapshot + build / protocol / seating / cup progress, for RoyalSumo.getState() */
  state(){
    const sim=this.host.sim();if(!sim)return null;
    const s=sim.snapshot();
    s.build=VERSIONS.build;s.protocol=VERSIONS.protocol;s.slots=this.slots.snapshot(sim.n);
    const c=this.session.cup;s.cup=c?{stage:c.stage+1,stages:c.order.length,total:c.total.slice()}:null;
    return s;
  }
  /** The bound functions exposed as RoyalSumo.multiplayer */
  multiplayerApi(){
    const c=this;
    return {
      maxPlayers:MAX_PLAYERS,
      getSlots:()=>c.getSlots(),
      setHumanSlot:(i,on,opts)=>c.setHumanSlot(i,on,opts),
      setOwner:(i,owner,opts)=>c.setOwner(i,owner,opts),
      submitInput:(i,cmd)=>c.submitInput(i,cmd),
      setPlayerName:(i,name)=>c.setPlayerName(i,name),
      setLook:(i,style)=>c.setLook(i,style),
      setBotSkill:(i,skill)=>c.setBotSkill(i,skill),
      setFighterCount:n=>c.setFighterCount(n),
      setRemoteTimeout:ms=>c.remote.setIdle(ms)
    };
  }
}
