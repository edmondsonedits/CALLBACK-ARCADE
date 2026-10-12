/* ============================================================================
   ROYAL SUMO - SETTINGS  (data-driven schema, persistence, presets)
   ========================================================================== */
import {DIFF_LABEL, MAX_PLAYERS} from './tune.js';
import {OPT_DEFAULTS, normalizeOpts} from './options.js';
import {MAPS, MAP_ORDER} from './maps.js';
export const Settings=(function(){
  const KEY='royalSumo.v1';
  const sections=[{id:'match',label:'Rules',icon:'crown'},{id:'controls',label:'Controls',icon:'pad'},{id:'audio',label:'Audio',icon:'note'},{id:'graphics',label:'Graphics',icon:'spark'},{id:'access',label:'Access',icon:'eye'}];
  const pct=v=>Math.round(v*100)+'%',mult=v=>'x'+(+v).toFixed(2).replace(/0$/,'').replace(/\.$/,'');
  const reduceDefault=(()=>{try{return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}catch(e){return false}})();
  const def=[];
  const mapOpts=MAP_ORDER.map(id=>({v:id,label:MAPS[id].name}));
  const diffOpts=['rookie','easy','normal','hard','legend','mixed'].map(v=>({v,label:DIFF_LABEL[v]}));
  const A=(o)=>def.push(o);
  /* ---- match rules */
  A({key:'match.map',section:'match',label:'Map',type:'select',options:mapOpts,def:OPT_DEFAULTS.map,desc:'Which arena to fight on.'});
  A({key:'match.fighters',section:'match',label:'Fighters',type:'range',min:2,max:MAX_PLAYERS,step:1,def:OPT_DEFAULTS.fighters,fmt:v=>String(v),desc:'Total sumo in the ring, you plus bots.'});
  A({key:'match.mode',section:'match',label:'Game mode',type:'seg',options:[{v:'quick',label:'Quick match'},{v:'cup',label:'Crown Cup'}],def:'quick',desc:'Crown Cup: fight through all six arenas. A win is worth 3 points and every knockout adds 1.'});
  A({key:'match.players',section:'match',label:'Players',type:'seg',options:[{v:1,label:'1 player'},{v:2,label:'2 players'}],def:1,desc:'Two players share a keyboard (WASD + Space/Shift, and arrows + Enter/Right Shift) or use two gamepads.'});
  A({key:'match.difficulty',section:'match',label:'Bot skill',type:'seg',options:diffOpts,def:OPT_DEFAULTS.difficulty,desc:'Page is gentle, Legend never misses. Mixed gives each bot a different skill.'});
  A({key:'match.winTarget',section:'match',label:'Rounds to win',type:'seg',options:[{v:0,label:'Auto'},{v:1,label:'1'},{v:2,label:'2'},{v:3,label:'3'},{v:5,label:'5'}],def:OPT_DEFAULTS.winTarget,desc:'First to this many round wins takes the crown. Auto is 3 for small rings, 2 for crowds.'});
  A({key:'match.hazard',section:'match',label:'Hazards',type:'seg',options:[{v:'off',label:'Off'},{v:'mild',label:'Mild'},{v:'normal',label:'Normal'},{v:'wild',label:'Wild'}],def:OPT_DEFAULTS.hazard,desc:'How often the map attacks: collapses, bumpers, arms, meteors. Off still ends rounds with sudden death.'});
  A({key:'match.length',section:'match',label:'Round length',type:'seg',options:[{v:'short',label:'Short'},{v:'normal',label:'Normal'},{v:'long',label:'Long'},{v:'epic',label:'Epic'}],def:OPT_DEFAULTS.length,desc:'How long a round runs before sudden death shrinks the ring.'});
  A({key:'match.arena',section:'match',label:'Arena size',type:'range',min:.8,max:1.3,step:.05,def:OPT_DEFAULTS.arena,fmt:pct,desc:'Bigger rings give more room to run. Smaller ones are brawls.'});
  A({key:'match.knockback',section:'match',label:'Knockback',type:'range',min:.5,max:1.6,step:.05,def:OPT_DEFAULTS.knockback,fmt:pct,desc:'How far a hit launches you.',adv:true});
  A({key:'match.damage',section:'match',label:'Bash damage',type:'range',min:.5,max:1.8,step:.05,def:OPT_DEFAULTS.damage,fmt:pct,desc:'How fast hits drain the stability bar. Higher means more knockdowns.',adv:true});
  A({key:'match.speed',section:'match',label:'Fighter speed',type:'range',min:.8,max:1.25,step:.05,def:OPT_DEFAULTS.speed,fmt:pct,desc:'Running speed for everyone.',adv:true});
  A({key:'match.dash',section:'match',label:'Dash',type:'seg',options:[{v:'off',label:'Off'},{v:'fast',label:'Fast'},{v:'normal',label:'Normal'},{v:'slow',label:'Slow'}],def:OPT_DEFAULTS.dash,desc:'Dash cooldown. Off removes the rush move completely.',adv:true});
  A({key:'match.assist',section:'match',label:'Aim assist',type:'range',min:0,max:1,step:.05,def:OPT_DEFAULTS.assist,fmt:pct,desc:'Gently steers your bash toward a rival in front of you.',adv:true});
  A({key:'match.aiAggr',section:'match',label:'Bot aggression',type:'range',min:.5,max:1.6,step:.05,def:OPT_DEFAULTS.aiAggr,fmt:pct,desc:'How eagerly bots charge in.',adv:true});
  A({key:'match.aiReact',section:'match',label:'Bot reaction time',type:'range',min:.5,max:1.8,step:.05,def:OPT_DEFAULTS.aiReact,fmt:pct,desc:'Higher means slower reactions, so easier bots.',adv:true});
  /* ---- controls */
  A({key:'ctl.stick',section:'controls',label:'Stick style',type:'seg',options:[{v:'float',label:'Floating'},{v:'fixed',label:'Fixed'}],def:'float',desc:'Floating appears under your thumb. Fixed stays in the corner.'});
  A({key:'ctl.swap',section:'controls',label:'Left-handed layout',type:'toggle',def:false,desc:'Stick on the right, buttons on the left.'});
  A({key:'ctl.stickSize',section:'controls',label:'Stick size',type:'range',min:.7,max:1.5,step:.05,def:1,fmt:pct,desc:'Size of the on-screen stick.'});
  A({key:'ctl.btnSize',section:'controls',label:'Button size',type:'range',min:.7,max:1.5,step:.05,def:1,fmt:pct,desc:'Size of BASH and DASH.'});
  A({key:'ctl.opacity',section:'controls',label:'Control opacity',type:'range',min:.3,max:1,step:.05,def:.85,fmt:pct,desc:'How see-through the touch controls are.'});
  A({key:'ctl.deadzone',section:'controls',label:'Stick dead zone',type:'range',min:0,max:.3,step:.01,def:.08,fmt:pct,desc:'Ignore tiny thumb wobble.',adv:true});
  A({key:'ctl.haptics',section:'controls',label:'Vibration',type:'toggle',def:true,desc:'Buzz on hits, knockouts and wins (phones only).'});
  A({key:'ctl.showButtons',section:'controls',label:'On-screen buttons',type:'seg',options:[{v:'auto',label:'Auto'},{v:'on',label:'Always'},{v:'off',label:'Hide'}],def:'auto',desc:'Auto shows them only on touch devices.'});
  /* ---- audio */
  A({key:'aud.master',section:'audio',label:'Master volume',type:'range',min:0,max:1,step:.05,def:.8,fmt:pct,desc:'Everything.'});
  A({key:'aud.music',section:'audio',label:'Music',type:'range',min:0,max:1,step:.05,def:.6,fmt:pct,desc:'Each map has its own track.'});
  A({key:'aud.sfx',section:'audio',label:'Sound effects',type:'range',min:0,max:1,step:.05,def:.9,fmt:pct,desc:'Hits, crashes and crowd.'});
  A({key:'aud.mute',section:'audio',label:'Mute all',type:'toggle',def:false,desc:'Silence the game.'});
  /* ---- graphics */
  A({key:'gfx.quality',section:'graphics',label:'Quality',type:'seg',options:[{v:'low',label:'Low'},{v:'medium',label:'Medium'},{v:'high',label:'High'}],def:'medium',desc:'Lower this if the game stutters on your phone.'});
  A({key:'gfx.scale',section:'graphics',label:'Render scale',type:'range',min:.5,max:1,step:.05,def:1,fmt:pct,desc:'Draw fewer pixels for more speed.'});
  A({key:'gfx.auto',section:'graphics',label:'Auto quality',type:'toggle',def:true,desc:'Lowers resolution automatically if the game runs slowly.'});
  A({key:'gfx.particles',section:'graphics',label:'Effects',type:'seg',options:[{v:'low',label:'Low'},{v:'normal',label:'Normal'},{v:'high',label:'High'}],def:'normal',desc:'Amount of sparks, dust and confetti.'});
  A({key:'gfx.outline',section:'graphics',label:'Cartoon outlines',type:'toggle',def:true,desc:'Thick ink outlines on fighters and props.'});
  A({key:'gfx.cam',section:'graphics',label:'Camera',type:'seg',options:[{v:'dynamic',label:'Follow'},{v:'fixed',label:'Fixed'}],def:'dynamic',desc:'Follow drifts toward the action. Fixed stays centered.'});
  A({key:'gfx.zoom',section:'graphics',label:'Camera zoom',type:'range',min:.85,max:1.25,step:.05,def:1,fmt:pct,desc:'Closer or farther view.',adv:true});
  A({key:'gfx.shake',section:'graphics',label:'Screen shake',type:'range',min:0,max:1,step:.05,def:1,fmt:pct,desc:'Camera rumble on big hits.',adv:true});
  A({key:'gfx.hitstop',section:'graphics',label:'Hit freeze',type:'toggle',def:true,desc:'A tiny freeze-frame on heavy hits.',adv:true});
  A({key:'gfx.names',section:'graphics',label:'Name tags',type:'toggle',def:true,desc:'Show names above fighters.'});
  A({key:'gfx.stabbars',section:'graphics',label:'Stability bars',type:'toggle',def:true,desc:'Show the balance bar above fighters.'});
  A({key:'gfx.fps',section:'graphics',label:'Show FPS',type:'toggle',def:false,desc:'Small frame counter in the corner.',adv:true});
  /* ---- accessibility */
  A({key:'acc.reduceMotion',section:'access',label:'Reduce motion',type:'toggle',def:reduceDefault,desc:'Calmer menus, gentler camera shake.'});
  A({key:'acc.reduceFlash',section:'access',label:'Reduce flashes',type:'toggle',def:false,desc:'No white screen flashes.'});
  A({key:'acc.textSize',section:'access',label:'Text size',type:'seg',options:[{v:'normal',label:'Normal'},{v:'large',label:'Large'}],def:'normal',desc:'Bigger menu and HUD text.'});
  A({key:'acc.colorblind',section:'access',label:'Shape markers',type:'toggle',def:false,desc:'Adds a shape next to each fighter name so colors are not the only clue.'});
  A({key:'acc.highContrast',section:'access',label:'High contrast',type:'toggle',def:false,desc:'Stronger outlines and plainer panels.'});

  const byKey={};for(const d of def)byKey[d.key]=d;
  let vals={},flags={},listeners=[],memFallback=null;
  function load(){
    try{const raw=localStorage.getItem(KEY);if(raw){const o=JSON.parse(raw);if(o&&typeof o==='object'){vals=o.values||{};flags=o.flags||{}}}}catch(e){memFallback={}}
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify({v:1,values:vals,flags:flags}))}catch(e){}}
  function clean(d,v){
    if(d.type==='toggle')return !!v;
    if(d.type==='range'){v=+v;if(!isFinite(v))return d.def;v=Math.min(d.max,Math.max(d.min,v));return +(Math.round(v/d.step)*d.step).toFixed(3)}
    const ok=d.options.some(o=>o.v===v);return ok?v:d.def;
  }
  function get(key){const d=byKey[key];if(!d)return undefined;return key in vals?clean(d,vals[key]):d.def}
  function set(key,v,silent){
    const d=byKey[key];if(!d)return;v=clean(d,v);
    if(vals[key]===v)return;vals[key]=v;save();
    if(!silent)for(const fn of listeners){try{fn(key,v)}catch(e){}}
  }
  function reset(sec){for(const d of def){if(!sec||d.section===sec){if(d.key in vals){delete vals[d.key];for(const fn of listeners){try{fn(d.key,d.def)}catch(e){}}}}}save()}
  function on(fn){listeners.push(fn)}
  function all(){const o={};for(const d of def)o[d.key]=get(d.key);return o}
  function matchOptions(){
    const o={};for(const k of Object.keys(OPT_DEFAULTS))o[k]=get('match.'+k);
    return normalizeOpts(o);
  }
  const presets=[
    {id:'classic',label:'Classic',desc:'The balanced default.',values:{}},
    {id:'party',label:'Party',desc:'Wild hazards, big knockback, fast dashes.',values:{hazard:'wild',knockback:1.4,dash:'fast',damage:1.2,speed:1.1}},
    {id:'brawl',label:'Brawl',desc:'Heavy hits, fast fighters, small ring.',values:{damage:1.6,speed:1.15,knockback:1.2,hazard:'mild',aiAggr:1.4,dash:'fast',arena:.9}},
    {id:'chill',label:'Chill',desc:'Gentle bots, mild hazards, long rounds.',values:{difficulty:'rookie',hazard:'mild',length:'long',aiAggr:.7,aiReact:1.5,knockback:.8,assist:.9}}
  ];
  function apply(p){
    if(typeof p==='string')p=presets.find(x=>x.id===p);if(!p)return;
    for(const d of def){
      if(d.section!=='match'||d.key==='match.map'||d.key==='match.fighters'||d.key==='match.mode'||d.key==='match.players')continue;
      const k=d.key.slice(6);set(d.key,k in p.values?p.values[k]:d.def);
    }
  }
  function randomize(){
    const pick=a=>a[(Math.random()*a.length)|0];
    set('match.map',pick(MAP_ORDER));
    set('match.difficulty',pick(['rookie','easy','normal','hard','legend','mixed']));
    set('match.hazard',pick(['mild','normal','wild']));
    set('match.length',pick(['short','normal','long']));
    set('match.arena',.85+((Math.random()*8)|0)*.05);
    set('match.knockback',.8+((Math.random()*9)|0)*.1);
    set('match.damage',.8+((Math.random()*9)|0)*.1);
    set('match.dash',pick(['fast','normal','normal','slow']));
  }
  function flag(name,v){if(v===undefined)return !!flags[name];flags[name]=!!v;save();return !!v}
  load();
  return {def,sections,get,set,reset,on,all,matchOptions,presets,apply,randomize,flag,byKey,KEY};
})();
