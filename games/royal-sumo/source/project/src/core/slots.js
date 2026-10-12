/* ============================================================================
   ROYAL SUMO - SLOT TABLE  (the one persistent model of "who sits where")
   ----------------------------------------------------------------------------
   A slot is a seat at the table, 0..MAX_PLAYERS-1. For each seat the table remembers
     owner   'bot' | 'local' | 'remote'     who drives the fighter
     device  'p1' | 'p2' | null             which local controls a 'local' owner uses (p1 = touch / WASD / pad 1, p2 = arrows / pad 2)
     name    '' = default, else a custom name (<= 12 characters, sanitised)
     style   -1 = automatic, else a look from the STYLES palette (belt colour + accessory)
     skill   '' = follow the match's bot difficulty, else a fixed bot skill ('rookie'..'legend')
   The table outlives matches: restarting, rematching, cup stages and API calls all plan from it, so ownership
   and names can no longer be lost between rounds. Names, looks and skills persist in browser storage.
   Ownership persists for the session only for remote seats (a connection cannot survive a reload); local seats are
   rebuilt from the "Players" setting.
   ========================================================================== */
import {DIFF, MAX_PLAYERS, NAMES, OWNERS} from './tune.js';
import {has} from './util.js';

export const NAME_MAX=12;
export const STYLE_COUNT=MAX_PLAYERS;
export const DEVICES=Object.freeze(['p1','p2']);
export const SLOTS_KEY='royalSumo.slots';
const BOT_NAMES=['KUMA'].concat(NAMES.slice(1));
// control characters, zero-width / bidi overrides and line separators never belong in a name tag
// code point ranges that never belong in a name tag: C0/C1 controls, soft hyphen, bidi marks and overrides, zero-width
// characters, line / paragraph separators, invisible operators, byte-order mark, interlinear annotation marks
const BAD_RANGES=[[0,31],[127,159],[173,173],[1564,1564],[6158,6158],[8203,8207],[8232,8238],[8288,8303],[65279,65279],[65529,65531]];
const badCp=cp=>{for(let k=0;k<BAD_RANGES.length;k++)if(cp>=BAD_RANGES[k][0]&&cp<=BAD_RANGES[k][1])return true;return false};

/** Clean a user- or API-supplied name. Returns '' for "use the default". */
export function sanitizeName(v){
  if(v===null||v===undefined||typeof v==='object'||typeof v==='function')return '';
  const raw=Array.from(String(v)).map(ch=>badCp(ch.codePointAt(0))?' ':ch).join('');
  let s=raw.replace(/\s+/g,' ').trim();
  const cps=Array.from(s);
  if(cps.length>NAME_MAX)s=cps.slice(0,NAME_MAX).join('').trim();
  return s;
}
/** Give every seat a distinct look. Explicit picks win (lowest seat first on a clash); everyone else keeps their own
 *  number if it is free, otherwise takes the lowest free look. Pure and deterministic. */
export function assignStyles(prefs,n,count=STYLE_COUNT){
  const out=new Array(n).fill(-1),taken=new Set();
  for(let i=0;i<n;i++){const p=prefs[i];if(Number.isInteger(p)&&p>=0&&p<count&&!taken.has(p)){out[i]=p;taken.add(p)}}
  for(let i=0;i<n;i++){
    if(out[i]>=0)continue;
    let c=i%count;
    if(taken.has(c)){c=-1;for(let k=0;k<count;k++)if(!taken.has(k)){c=k;break}}
    out[i]=c>=0?c:i%count;taken.add(out[i]);
  }
  return out;
}
const isSkill=v=>typeof v==='string'&&has(DIFF,v);
const blank=i=>({id:i,owner:i===0?'local':'bot',device:i===0?'p1':null,name:'',style:-1,skill:''});

export class SlotTable{
  constructor(opts={}){
    this.max=opts.max||MAX_PLAYERS;this.storage=opts.storage||null;this.key=opts.key||SLOTS_KEY;
    this.slots=[];for(let i=0;i<this.max;i++)this.slots.push(blank(i));
    this.listeners=[];this.revision=0;
    if(this.storage)this.load();
  }
  /* ---- plumbing */
  valid(i){return Number.isInteger(i)&&i>=0&&i<this.max}
  on(fn){this.listeners.push(fn);return()=>{const k=this.listeners.indexOf(fn);if(k>=0)this.listeners.splice(k,1)}}
  _emit(type,slot,extra){this.revision++;const e=Object.assign({type,slot},extra||{});for(const fn of this.listeners.slice()){try{fn(e)}catch(err){}}}
  get(i){return this.valid(i)?this.slots[i]:null}
  /* ---- persistence: names, looks and skills (+ owner for nothing: see header) */
  load(){
    if(!this.storage)return false;
    try{
      const raw=this.storage.getItem(this.key);if(!raw)return false;
      const o=JSON.parse(raw);if(!o||typeof o!=='object'||o.v!==1||!Array.isArray(o.slots))return false;
      for(let i=0;i<Math.min(this.max,o.slots.length);i++){
        const r=o.slots[i];if(!r||typeof r!=='object')continue;const s=this.slots[i];
        s.name=sanitizeName(r.name);
        s.style=Number.isInteger(r.style)&&r.style>=0&&r.style<STYLE_COUNT?r.style:-1;
        s.skill=isSkill(r.skill)?r.skill:'';
      }
      return true;
    }catch(e){return false}
  }
  save(){
    if(!this.storage)return false;
    try{
      let last=-1;this.slots.forEach((s,i)=>{if(s.name||s.style>=0||s.skill)last=i});
      const slots=[];for(let i=0;i<=last;i++){const s=this.slots[i];slots.push({name:s.name,style:s.style,skill:s.skill})}
      this.storage.setItem(this.key,JSON.stringify({v:1,slots}));return true;
    }catch(e){return false}
  }
  /* ---- queries */
  owner(i){const s=this.get(i);return s?s.owner:null}
  isHuman(i){const s=this.get(i);return !!s&&s.owner!=='bot'}
  isLocal(i){const s=this.get(i);return !!s&&s.owner==='local'}
  isRemote(i){const s=this.get(i);return !!s&&s.owner==='remote'}
  /** seat that owns a local device, or -1 */
  deviceSeat(dev,n){for(let i=0;i<(n===undefined?this.max:Math.min(n,this.max));i++){const s=this.slots[i];if(s.owner==='local'&&s.device===dev)return i}return -1}
  localCount(n){let c=0;for(let i=0;i<(n===undefined?this.max:Math.min(n,this.max));i++)if(this.slots[i].owner==='local')c++;return c}
  humans(n){const o=[];for(let i=0;i<Math.min(n,this.max);i++)if(this.slots[i].owner!=='bot')o.push(i);return o}
  /** name shown for a seat: custom if set, otherwise a sensible default for its owner */
  displayName(i,n){
    const s=this.get(i);if(!s)return 'P'+(i+1);
    if(s.name)return s.name;
    if(s.owner==='local')return this.localCount(n)>1?'P'+(i+1):'YOU';
    if(s.owner==='remote')return 'P'+(i+1);
    return BOT_NAMES[i]||('BOT'+(i+1));
  }
  /* ---- changes */
  setOwner(i,owner,opts={}){
    if(!this.valid(i)||OWNERS.indexOf(owner)<0)return false;
    const s=this.slots[i];let device=null;
    if(owner==='local'){
      device=opts.device===undefined||opts.device===null?(s.owner==='local'&&s.device?s.device:null):opts.device;
      if(device!==null&&DEVICES.indexOf(device)<0)return false;
      if(device===null){device=DEVICES.find(d=>this.deviceSeat(d)<0||this.deviceSeat(d)===i)||null;if(!device)return false}
      const holder=this.deviceSeat(device);
      if(holder>=0&&holder!==i)return false;                     // one local device, one seat
    }
    this._set(i,owner,device);return true;
  }
  _set(i,owner,device){
    const s=this.slots[i];if(s.owner===owner&&s.device===device)return false;
    const was=s.owner;s.owner=owner;s.device=device;this._emit('owner',i,{owner,was,device});return true;
  }
  /** take a local device for a seat, evicting whoever held it */
  _claim(i,dev){const h=this.deviceSeat(dev);if(h>=0&&h!==i)this._set(h,'bot',null);this._set(i,'local',dev)}
  /** The Players 1 / 2 setting: seat 0 holds the first local device, seat 1 the second. Always wins over other seats. */
  setLocalPlayers(k){
    k=k>=2?2:1;
    this._claim(0,'p1');
    if(k===2)this._claim(1,'p2');
    else if(this.slots[1].owner==='local')this._set(1,'bot',null);
    return k;
  }
  setName(i,name){
    if(!this.valid(i))return null;
    const clean=sanitizeName(name),s=this.slots[i];
    if(s.name===clean)return clean;
    s.name=clean;this.save();this._emit('name',i,{name:clean});return clean;
  }
  setStyle(i,style){
    if(!this.valid(i))return -1;
    const v=Number.isInteger(style)&&style>=0&&style<STYLE_COUNT?style:-1,s=this.slots[i];
    if(s.style===v)return v;
    s.style=v;this.save();this._emit('style',i,{style:v});return v;
  }
  setSkill(i,skill){
    if(!this.valid(i))return '';
    const v=isSkill(skill)?skill:'',s=this.slots[i];
    if(s.skill===v)return v;
    s.skill=v;this.save();this._emit('skill',i,{skill:v});return v;
  }
  /** Back to factory seating (and forget names / looks when `all`). */
  reset(all){
    for(let i=0;i<this.max;i++){const b=blank(i),s=this.slots[i];s.owner=b.owner;s.device=b.device;if(all){s.name='';s.style=-1;s.skill=''}}
    if(all)this.save();this._emit('reset',-1);
  }
  /** Everything the Sim needs for an n-fighter match, with unique looks assigned. */
  resolve(n){
    n=Math.max(0,Math.min(n,this.max));
    const styles=assignStyles(this.slots.slice(0,n).map(s=>s.style),n);
    const out=[];
    for(let i=0;i<n;i++){const s=this.slots[i];out.push({id:i,owner:s.owner,device:s.device,name:this.displayName(i,n),custom:!!s.name,style:styles[i],skill:s.skill})}
    return out;
  }
  /** Public, copy-only view used by RoyalSumo.multiplayer.getSlots(). */
  snapshot(n){
    const out=[];
    for(const r of this.resolve(n===undefined?this.max:n))out.push({id:r.id,name:r.name,owner:r.owner,kind:r.owner,human:r.owner!=='bot',local:r.owner==='local',remote:r.owner==='remote',device:r.device,style:r.style,skill:r.skill});
    return out;
  }
}
