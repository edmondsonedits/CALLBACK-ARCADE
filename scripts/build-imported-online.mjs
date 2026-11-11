/** Static source extraction. The Worker loads generated ES modules, never eval/VM/DOM.
 * Physics declarations are copied from the pinned active games. Only browser effects,
 * mesh fields and scheduling are removed; the authoritative adapter drives native
 * functions at four 120 Hz substeps per 30 Hz tick. Run after changing source games.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import {bridges} from '../lib/arcade/online/imported-bridges.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'lib/arcade/online');
const printer=ts.createPrinter({removeComments:false});
const parse=s=>ts.createSourceFile('source.js',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function inventory(source){
 const file=parse(source),defs=new Map();
 for(const n of file.statements){
  if((ts.isFunctionDeclaration(n)||ts.isClassDeclaration(n))&&n.name)defs.set(n.name.text,{node:n});
  if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(ts.isIdentifier(d.name))defs.set(d.name.text,{node:d,flags:n.declarationList.flags});
 }
 return {file,defs};
}
const names=n=>{const a=new Set();function walk(x){if(ts.isIdentifier(x))a.add(x.text);ts.forEachChild(x,walk)}walk(n);return a};
const effects=new Set('textSprite buildDummy buildCage say vibrate beep burst updateHUD clearInput spawnParticles impactRing tone noise sfxHit sfxOut sfxWin sfxJump sfxDuck sfxClear triggerFlash pollGamepads haptic sfxFall sfxLap sfxFinish spark ringFX hitFlash impactFeedback updateRaceBanner showRaceBanner revealFinish neutralizeInput neutralizeLocal ensureRoster hud ring renderHud renderPhraseProgress setStatus setControlMode refreshHighwayBounds stopAudio initAudio ping buzz fanfare pressVisual burstLane playDjEvent updateBeatGuide'.split(' '));
const browser=new Set('$ document navigator window vis visual canvas ctx viewport loading hitFlash messageEl countdownEl roundEl timerEl aliveEl hpText hpFill tileText tileFill msg countdown playersEl difficultyEl roundLabel youScoreEl winsScoreEl livesText lifePips speedValue jumpBtn duckBtn hitFlash roundLabel reactionCue playerCountEl racerCountEl lapSetting raceBanner finishOverlay pauseOverlay finishPlace finishCopy joyKnob soundBtn controls menu results bigMsg smallMsg phraseProgress hud statusPill scene hazardGroup'.split(' '));
const renderFields=new Set(['visual','rollQuat','rollAxis']);
const isPresentation=n=>{
 if(ts.isIdentifier(n)&&browser.has(n.text)&&!['window','difficultyEl','racerCountEl','lapSetting','playersEl','playerCountEl'].includes(n.text))return true;
 if(ts.isPropertyAccessExpression(n)&&renderFields.has(n.name.text))return true;
 if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&['buildDummy','buildCage','textSprite','setTimeout','clearTimeout'].includes(n.expression.text))return true;
 return false;
};
function containsPresentation(n){let yes=false;function walk(x){if(x!==n&&(ts.isArrowFunction(x)||ts.isFunctionExpression(x)))return;if(ts.isPropertyAssignment(x)){if(!renderFields.has(x.name.getText()))walk(x.initializer);return;}if(ts.isShorthandPropertyAssignment(x)&&renderFields.has(x.name.text))return;if(isPresentation(x))yes=true;ts.forEachChild(x,walk)}walk(n);return yes}
function transform(node,file){
 const result=ts.transform(node,[context=>{
  const visit=n=>{
   if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='difficultyEl'&&n.name.text==='value')return ts.factory.createIdentifier('botDifficulty');
   if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='lapSetting'&&n.name.text==='value')return ts.factory.createIdentifier('targetLaps');
   if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='racerCountEl'&&n.name.text==='value')return ts.factory.createIdentifier('activeRacerCount');
   if(ts.isExpressionStatement(n)&&containsPresentation(n))return ts.factory.createEmptyStatement();
   if(ts.isPropertyAssignment(n)&&renderFields.has(n.name.getText(file)))return undefined;
   if(ts.isShorthandPropertyAssignment(n)&&renderFields.has(n.name.text))return undefined;
   if(ts.isVariableDeclaration(n)&&n.initializer&&containsPresentation(n.initializer))return undefined;
   if(ts.isVariableStatement(n)){
    const kept=n.declarationList.declarations.map(d=>visit(d)).filter(Boolean);
    return kept.length?ts.factory.updateVariableStatement(n,n.modifiers,ts.factory.updateVariableDeclarationList(n.declarationList,kept)):ts.factory.createEmptyStatement();
   }
   if(ts.isPropertyAccessExpression(n)&&containsPresentation(n))return ts.factory.createFalse();
   return ts.visitEachChild(n,visit,context);
  };return n=>ts.visitNode(n,visit);
 }]);
 const r=printer.printNode(ts.EmitHint.Unspecified,result.transformed[0],file);result.dispose();return r;
}
function extract(source,roots,overrides={}){
 const {file,defs}=inventory(source),selected=new Set();
 function add(name){if(selected.has(name)||!defs.has(name))return;selected.add(name);if(overrides[name]!==undefined||effects.has(name)||browser.has(name))return;for(const d of names(defs.get(name).node))if(d!==name)add(d)}
 roots.forEach(add);
 const pieces=[];
 for(const [name,d]of defs)if(selected.has(name)&&!browser.has(name)){
  if(overrides[name]!==undefined){pieces.push(overrides[name]);continue;}
  if(effects.has(name)){pieces.push(`function ${name}(){}`);continue;}
  const n=ts.isVariableDeclaration(d.node)?ts.factory.createVariableStatement(undefined,ts.factory.createVariableDeclarationList([d.node],d.flags)):d.node;
  pieces.push(transform(n,file));
 }
 for(const [name,code]of Object.entries(overrides))if(!defs.has(name))pieces.push(code);
 return pieces.join('\n');
}
// Copy only actual Three.js math dependencies. No rendering class or browser shim.
const mathSource=fs.readFileSync(path.join(root,'public/arcade-games/royal-roller-ruckus/vendor/three/three.core.js'),'utf8');
const math=extract(mathSource,['Vector3','Quaternion','CatmullRomCurve3']);
fs.writeFileSync(path.join(out,'imported-math.mjs'),'/* eslint-disable @typescript-eslint/no-unused-vars -- pinned third-party math extraction. */\n/** @license Copyright 2010-2025 Three.js Authors. SPDX-License-Identifier: MIT.\n * Static extraction from pinned Three.js r180; original license remains in vendor/three/LICENSE. */\n'+math+'\nexport {Vector3,Quaternion,CatmullRomCurve3};\n');
const manifests=[
 {id:'space',folder:'space-bash',start:'const GRID=',end:'const spaceArenas=',
  roots:'resetRound step grabThrow kick jump drive ai',
  state:'ROUND_TIME TUNE arcadeArena arcadeWins arcadeMeteorTimer arcadeMeteors playerCount difficulty tiles fighters crates particles phase phaseT round timeLeft wins spawnT powerT paused flash crateId',
  overrides:{clearInput:'function clearInput(){}',performance:'',step:null}},
 {id:'twisted',folder:'royal-twisted',start:'const VERSION=',end:'const twistedArenas=',
  roots:'createFighters resetRound fixedUpdate updatePhase requestJump setDuck',
  state:'TUNING MAX_LIVES arcadeTwistedArena playerCount round roundWins phase phaseTimer roundTime paused nextSpawn hazardId globalScore bestScore cameraShake patternQueue activePattern lastSpawnType choreographyStats fighters hazards lastRoundWinner',
  overrides:{createHazard:'function createHazard(type,t=.965){const h={id:++hazardId,type,t,checked:new Set(),warned:false};hazards.push(h);return h}',positionHazard:'function positionHazard(){}',playerCount:'let playerCount=10;',pollGamepads:'function pollGamepads(){}'}},
 {id:'roller',folder:'royal-roller-ruckus',start:'const VERSION=',end:'const rollerArenas=',
  roots:'buildCurve buildCourseZones createRacers fixedUpdate updatePhase raceProgress',
  state:'TUNING arcadeRollerArena arcadeRollerView racers phase phaseTimer raceTime targetLaps activeRacerCount paused finished finishOrder checkpointNotice finalLapAnnounced finishRevealTimer bannerTimer playerFinishTime playerFinishGap cameraShake',
  overrides:{samplePlayerInput:'function samplePlayerInput(id=0){const i=onlineInputs[ids[id]]||{};const v=radialDeadzone(clamp(i.x||0,-1,1),clamp(i.y||0,-1,1),TUNING.input.deadzone);return {moveX:v.x,moveY:v.y}}',cameraBasis:'function cameraBasis(){return {f:new THREE.Vector3(0,0,-1),right:new THREE.Vector3(1,0,0)}}',participatingHumans:'function participatingHumans(){return racers;}',fixedUpdate:null}},
 {id:'scratch',folder:'royal-scratch-match',start:'const LANES =',end:'const params=',
  roots:'initPlayers createPhrase updateGame tryPlayerHit endRound startPhrase',
  state:'TUNING arcadeScratchArena phase difficulty playerCount humanSlots countdownAt countdownStage songTime notes players particles sparks screenShake beatPulse lastBeatIndex finishQueued flash hitText eliminationCounter menuTime phraseIndex phraseBpm phraseBeat phaseClock humanPhraseMisses roundStartedAt totalInputs totalResolved configuredSeed randomState',
  overrides:{kick:'function kick(){}',gameClock:'function gameClock(){return now;}',queueRoundEnd:'function queueRoundEnd(delay=TUNING.round.endDelay){if(finishQueued)return;finishQueued=true;phase="finishing";phaseClock=gameClock();endAt=now+delay;}',endRound:null}},
 {id:'ball',folder:'royal-ballistix',start:"var arcadeBallArena=",end:'window.GameDebug=',
  roots:'makeP refreshArenaGeometry step phase endCheck startMag releaseMag pulse arcadeBallPhysics arcadeBallBumpers',
  state:'TUNING arcadeBallArena arcadeBallTime arcadeBallCrowns S G P',
  overrides:{endCheck:'function endCheck(){if(G.phase!=="fight")return;const alive=P.filter(p=>p.alive);if(alive.length>1)return;G.phase="end";if(alive[0])G.wins[alive[0].id]++;}',phase:'function phase(dt){if(G.phase==="countdown"){G.count-=dt;if(G.count<=0)G.phase="fight";}}'}}
];
const templates={
space:`
 function init(){playerCount=ids.length;arcadeView="online";arcadeWins=1;arcadeArena=options.arena||"orbital";ROUND_TIME=clamp(+options.duration||90,30,180);difficulty=clamp(+options.difficulty||1,.78,1.18);if(arcadeArena==="gravity")TUNE.gravity=4.9;if(arcadeArena==="ion"){TUNE.move.drag=1.35;TUNE.move.accel=10.8}resetRound();}
 function tick(){for(let n=0;n<4;n++){if(phase==="over"||phase==="match")break;for(const f of fighters){f.control=botIds.includes(ids[f.id])?"cpu":"online";if(f.control!=="online")continue;const i=onlineInputs[ids[f.id]]||{};if(canAct(f)){const m=Math.hypot(i.x||0,i.y||0);if(m>.05){const d=norm(i.x||0,i.y||0);drive(f,d[0],d[1],1/120,clamp(m,.25,1))}if(n===0&&fresh(f.id)){if(i.action==="jump")jump(f);if(i.action==="kick")kick(f);if(i.action==="grab")grabThrow(f);}}}step(1/120);now+=1/120;}}
 function packRefs(){const fs=fighters.map(f=>({...f,carrying:f.carrying?.id??null})),cs=crates.map(c=>({...c,held:c.held?.id??null}));return {fighters:fs,crates:cs};}
 function unpackRefs(){for(const c of crates)c.held=c.held===null?null:fighters[c.held];for(const f of fighters)f.carrying=f.carrying===null?null:crates.find(c=>c.id===f.carrying)||null;}
 function result(){const finished=phase==="over"||phase==="match";return {finished,winnerSlots:finished?wins.map((v,i)=>v?i:-1).filter(i=>i>=0):[],slotScores:fighters.map(f=>f.hp),view:{...saveData(),...packRefs()}};}
`,
twisted:`
 function init(){playerCount=ids.length;arcadeTwistedView="online";arcadeTwistedArena=options.arena||"spiral";botDifficulty=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";MAX_LIVES=clamp(+options.lives||7,3,9);const speed=clamp(+options.speed||1,.7,1.3);for(const k of ["start","max","accel"])TUNING.speed[k]*=speed;if(arcadeTwistedArena==="frost"){TUNING.jump.gravity=10.5;TUNING.hazards.transition["low>low"]=1.12;TUNING.hazards.transition["low>high"]=1.12}if(arcadeTwistedArena==="foundry")TUNING.hit.recoverDelay=.48;createFighters();resetRound();}
 function tick(){for(const f of fighters){f.controller=botIds.includes(ids[f.id])?"ai":"online";if(f.controller!=="online")continue;const i=onlineInputs[ids[f.id]]||{};setDuck(f,i.action==="duck"||i.heldActions?.includes("duck"),"online");if(fresh(f.id)&&i.action==="jump")requestJump(f);}for(let n=0;n<4;n++){if(phase==="roundover"||phase==="matchover")break;updatePhase(1/120);if(phase==="fight")fixedUpdate(1/120);now+=1/120;}}
 function result(){const finished=phase==="roundover"||phase==="matchover";return {finished,winnerSlots:finished?fighters.filter(f=>f.roundWins>0).map(f=>f.id):[],slotScores:fighters.map(f=>f.score),view:saveData()};}
`,
roller:`
 function geometry(){let cached=courseCache.get(arcadeRollerArena);if(!cached){buildCurve();buildCourseZones();cached={trackSamples,trackTangents,trackNormals,trackLengths,trackLength,trackSampleSpacing,rushZones,roughZones};courseCache.set(arcadeRollerArena,cached);}({trackSamples,trackTangents,trackNormals,trackLengths,trackLength,trackSampleSpacing,rushZones,roughZones}=cached);}
 function init(){activeRacerCount=ids.length;arcadeRollerView="play";arcadeRollerArena=options.arena||"crownway";targetLaps=clamp(+options.laps||3,1,7);botDifficulty=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";const speed=clamp(+options.speed||1,.75,1.2);TUNING.movement.maxSpeed*=speed;TUNING.movement.driveAccel*=speed;if(arcadeRollerArena==="glacier"){TUNING.movement.highSpeedGrip=2.05;TUNING.movement.lowSpeedGrip=6.8;TUNING.movement.coastDrag=.19;TUNING.course.rushBoost=2.5}geometry();createRacers();}
 function tick(){geometry();for(let i=0;i<ids.length;i++){humanControl[i]=!botIds.includes(ids[i]);networkInputs[i].connected=humanControl[i];lastHumanPacket[i]=now;}for(let n=0;n<4;n++){if(finished)break;updatePhase(1/120);fixedUpdate(1/120);now+=1/120;}}
 function result(){const ranked=standings();return {finished,winnerSlots:finished&&ranked[0]?[ranked[0].id]:[],slotScores:racers.map(r=>raceProgress(r)*1000),view:saveData()};}
`,
scratch:`
 function init(){playerCount=ids.length;humanSlots=new Set(ids.flatMap((id,i)=>botIds.includes(id)?[]:[i]));arcadeScratchArena=options.arena||"moonlit";difficulty=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";configuredSeed=seed>>>0;if(arcadeScratchArena==="echo")Object.assign(TUNING.rhythm,{baseBpm:82,bpmStep:4,maxBpm:128,minEvents:6,maxEvents:10});if(arcadeScratchArena==="tempest")Object.assign(TUNING.rhythm,{baseBpm:104,bpmStep:9,maxBpm:170});if(arcadeScratchArena==="crystal")Object.assign(TUNING.rhythm,{baseBpm:90,chordStart:0,maxChordChance:.45});const tempo=clamp(+options.tempo||1,.75,1.2);TUNING.rhythm.baseBpm*=tempo;TUNING.rhythm.maxBpm*=tempo;TUNING.round.maxPhrases=clamp(+options.phrases||9,3,12);TUNING.ai.baseSkill=clamp(+options.botSkill||.915,.6,.98);initPlayers();phase="countdown";countdownAt=now*1000;}
 function tick(){for(const p of players)p.human=!botIds.includes(ids[p.id]);for(let n=0;n<4;n++){now+=1/120;updateGame(1/120);if(n===0)for(const p of players){const i=onlineInputs[ids[p.id]]||{};if(!fresh(p.id))continue;if(Number.isInteger(i.laneMask))for(let lane=0;lane<4;lane++){if(i.laneMask&(1<<lane))tryPlayerHit(p.id,lane)}else if(Number.isInteger(i.lane))tryPlayerHit(p.id,i.lane);}if(phase==="finishing"&&now>=endAt)endRound();if(phase==="results")break;}}
 function result(){const finished=phase==="results";return {finished,winnerSlots:finished?players.filter(p=>p.rank===1).map(p=>p.id):[],slotScores:players.map(p=>p.score),view:saveData()};}
`,
ball:`
 function init(){arcadeBallView="online";G.playerCount=ids.length;G.wins=ids.map(()=>0);G.sound=false;G.arenaScale=clamp(+options.size||1.1,.85,1.3);G.diff=["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal";arcadeBallArena=options.arena||"beach";arcadeBallCrowns=1;const speed=clamp(+options.speed||1,.75,1.2);TUNING.ball.minSpeed*=speed;TUNING.ball.maxSpeed*=speed;S={...S,w:1280,h:720,cx:640,cy:298.8,size:Math.min(1280*.99,720*.74*G.arenaScale,720*.76)};refreshArenaGeometry();P=ids.map((_,i)=>makeP(i));}
 function tick(){for(let i=0;i<ids.length;i++){externalControlled[i]=!botIds.includes(ids[i]);const v=onlineInputs[ids[i]]||{};externalInputs[i]={moveX:v.x||0,primaryAction:v.action==="magnet"||v.heldActions?.includes("magnet"),secondaryAction:v.action==="pulse"&&fresh(i),run:Math.abs(v.x||0)>.82};}for(let n=0;n<4;n++){if(G.phase==="end")break;phase(1/120);step(1/120);now+=1/120;}}
 function packRefs(){return {P:P.map(p=>({...p,held:p.held.map(b=>G.balls.indexOf(b))}))};}
 function unpackRefs(){for(const p of P)p.held=p.held.map(i=>G.balls[i]).filter(Boolean);}
 function result(){const finished=G.phase==="end";return {finished,winnerSlots:finished?G.wins.flatMap((w,i)=>w?[i]:[]):[],slotScores:P.map(p=>p.life),view:{...saveData(),...packRefs()}};}
`};
for(const m of manifests){
 const htmlPath=path.join(root,'public/arcade-games',m.folder,'online-v65.html');
 let browserHTML=fs.readFileSync(htmlPath,'utf8');
 // Online query suspends attract/local simulation immediately, including before first sync.
 if(!browserHTML.includes('/* CALLBACK_AUTHORITATIVE_VIEW */')){
  const marker='/* CALLBACK_AUTHORITATIVE_VIEW */\nlet callbackOnline=typeof location!=="undefined"&&typeof URLSearchParams!=="undefined"&&new URLSearchParams(location.search).get("online")==="1";\n';
  browserHTML=browserHTML.replace(m.start,marker+m.start);
  if(m.id==='space')browserHTML=browserHTML.replace('while(acc>=FIXED&&n<MAX_STEPS)','while(!callbackOnline&&acc>=FIXED&&n<MAX_STEPS)');
  if(m.id==='twisted')browserHTML=browserHTML.replace('updatePhase(realDt);if(!paused&&phase===','if(!callbackOnline)updatePhase(realDt);if(!callbackOnline&&!paused&&phase===');
  if(m.id==='roller')browserHTML=browserHTML.replace('if(!paused){updatePhase(realDt);','if(!callbackOnline&&!paused){updatePhase(realDt);');
  if(m.id==='scratch')browserHTML=browserHTML.replace('while(acc>=FIXED_DT&&substeps<','while(!callbackOnline&&acc>=FIXED_DT&&substeps<');
  if(m.id==='ball')browserHTML=browserHTML.replace('if(!G.paused){phase(frame);','if(!callbackOnline&&!G.paused){phase(frame);');
  const api='window.CallbackArcadeGame=';
  browserHTML=browserHTML.replace(api,bridges[m.id]+api);
  // Local input cannot mutate an authoritative display; camera/sound tools remain usable.
  const guard='addEventListener("keydown",e=>{if(callbackOnline)e.stopImmediatePropagation()},true);addEventListener("click",e=>{if(callbackOnline&&e.target.closest?.("#restart,#restartBtn,#raceAgainBtn,#againBtn,#startBtn,#next")){e.preventDefault();e.stopImmediatePropagation()}},true);addEventListener("pointerdown",e=>{if(callbackOnline&&e.target.closest?.("#controls,.controls,.action-cluster,#joyBase,#joyTrack"))e.stopImmediatePropagation()},true);\n';
  browserHTML=browserHTML.replace(marker,marker+guard);
  browserHTML=browserHTML.replace(/start\(o,watching\)\{/, 'start(o,watching){if(callbackOnline)return;');
  fs.writeFileSync(htmlPath,browserHTML);
 }
 const bridgeAt=browserHTML.indexOf('window.CallbackOnlineView=');
 if(bridgeAt>=0){const apiAt=browserHTML.indexOf('window.CallbackArcadeGame=',bridgeAt);browserHTML=browserHTML.slice(0,bridgeAt)+bridges[m.id].trimStart()+browserHTML.slice(apiAt);fs.writeFileSync(htmlPath,browserHTML);}
 const html=fs.readFileSync(htmlPath,'utf8');
 let source=html.slice(html.indexOf(m.start),html.indexOf(m.end));
 // Ball's arena extension functions occur after browser API registration.
 if(m.id==='ball')source+='\n'+html.slice(html.indexOf('function arcadeBallPhysics'),html.indexOf('var ballArenas='));
 const overrides={...m.overrides};for(const k of Object.keys(overrides))if(overrides[k]===null)delete overrides[k];
 // Preserve the original per-seat native AI, adapting the former local-only gate.
 if(m.id==='space')source=source.replace('(f.id>0||arcadeView!=="play")','(f.control==="cpu")');
 if(m.id==='roller')source=source.replace('arcadeRollerView==="play"&&(r.id===0||humanControl[r.id])','humanControl[r.id]');
 const states=m.state.split(' '),roots=[...m.roots.split(' '),...states];
 if(m.id==='roller')roots.push('radialDeadzone','standings','humanControl','networkInputs','lastHumanPacket');
 if(m.id==='ball')roots.push('externalInputs','externalControlled');
 const extracted=extract(source,roots,overrides);
 const lintRules=m.id==='scratch'?'@typescript-eslint/no-unused-vars, no-constant-condition, no-constant-binary-expression':m.id==='twisted'?'@typescript-eslint/no-unused-vars, @typescript-eslint/no-unused-expressions':'@typescript-eslint/no-unused-vars';
 const code=`/* eslint-disable ${lintRules} -- static source extraction keeps native declarations and neutralizes browser effects. */
/** Generated from ${m.folder}/online-v65.html SHA-256 ${createHash('sha256').update(html).digest('hex')}. */
import {Vector3,Quaternion,CatmullRomCurve3} from './imported-math.mjs';
import {encode,decode} from './imported-codec.mjs';
const THREE={Vector3,Quaternion,CatmullRomCurve3};
const courseCache=new Map();
export function runtime(ids,seed,options,botIds,state,onlineInputs={}){
 let now=state?.now||0,rng=state?.rng??(seed>>>0),endAt=state?.endAt??0;
 const previous=state?.previous||{},nextPrevious={...previous};
 const Math=Object.create(globalThis.Math);Math.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 const performance={now:()=>now*1000};let botDifficulty=state?.botDifficulty||"normal";
 function fresh(slot){const i=onlineInputs[ids[slot]];return !!i&&Number.isFinite(i.seq)&&i.seq>(previous[ids[slot]]??-1);}
 ${extracted}
 ${!['space','ball'].includes(m.id)?'function packRefs(){return {}} function unpackRefs(){}':''}
 ${templates[m.id]}
 function saveData(){return {${states.map(k=>k==='lastRoundWinner'?'lastRoundWinner:lastRoundWinner?.id??null':k).join(',')}};}
 function save(){for(const id of ids)if(onlineInputs[id])nextPrevious[id]=onlineInputs[id].seq;return {kind:"${m.id}",ids,seed,options,now,rng,endAt,botDifficulty,previous:nextPrevious,data:encode({...saveData(),...(typeof packRefs==="function"?packRefs():{})})};}
 if(state){const data=decode(state.data);${states.filter(k=>k!=='lastRoundWinner').map(k=>`if(Object.hasOwn(data,"${k}")){${k==='TUNING'?`for(const key of Object.keys(data.TUNING))Object.assign(TUNING[key],data.TUNING[key])`:k==='TUNE'?`Object.assign(TUNE,data.TUNE)`:`${k}=data.${k}`};}`).join('')} ${m.id==='twisted'?'lastRoundWinner=data.lastRoundWinner===null?null:fighters[data.lastRoundWinner];':''}if(typeof unpackRefs==="function")unpackRefs();}
 else init();
 return {save,tick,result};
}
`;
 if(/\b(?:document|navigator|eval|requestAnimationFrame|setTimeout|clearTimeout)\b/.test(code))throw new Error(m.id+' extraction still contains a browser boundary: '+code.match(/.{0,90}\b(?:document|navigator|eval|requestAnimationFrame|setTimeout|clearTimeout)\b.{0,90}/g)?.join('\n'));
 fs.writeFileSync(path.join(out,'imported-'+m.id+'.mjs'),code);
 fs.writeFileSync(path.join(out,'imported-'+m.id+'.d.mts'),'export declare function runtime(ids:string[],seed:number,options:Record<string,unknown>,botIds:string[],state?:unknown,inputs?:Record<string,unknown>): {save():unknown;tick():void;result():{view:unknown;finished:boolean;winnerSlots:number[];slotScores:number[]}};\n');
}
