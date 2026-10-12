/* ============================================================================
   ROYAL SUMO - MAIN  (game loop, camera director, event routing, public API)
   Match rules, seating, seeds and the Crown Cup live in core/ (Session, SlotTable, Control); this file only
   builds the Sim a plan describes, runs it, draws it, and exposes window.RoyalSumo.
   ========================================================================== */
import {clamp, damp} from '../core/util.js';
import {FIXED_DT, TUNE} from '../core/tune.js';
import {MAPS, MAP_ORDER} from '../core/maps.js';
import {Sim} from '../core/sim.js';
import {VERSIONS} from '../core/versions.js';
import {SlotTable} from '../core/slots.js';
import {RemoteInputs} from '../core/remote.js';
import {Session, simOptions} from '../core/session.js';
import {Control} from '../core/control.js';
import {QualityGovernor} from '../core/quality.js';
import {M4} from '../gfx/engine.js';
import {Renderer} from '../gfx/gfx_core.js';
import {FighterRig, STYLES} from '../gfx/gfx_fighter.js';
import {FX} from '../gfx/gfx_fx.js';
import {buildScene} from '../gfx/gfx_maps.js';
import '../gfx/gfx_maps2.js';   // side effect: registers the WHARF / TEETER / MESA scene builders
import {Settings} from '../core/settings.js';
import {Sound} from './audio.js';
import {Controls} from './controls.js';
import {UI} from './ui.js';
(function(){
const Q=new URLSearchParams(location.search);
const safe=(fn)=>{try{return fn()}catch(e){if(window.__rsDebug)console.warn(e);return undefined}};
const gv=(key,def)=>{const v=safe(()=>Settings.get(key));return v!==undefined?v:def};
const $=id=>document.getElementById(id);

let canvas,uiRoot,flashEl,R,fx,rig,rigDraw,scene=null,sim=null;
let menuScreen='title',mode='menu',paused=false,menuMap='keep',lastT=0,time=0,hitStop=0,slowT=0,slowK=1,matchEndT=-1,gfxDead=false;
let fpsAcc=0,fpsN=0,fps=60;
const view={phase:'intro',round:1,winTarget:3,n:4,map:'keep',difficulty:'normal',crowns:[],alive:[],names:[],colors:[],owners:[],humans:[],locals:[],humanId:-1,hazard:null,sudden:false,
  me:{stab:100,state:'idle',charge:0,chargeFull:false,dashCd01:1,dashOn:true,alive:true},timeSec:0};
const ctl={mx:0,mz:0,bashDown:false,dash:false};
const ctl2={mx:0,mz:0,bashDown:false,dash:false};
const LOCAL={p1:ctl,p2:ctl2};
const kb={keys:{},dash:false};
let renderScale=1,dprCap=1.5;
const CAREER_KEY='royalSumo.career';
let career={matches:0,wins:0,kos:0,cups:0};
const store=(()=>{try{const s=window.localStorage,k='royalSumo.probe';s.setItem(k,'1');s.removeItem(k);return s}catch(e){return null}})();
try{const c=JSON.parse((store&&store.getItem(CAREER_KEY))||'null');if(c&&typeof c==='object')career=Object.assign(career,c)}catch(e){}
function saveCareer(){try{if(store)store.setItem(CAREER_KEY,JSON.stringify(career))}catch(e){}safe(()=>UI.setCareer(career))}

/* ------------------------------------------------- seating, seeds, cup ----- */
const slots=new SlotTable({storage:store});
const session=new Session({slots,maps:MAP_ORDER,urlSeed:Q.get('seed')});
const remote=new RemoteInputs();
const gov=new QualityGovernor({enabled:true});
const control=new Control({session,slots,remote,now:()=>performance.now(),host:{sim:()=>sim,launch:(plan,how)=>launch(plan,how),baseOptions:()=>matchOpts(),seatsChanged:()=>seatsChanged()}});
const beltOf=(f,i)=>STYLES[((f&&f.style>=0)?f.style:i)%STYLES.length].belt;
const p1Seat=()=>sim?control.deviceSeat('p1',sim):-1;
function seatsChanged(){if(sim)safe(()=>Controls.setSplit(control.isSplit(sim)))}

/* ------------------------------------------------------------ input ----- */
function kbBind(){
  addEventListener('keydown',e=>{
    if(!e.repeat&&(e.code==='ShiftRight'||e.code==='Period'||e.code==='Numpad0'))kb.dash2=true;
    if(e.repeat)return;kb.keys[e.code]=true;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyK'||e.code==='KeyL')kb.dash=true;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&mode==='game')e.preventDefault();
  });
  addEventListener('keyup',e=>{kb.keys[e.code]=false});
  addEventListener('blur',()=>{kb.keys={}});
}
function readP2(){
  const k=kb.keys;let x=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0),z=(k.ArrowDown?1:0)-(k.ArrowUp?1:0);
  let bash=!!(k.Enter||k.NumpadEnter||k.Slash),dash=kb.dash2;kb.dash2=false;
  try{const l=navigator.getGamepads?navigator.getGamepads():[];const pads=[];for(const g of l)if(g&&g.connected)pads.push(g);
    const pad=pads[1];if(pad){const ax=pad.axes[0]||0,ay=pad.axes[1]||0,m=Math.hypot(ax,ay);if(m>.2&&!x&&!z){x=ax;z=ay}
      const B=i=>!!(pad.buttons[i]&&pad.buttons[i].pressed);bash=bash||B(0)||B(2);const d=B(1)||B(3)||B(5)||B(7);if(d&&!kb.pd2)dash=true;kb.pd2=d}}catch(e){}
  const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}
  ctl2.mx=x;ctl2.mz=z;ctl2.bashDown=bash;ctl2.dash=dash;
}
function readInput(dt){
  const c=Controls.update(dt);ctl.mx=c.mx;ctl.mz=c.mz;ctl.bashDown=c.bashDown;ctl.dash=c.dash;
}

/* --------------------------------------------------------- graphics ----- */
function initGfx(){
  if(R)R.detach();                                   // one live pair of context listeners, however often the context is lost
  R=new Renderer(canvas,{aa:true,preserve:!!Q.get('preserve')});
  R.onLost=()=>{gfxDead=true};
  // After a restore every GL object from before is invalid: forget the scene without deleting it, then rebuild everything.
  R.onRestored=()=>{try{scene=null;initGfx();rebuildScene();gfxDead=false}catch(e){console.error(e)}};
  fx=new FX(R);rig=new FighterRig(R);rigDraw=rig.list.concat(rig.faceList);
  applyGfx();onResize();
}
/** Render resolution = the player's scale x quality tier x whatever Auto Quality has settled on. */
function computeScale(){
  const q=gv('gfx.quality','medium'),sc=+gv('gfx.scale',1);
  const auto=gv('gfx.auto',true)?gov.k:1;
  dprCap=q==='low'?1:(q==='high'?2:1.6);
  return sc*auto*(q==='low'?.7:(q==='high'?1:.9));
}
function applyGfx(){
  if(!R)return;
  renderScale=computeScale();
  R.settings.outline=gv('gfx.outline',true)!==false;
  R.settings.shake=+gv('gfx.shake',1)*(gv('acc.reduceMotion',false)?.25:1);
  R.cam.zoomPref=1/Math.max(.5,+gv('gfx.zoom',1));
  fx.setQuality(gv('gfx.particles','normal'));fx.reduceFlash=!!gv('acc.reduceFlash',false);
  onResize();
}
function onResize(){
  if(!R)return;
  R.resize(innerWidth,innerHeight,Math.min(window.devicePixelRatio||1,dprCap),renderScale);
  safe(()=>Controls.layout());
}
function snapCam(){
  const c=R.cam,asp=R.aspect||1,portrait=asp<.85;
  c.shiftY=portrait?.16:(asp<1.3?.08:0);c.pitch=(portrait?.95:.86)*c.pitchPref;c.R=scene.viewR(sim);
  c.dist=R.fitDist(c.R,c.pitch,asp,c.shiftY,c.fov,c.margin)*c.zoomPref;c.tx=0;c.tz=0;c.trauma=0;c.punch=0;
}
/** Free the GPU objects of the current scene. Dropping the JS reference alone does not release them (this leaked ~12 VAOs per round). */
function dropScene(){if(scene){try{scene.dispose()}catch(e){}scene=null}}
function rebuildScene(){
  if(!R||!sim||!sim.arena)return;
  dropScene();
  scene=buildScene(R,sim);
  R.setTheme(scene.theme);fx.clear();fx.dust=scene.theme.dust;fx.floorY=scene.floorY;rig.reset();rig.setStage(null);
  snapCam();
}

/* --------------------------------------------------------- match flow --- */
function matchOpts(){return safe(()=>Settings.matchOptions())||undefined}
/** Build and start the Sim a Session plan describes.  how: 'game' (HUD + music) | 'menu' (title-screen attract match) */
function launch(plan,how){
  const menu=how==='menu';
  sim=new Sim(simOptions(plan));
  for(let i=0;i<10;i++)remote.clear(i);            // a new match starts with clean sticks and sequence numbers
  sim.startMatch();
  mode=menu?'menu':'game';paused=false;matchEndT=-1;hitStop=0;slowT=0;dropScene();
  seatsChanged();
  rebuildFromSim();
  if(!menu){safe(()=>UI.show('game'));safe(()=>{Sound.unlock();Sound.music(plan.opts.map,{intensity:0})})}
}
function rebuildFromSim(){const evs=sim.drain();for(const e of evs)route(e);if(!scene||scene.sim!==sim){dropScene();rebuildScene()}}
function startDemo(mapId){menuMap=mapId||menuMap;control.startDemo(menuMap)}
function menuStart(opts,f){
  control.startFromMenu(opts,{mode:(f&&f.mode)||gv('match.mode','quick'),players:((f&&f.players)||+gv('match.players',1))>=2?2:1});
}
function toTitle(){
  mode='menu';paused=false;control.quitToTitle();
  safe(()=>Sound.music(menuMap,{intensity:0}));
  startDemo(menuMap);
  safe(()=>UI.showPause(false));safe(()=>UI.show('title'));
}
function setPaused(p){
  if(mode!=='game')return;paused=p;
  safe(()=>UI.showPause(p));
  safe(()=>Sound.ui(p?'pause':'resume'));
}

/* ------------------------------------------------------------ events ----- */
const _pr={x:0,y:0};
function proj(x,y,z){const p=R.project(x,y,z,_pr);return p?{x:p.x,y:p.y}:null}
const isMe=(e,ps)=>ps>=0&&(e.id===ps||e.src===ps||e.dst===ps||e.a===ps||e.b===ps);
function evInfo(e){
  let x=e.x,z=e.z;
  if(x===undefined&&e.id!==undefined&&sim.fighters[e.id]){x=sim.fighters[e.id].x;z=sim.fighters[e.id].z}
  let pan=0,near=.6;
  if(x!==undefined&&R){const p=R.project(x,.5,z,{});if(p){pan=clamp((p.x-.5)*1.7,-1,1);near=clamp(1.2-Math.hypot(p.x-.5,p.y-.5)*1.6,.15,1)}}
  return {pan,near,me:isMe(e,p1Seat()),n:sim.n};
}
function route(e){
  if(e.type==='roundStart'){dropScene();rebuildScene();matchEndT=-1;if(mode==='game')safe(()=>Sound.intensity(0))}
  if(e.type==='matchEnd'&&mode==='game')matchEndT=2.6;
  if(!scene||!fx)return;
  fx.onEvent(e,sim,scene);scene.onEvent(e,sim,fx);rig.onEvent(e);
  const ps=p1Seat(),me=ps>=0&&(e.id===ps||e.src===ps||e.dst===ps);
  const hs=gv('gfx.hitstop',true)&&mode==='game';
  switch(e.type){
    case 'hit':{
      const k=e.tier==='light'?0:(e.tier==='medium'?1:(e.tier==='heavy'?2:3)),w=me?1:.65;
      R.addTrauma([.07,.17,.34,.58][k]*w);
      if(hs)hitStop=Math.max(hitStop,[0,.028,.06,.105][k]*w);
      if(k>=2)R.cam.punch=Math.max(R.cam.punch,.35+.2*k);
      if(k>=3){slowT=Math.max(slowT,.32);slowK=.45;flash(.5)}
      if(me)safe(()=>Controls.haptic(['light','light','medium','heavy'][k]));
      break}
    case 'knockdown':R.addTrauma(.22);break;
    case 'drop':R.addTrauma(.2);break;
    case 'sudden':R.addTrauma(.3);break;
    case 'meteorHit':R.addTrauma(.5);if(hs)hitStop=Math.max(hitStop,.05);break;
    case 'shock':R.addTrauma(.25);break;
    case 'bumper':R.addTrauma(.12);break;
    case 'sweep':R.addTrauma(.3);if(hs)hitStop=Math.max(hitStop,.04);break;
    case 'land':if(e.speed>6)R.addTrauma(.05);break;
    case 'out':if(me)safe(()=>Controls.haptic('ko'));break;
    case 'roundEnd':slowT=Math.max(slowT,.9);slowK=.4;if(ps>=0&&e.winner===ps)safe(()=>Controls.haptic('win'));break;
    case 'matchEnd':matchEndT=2.6;slowT=Math.max(slowT,.8);slowK=.4;break;
  }
  if(mode==='game')safe(()=>Sound.event(e,evInfo(e)));
  if(mode==='game')safe(()=>UI.onEvent(e,view,proj));
}
function flash(a){
  if(!flashEl||gv('acc.reduceFlash',false))return;
  flashEl.style.transition='none';flashEl.style.opacity=String(a*.55);
  requestAnimationFrame(()=>{flashEl.style.transition='opacity .22s ease-out';flashEl.style.opacity='0'});
}

/* -------------------------------------------------------------- frame ----- */
function fillView(){
  const s=sim,v=view,n=s.n;
  v.phase=s.phase;v.round=s.round;v.winTarget=s.winTarget;v.n=n;v.map=s.map.id;v.difficulty=s.difficulty;v.timeSec=s.t;
  v.humans.length=0;v.locals.length=0;
  for(let i=0;i<n;i++){const o=s.seats[i].owner;v.owners[i]=o;if(o!=='bot')v.humans.push(i);if(o==='local')v.locals.push(i)}
  v.owners.length=n;
  const ps=control.deviceSeat('p1',s);v.humanId=ps;
  v.cup=session.cup?{s:session.cup.stage+1,n:session.cup.order.length}:null;v.sudden=!!(s.arena&&s.arena.sudden);v.hazard=s.arena?s.hudInfo():null;
  v.crowns=s.crowns.slice(0,n);
  for(let i=0;i<n;i++){const f=s.fighters[i];v.alive[i]=!!f&&f.alive&&!f.falling;v.names[i]=f?f.name:'';v.colors[i]=beltOf(f,i)}
  v.alive.length=v.names.length=v.colors.length=n;
  const f=ps>=0?s.fighters[ps]:null;
  if(f){const m=v.me;m.stab=f.stab;m.state=f.state;m.charge=f.charge;m.chargeFull=f.chargeFull;m.dashCd01=s.P.dashCd>0?1-clamp(f.dashCd/s.P.dashCd,0,1):1;m.dashOn=s.P.dashOn;m.alive=f.alive&&!f.falling}
}
function updateLabels(alpha){
  const list=view._labels||(view._labels=[]);list.length=0;
  const W=innerWidth,H=innerHeight;
  for(let i=0;i<sim.n;i++){
    const f=sim.fighters[i];if(!f)continue;
    const x=f.px+(f.x-f.px)*alpha,z=f.pz+(f.z-f.pz)*alpha,y=f.py+(f.y-f.py)*alpha;
    let sy=2.35;if(scene&&scene.stage){const o=[0,0,0];M4.xformPoint(scene.stage,x,y+sy,z,o);const p=R.project(o[0],o[1],o[2],_pr);list.push(lab(i,f,p,W,H));continue}
    const p=R.project(x,y+sy,z,_pr);list.push(lab(i,f,p,W,H));
  }
  safe(()=>UI.labels(list));
}
function lab(i,f,p,W,H){
  const owner=sim.seats[i].owner;
  return {id:i,name:f.name,color:beltOf(f,i),x:p?p.x*W:-999,y:p?p.y*H:-999,show:!!p&&f.alive&&!f.falling&&f.y>-1,you:owner==='local',net:owner==='remote',glyph:i%8,stab:f.stab,state:f.state};
}
function focusPoint(){
  if(gv('gfx.cam','dynamic')==='fixed')return null;
  let sx=0,sz=0,n=0;for(const f of sim.fighters){if(f.alive&&!f.falling){sx+=f.x;sz+=f.z;n++}}
  return n?{x:sx/n,z:sz/n}:null;
}
function frame(ts){
  requestAnimationFrame(frame);
  if(!R||gfxDead||!sim)return;
  const now=ts/1000,rawDt=now-lastT;let dt=Math.min(.05,rawDt);lastT=now;if(dt<=0)return;
  time+=dt;
  // fps counter + Auto Quality (only frames of a live match count; the governor owns every rule about when to step)
  fpsAcc+=Math.min(rawDt,1);fpsN++;           // honest meter: a 200 ms frame must read as 5 fps, not as the 50 ms the simulation is clamped to
  if(fpsAcc>=.5){fps=fpsN/fpsAcc;fpsAcc=0;fpsN=0;safe(()=>UI.setFps(Math.round(fps),gv('gfx.auto',true)?gov.k:1))}
  if(gv('gfx.auto',true)){
    const k=gov.update(rawDt,mode==='game'&&!paused&&!document.hidden);
    if(k!==null)applyGfx();
  }
  const running=!paused;
  // sim time scaling (hit-stop / slow-mo)
  let sdt=dt;
  if(hitStop>0){hitStop-=dt;sdt=0}
  else if(slowT>0){slowT-=dt;sdt=dt*slowK}
  if(mode==='game'&&!paused){
    readInput(dt);
    if(control.deviceSeat('p2',sim)>=0)readP2();
    control.routeInputs(sim,LOCAL,performance.now());
    const ps=p1Seat(),f=ps>=0?sim.fighters[ps]:null,m=view.me;
    safe(()=>Controls.setHud(f?{charge:m.charge,chargeFull:m.chargeFull,dashCd01:m.dashCd01,dashOn:m.dashOn,bashReady:f.bashCd<=0.001,alive:m.alive,active:sim.phase==='fight'||sim.phase==='countdown'}
      :{charge:0,chargeFull:false,dashCd01:1,dashOn:false,bashReady:false,alive:false,active:false}));
  }
  if(running)sim.advance(sdt);
  const evs=sim.drain();for(const e of evs)route(e);
  if(!sim)return;
  if(mode==='game'&&matchEndT>=0){matchEndT-=dt;if(matchEndT<0)showResults()}
  // intensity for music
  if(mode==='game'&&sim.phase==='fight'&&(time*4|0)!==((time-dt)*4|0)){
    const alive=sim.alive();safe(()=>Sound.intensity(clamp((sim.n-alive)/Math.max(1,sim.n-1)*.7+(sim.arena&&sim.arena.sudden?.4:0),0,1)));
  }
  fillView();
  const alpha=running&&sdt>0?clamp(sim.acc/FIXED_DT,0,1):1;
  // camera
  if(mode==='menu'&&menuScreen==='setup'){const por=innerWidth/innerHeight<1.3;R.cam.menuView=por?{x:0,y:.52,zoom:1}:{x:.62,y:0,zoom:1.7}}else R.cam.menuView=null;
  if(mode==='menu'){R.cam.orbit=Math.sin(time*.12)*.22;R.cam.mode='menu'}else{R.cam.orbit=0;R.cam.mode='game'}
  if(scene)R.cam.R=damp(R.cam.R,scene.viewR(sim),2.4,dt);
  R.beginFrame(dt);
  R.updateCamera(dt,sim,focusPoint());
  if(!scene)return;
  fx.update(dt);
  scene.update(sim,alpha,dt,fx);
  rig.setStage(scene.stage);rig.update(sim,dt,alpha,fx,time);
  fx.shadows(sim,alpha);fx.flush();
  R.drawSky();R.drawLiquid();scene.draw();R.drawToon(rigDraw);R.drawFx(fx.alpha,fx.addb);
  if(mode==='game'){updateLabels(alpha);safe(()=>UI.frame(view,dt))}
  R.stats.fps=fps;
}
function showResults(){
  const s=sim,n=s.n,names=[],colors=[],owners=[],humans=[],locals=[];
  for(let i=0;i<n;i++){
    const f=s.fighters[i],o=s.seats[i].owner;
    names.push(f?f.name:'P'+(i+1));colors.push(beltOf(f,i));owners.push(o);
    if(o!=='bot')humans.push(i);if(o==='local')locals.push(i);
  }
  const base={n,winner:s.matchWinner,crowns:s.crowns.slice(0,n),stats:s.stats.slice(0,n)};
  const res={winner:s.matchWinner,crowns:base.crowns,names,colors,stats:base.stats,map:s.map.id,difficulty:s.difficulty,n,round:s.round,
    humans,locals,owners,ranking:session.rank(base),seed:s.seed};
  const solo=locals.length===1&&humans.length===1;                        // one person against the bots
  if(session.cup){
    res.cup=session.finishCupStage(base);
    if(res.cup.last&&solo&&res.cup.champs.length===1&&res.cup.champs[0]===locals[0]&&!s.careerCounted)career.cups++;
  }
  if(solo&&!s.careerCounted){career.matches++;if(s.matchWinner===locals[0])career.wins++;career.kos+=(s.stats[locals[0]]&&s.stats[locals[0]].kos)|0}
  s.careerCounted=true;
  saveCareer();res.career=Object.assign({},career);
  safe(()=>UI.showResults(res));
  const champs=res.cup&&res.cup.last?res.cup.champs:[s.matchWinner];
  const winHuman=champs.some(c=>c>=0&&humans.indexOf(c)>=0);
  safe(()=>Sound.ui(winHuman?'win':'lose'));
}

/* ------------------------------------------------------------- boot ------ */
function showFatal(msg){
  const d=document.createElement('div');
  d.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;color:#fff4d6;font:800 20px system-ui,sans-serif;background:#1b1030;z-index:99';
  d.textContent=msg;document.body.appendChild(d);
}
function boot(){
  canvas=$('game');uiRoot=$('ui');flashEl=$('flash');kbBind();
  gov.setEnabled(!!gv('gfx.auto',true));
  try{initGfx()}catch(e){console.error(e);showFatal('Royal Sumo needs WebGL2, which this browser could not start. Try a recent Chrome, Safari 15+ or Firefox.');return}
  const hooks={
    startMatch:o=>menuStart(o),nextStage:()=>control.nextStage(),rematch:()=>control.rematch(),
    restartMatch:()=>{paused=false;safe(()=>UI.showPause(false));if(session.cup)control.restart();else control.rematch()},
    quitToTitle:()=>toTitle(),pause:()=>setPaused(true),resume:()=>setPaused(false),
    previewMap:id=>{if(mode==='menu'&&id!==menuMap)startDemo(id)},
    previewLook:()=>{if(mode==='menu')startDemo(menuMap)},
    settingChanged:(k,v)=>{
      if(k==='gfx.auto')gov.setEnabled(!!v);
      applyGfx();
      if(/^aud\./.test(k))applyAudio();
      if(/^ctl\./.test(k))safe(()=>Controls.layout());
    },
    screen:n=>{menuScreen=n},
    sfx:n=>safe(()=>Sound.ui(n))
  };
  safe(()=>Settings.on((k,v)=>hooks.settingChanged(k,v)));
  safe(()=>Controls.init(uiRoot,{pause:()=>setPaused(!paused)}));
  safe(()=>{Sound.init();applyAudio()});
  safe(()=>UI.init({root:uiRoot,hooks,slots,versions:VERSIONS}));safe(()=>UI.setCareer(career));
  menuMap=Q.get('map')||gv('match.map','keep');if(!MAPS[menuMap])menuMap='keep';
  addEventListener('resize',onResize);addEventListener('orientationchange',()=>setTimeout(onResize,150));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='game'&&!paused)setPaused(true)});
  document.addEventListener('contextmenu',e=>e.preventDefault());
  const unlock=()=>safe(()=>Sound.unlock());
  addEventListener('pointerdown',unlock,{passive:true});addEventListener('keydown',unlock);
  // start
  if(Q.get('autostart')){
    const o=Object.assign({},matchOpts());
    for(const k of['map','difficulty','hazard','length','dash'])if(Q.get(k))o[k]=Q.get(k);
    for(const k of['fighters','winTarget'])if(Q.get(k))o[k]=+Q.get(k);
    for(const k of['arena','knockback','damage','speed','assist','aiAggr','aiReact'])if(Q.get(k))o[k]=+Q.get(k);
    const players=+Q.get('players')||1;
    if(Q.get('cup')==='1')menuStart(o,{mode:'cup',players});
    else if(Q.get('demo')==='1')control.scenario(Object.assign({},o,{demo:true}));
    else menuStart(o,{mode:'quick',players});
    safe(()=>UI.show('game'));
  }else{
    startDemo(menuMap);
    safe(()=>UI.show('title'));
  }
  lastT=performance.now()/1000;requestAnimationFrame(frame);
}
function applyAudio(){
  Sound.setVolumes({master:+gv('aud.master',.8),music:+gv('aud.music',.6),sfx:+gv('aud.sfx',.9),mute:!!gv('aud.mute',false)});
}

/* ----------------------------------------------------------- public API -- */
const API={
  version:VERSIONS.build,versions:VERSIONS,protocol:VERSIONS.protocol,tuning:TUNE,
  getState:()=>control.state(),
  scenario:o=>{control.scenario(o);return control.state()},
  restart:o=>{control.restart(o);return control.state()},
  resume:()=>setPaused(false),
  setSeed:v=>control.setSeed(v),
  multiplayer:control.multiplayerApi(),
  debug:{
    sim:()=>sim,scene:()=>scene,renderer:()=>R,fx:()=>fx,control:()=>control,slots:()=>slots,session:()=>session,governor:()=>gov,settings:()=>Settings,sound:()=>Sound,
    stats:()=>({draws:R.stats.draws,fps,scale:renderScale,auto:gov.info(),particles:fx.P.length,phase:sim.phase,t:sim.t,paused,mode,menu:menuScreen}),
    advance:(sec)=>{let n=Math.round(sec*120);while(n-->0){control.routeInputs(sim,LOCAL,performance.now());sim.step(FIXED_DT);const ev=sim.drain();for(const e of ev)route(e)}hitStop=0;slowT=0},
    startGame:(o,d)=>{control.scenario(Object.assign({},o||{},d||{}));return control.state()},
    setMode:(m)=>{mode=m},toTitle:()=>toTitle(),
    cam:()=>R.cam,showResults:()=>showResults(),cupState:()=>session.cup
  }
};
window.RoyalSumo=API;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
