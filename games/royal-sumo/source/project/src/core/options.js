/* ============================================================================
   ROYAL SUMO - MATCH OPTIONS  (defaults + validation for everything a player can tune per match)
   ========================================================================== */
import {DASH_CD, DIFF, HAZARD_LEVELS, LENGTH_SECS, MAX_PLAYERS} from './tune.js';
import {MAPS} from './maps.js';
import {has} from './util.js';
export const OPT_DEFAULTS={
  map:'keep', fighters:4, difficulty:'normal', winTarget:0, arena:1,
  hazard:'normal', length:'normal', knockback:1, damage:1, speed:1, dash:'normal',
  assist:.5, aiAggr:1, aiReact:1
};
export function normalizeOpts(o){
  const d=OPT_DEFAULTS,r={};o=o||{};
  const num=(k,lo,hi,step)=>{let v=+o[k];if(!isFinite(v))v=d[k];v=Math.min(hi,Math.max(lo,v));if(step)v=Math.round(v/step)*step;r[k]=+v.toFixed(3)};
  const pick=(k,list)=>{r[k]=list.indexOf(o[k])>=0?o[k]:d[k]};
  r.map=(typeof o.map==='string'&&has(MAPS,o.map))?o.map:d.map;
  num('fighters',2,MAX_PLAYERS,1);
  r.difficulty=(typeof o.difficulty==='string'&&(has(DIFF,o.difficulty)||o.difficulty==='mixed'))?o.difficulty:d.difficulty;
  num('winTarget',0,9,1);num('arena',.8,1.3,.05);
  pick('hazard',Object.keys(HAZARD_LEVELS));pick('length',Object.keys(LENGTH_SECS));pick('dash',Object.keys(DASH_CD));
  num('knockback',.5,1.6,.05);num('damage',.5,1.8,.05);num('speed',.8,1.25,.05);
  num('assist',0,1,.05);num('aiAggr',.5,1.6,.05);num('aiReact',.5,1.8,.05);
  return r;
}
