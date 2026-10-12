/* ============================================================================
   ROYAL SUMO - REMOTE INPUT  (the wire format for external controllers: RoyalSumo.multiplayer.submitInput)
   ----------------------------------------------------------------------------
   A remote controller sends small command objects for one seat. Two vocabularies are accepted, because the
   original v0.21 API and the simulation's own input names are both in the wild:

     moveX | mx          -1..1   stick, right = +
     moveY | mz          -1..1   stick, toward the camera (down the screen) = +
     bashDown | bash     bool    BASH button state: hold to charge, release to strike
     bashPressed         bool    one-shot: strike right now with power bashCharge | bashPower (default .35)
     dashPressed | dash  bool    one-shot dash
     sequence            int     optional client counter; a command older than the newest one seen is dropped
     (an empty object is a valid "still here" heartbeat)

   Stick and bash-hold are LEVELS: they stay as sent until changed. Bash-strike and dash are EDGES: they fire once.
   If nothing at all arrives for `idleMs` the seat goes neutral (stands still, releases BASH) so a dropped client
   cannot leave a sumo walking off the ring. Everything is clamped and NaN-proofed; unknown keys are ignored.
   ========================================================================== */
import {MAX_PLAYERS} from './tune.js';

export const REMOTE_IDLE_MS=5000;
const num=v=>{const n=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?Number(v):NaN);return isFinite(n)?n:NaN};
const clamp1=v=>v<-1?-1:(v>1?1:v);
const first=(o,...keys)=>{for(const k of keys)if(o[k]!==undefined)return o[k];return undefined};

/** Turn any caller-supplied command into a safe, normalised patch. Only keys that were actually provided appear. */
export function parseCommand(cmd){
  const p={};
  if(!cmd||typeof cmd!=='object')return p;
  const x=num(first(cmd,'moveX','mx')),y=num(first(cmd,'moveY','mz'));
  if(!isNaN(x))p.mx=clamp1(x);
  if(!isNaN(y))p.mz=clamp1(y);
  const bd=first(cmd,'bashDown','bash');if(bd!==undefined)p.bashDown=bd===true||bd===1||bd==='true'||bd==='1';
  if(cmd.bashPressed===true||cmd.bashPressed===1){
    let pw=num(first(cmd,'bashCharge','bashPower'));if(isNaN(pw))pw=.35;
    p.strike=pw<.12?.12:(pw>1?1:pw);
  }
  const dp=first(cmd,'dashPressed','dash');if(dp===true||dp===1||dp==='true'||dp==='1')p.dash=true;
  const sq=num(cmd.sequence);if(!isNaN(sq))p.sequence=Math.trunc(sq);
  return p;
}

export class RemoteInputs{
  constructor(opts={}){
    this.idleMs=opts.idleMs===undefined?REMOTE_IDLE_MS:opts.idleMs;       // 0 = never time out
    this.max=opts.max||MAX_PLAYERS;
    this.seats=[];for(let i=0;i<this.max;i++)this.seats.push(this._blank());
  }
  _blank(){return {mx:0,mz:0,bashDown:false,strike:-1,dash:false,seq:-1,last:-1e18,seen:false,dropped:0}}
  valid(slot){return Number.isInteger(slot)&&slot>=0&&slot<this.max}
  /** Apply a command. Returns true when it was accepted (valid seat, not an out-of-order packet). */
  submit(slot,cmd,now){
    if(!this.valid(slot))return false;
    const s=this.seats[slot],p=parseCommand(cmd);
    if(p.sequence!==undefined){
      if(s.seq>=0&&p.sequence<s.seq&&s.seq-p.sequence<0x7fffffff){s.dropped++;return false}
      s.seq=p.sequence;
    }
    if(p.mx!==undefined)s.mx=p.mx;
    if(p.mz!==undefined)s.mz=p.mz;
    if(p.bashDown!==undefined)s.bashDown=p.bashDown;
    if(p.strike!==undefined)s.strike=p.strike;
    if(p.dash)s.dash=true;
    s.last=now;s.seen=true;
    const l=Math.hypot(s.mx,s.mz);if(l>1){s.mx/=l;s.mz/=l}
    return true;
  }
  /** Milliseconds since the seat last sent anything (Infinity if never). */
  age(slot,now){const s=this.seats[slot];return s&&s.seen?now-s.last:Infinity}
  stale(slot,now){const s=this.seats[slot];if(!s)return true;return this.idleMs>0&&(!s.seen||now-s.last>this.idleMs)}
  /** Fill `out` with this tick's input. One-shot edges are consumed. */
  read(slot,now,out){
    out=out||{};const s=this.seats[slot];
    if(!s||(this.idleMs>0&&s.seen&&now-s.last>this.idleMs)){
      out.mx=0;out.mz=0;out.bashDown=false;out.bashPower=-1;out.dash=false;
      if(s){s.mx=0;s.mz=0;s.bashDown=false;s.strike=-1;s.dash=false}
      return out;
    }
    out.mx=s.mx;out.mz=s.mz;out.bashDown=s.bashDown;out.bashPower=s.strike;out.dash=s.dash;
    s.strike=-1;s.dash=false;
    return out;
  }
  /** Forget a seat completely (called when ownership changes so stale sticks and sequence numbers never leak). */
  clear(slot){if(this.valid(slot))this.seats[slot]=this._blank()}
  setIdle(ms){const v=num(ms);this.idleMs=isNaN(v)||v<0?REMOTE_IDLE_MS:v}
}
