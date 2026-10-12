import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,relative,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {harness,source} from '../games/royal-roller-ruckus/tests/harness.mjs';
const three=await import('../games/royal-roller-ruckus/source/vendor/three.module.js');
test('four bounded worlds have distinct routes and validated preferences',()=>{const h=harness({three});assert.equal(h.run('Object.keys(COURSES).length'),4);const a=h.run('activeCourse="crownway";buildCurve();trackLength');const b=h.run('activeCourse="frostglass";buildCurve();trackLength');assert.ok(Math.abs(a-b)>10);const s=h.run('normalizeRaceSettings({course:"bad",hazards:99,mode:"oops",name:"  A B  ",color:"red",trim:"bad"})');assert.equal(s.course,'crownway');assert.equal(s.hazards,1);assert.equal(s.name,'A B');assert.equal(s.trim,'silver');});
test('ice reduces grip and brake force; steam has warning and safe lane; gust is bounded',()=>{const h=harness({three});h.run('activeCourse="frostglass";buildCurve();buildCourseZones();pose(racers[0],iceZones[0].idx);');assert.ok(h.run('worldSurface(racers[0]).grip')<1);assert.ok(h.run('worldSurface(racers[0]).brake')<1);h.run('activeCourse="foundry";buildCourseZones();raceTime=4;pose(racers[0],steamZones[0].idx,steamZones[0].side);');assert.equal(h.run('steamState(steamZones[0]).phase'),'warning');h.run('raceTime=6;');assert.equal(h.run('worldSurface(racers[0]).steam'),true);h.run('pose(racers[0],steamZones[0].idx,-steamZones[0].side)');assert.equal(h.run('worldSurface(racers[0]).steam'),false);h.run('activeCourse="skygarden";raceTime=6');assert.ok(h.run('Math.abs(windState().force)<=1.4'));});
test('demo is isolated, ignores network input and never records',()=>{const h=harness({three});h.run('buildCurve();openRaceSetup();');assert.equal(h.run('isDemo'),true);h.run('window.CallbackInput.push(0,{moveX:1,sequence:2});advanceDemo(1/60);');assert.equal(h.run('networkInputs[0].connected'),false);assert.ok(h.run('demo.time')>0);h.run('racers[0].lap=3;racers[0].finishTime=10;racers[0].lapTimes=[10];recordPersonalBest(racers[0]);');assert.equal(h.run('Object.keys(personalBests).length'),0);h.click('#startRaceBtn');assert.equal(h.run('isDemo'),false);assert.equal(h.run('raceTime'),0);assert.equal(h.run('racers[0].lap'),0);});
test('rules stage; series resets on new run and API seat changes',()=>{const h=harness();h.run('courseEl.value="foundry";modeEl.value="series";resetRace();');assert.equal(h.run('activeCourse'),'crownway');assert.equal(h.run('series.index'),0);h.run('courseEl.value="frostglass"');assert.equal(h.run('activeCourse'),'crownway');h.run('window.CallbackInput.setPlayerCount(2)');assert.equal(h.run('series'),null);});
test('steam physically slows its announced lane and leaves the opposite lane untouched',()=>{const h=harness({three});h.run('courseEl.value="foundry";buildCurve();resetRace();raceTime=6;const r=racers[0];pose(r,steamZones[0].idx,1);r.vx=4;r.vz=0;updateCourseInteraction(r,.1);');assert.ok(h.run('r.vx')<3.2);h.run('pose(r,steamZones[0].idx,-1);r.vx=4;r.vz=0;updateCourseInteraction(r,.1)');assert.equal(h.run('r.vx'),4);});
test('ice changes human steering and countersteer braking; approach strip scrubs speed',()=>{const h=harness({three});h.run('courseEl.value="frostglass";buildCurve();resetRace();cameraBasis=()=>({f:{x:0,z:-1},right:{x:1,z:0}});samplePlayerInput=()=>({moveX:-1,moveY:0});const r=racers[0];function brakeAt(i){pose(r,i);r.vx=5;r.vz=0;r.inputX=-1;r.inputZ=0;updatePlayer(r,.1);return r.vx;}');const ice=h.run('brakeAt(iceZones[0].idx)'),stone=h.run('brakeAt(200)');assert.ok(ice>stone,'braking has less purchase on ice');h.run('pose(r,58,0);r.vx=4;r.vz=0;updateCourseInteraction(r,.1)');assert.ok(h.run('r.vx')<4);});
test('wind has a warning, reverses by cycle, and the edge route grants a capped boost',()=>{const h=harness({three});h.run('courseEl.value="skygarden";buildCurve();resetRace();raceTime=4;');assert.equal(h.run('windState().phase'),'warning');assert.equal(h.run('windState().force'),0);h.run('raceTime=6;');assert.ok(h.run('windState().force')>0);h.run('raceTime=18;');assert.ok(h.run('windState().force')<0);h.run('const r=racers[0];pose(r,rushZones[0].idx,rushZones[0].side*TUNING.course.rushLane);r.vx=r.vz=0;updateCourseInteraction(r,.01)');assert.equal(h.run('r.onRush'),true);assert.ok(h.run('Math.hypot(r.vx,r.vz)')>3);assert.ok(h.run('Math.hypot(r.vx,r.vz)')<=h.run('TUNING.movement.maxSpeed*TUNING.course.rushMaxBonus'));});
test('native form keys do not drive, recover or pause and name normalizes only on blur',()=>{const h=harness();h.run('phase="race";racers[0].falling=true;nameEl.value="  Ada Lovelace  ";');h.fire('keydown',{code:'KeyR',target:{tagName:'INPUT'}});h.fire('keydown',{code:'KeyW',target:{tagName:'INPUT'}});h.fire('keydown',{code:'Escape',target:{tagName:'INPUT'}});assert.equal(h.run('racers[0].recoveries'),0);assert.equal(h.run('paused'),false);assert.equal(h.run('readKeyboardTouch().moveY'),0);for(const f of h.els.get('#playerName').events.input)f({});assert.equal(h.run('nameEl.value'),'  Ada Lovelace  ');for(const f of h.els.get('#playerName').events.blur)f({});assert.equal(h.run('playerName'),'Ada Lovelace');});
test('series only scores real finishers once and follows the four courses',()=>{const h=harness({three});h.run('buildCurve();modeEl.value="series";resetRace();');for(const [index,course] of ['crownway','frostglass','foundry','skygarden'].entries()){assert.equal(h.run('activeCourse'),course);assert.equal(h.run('targetLaps'),1);h.run('raceTime=40;finishRacer(racers[0]);revealFinish();revealFinish();');assert.equal(h.run('series.races.length'),index+1);assert.equal(h.run('series.races.at(-1).rows.filter(r=>r.time!==null).length'),1);assert.equal(h.run('series.scores[0]'),4*(index+1));if(index<3)h.click('#nextCourseBtn');}h.click('#raceAgainBtn');assert.equal(h.run('series.index'),0);assert.equal(h.run('series.races.length'),0);});
test('demo silence guards survive previously unlocked audio, with no airborne input sampling',()=>{const h=harness({three});h.run('buildCurve();openRaceSetup();');h.run(source.slice(source.indexOf('function tone('),source.indexOf('function impactTier(')));h.run('let audioCalls=0;audioUnlocked=true;soundOn=true;audioCtx={createOscillator(){audioCalls++},createBufferSource(){audioCalls++}};navigator.vibrate=()=>audioCalls++;tone(400);noise();haptic();let samples=0;samplePlayerInput=()=>{samples++;return{moveX:1,moveY:0}};racers[0].falling=true;updateAirborne(racers[0],.01)');assert.equal(h.run('audioCalls'),0);assert.equal(h.run('samples'),0);});
test('same race seed restarts independently of demo duration and reduced-motion effects',()=>{const h=harness({three});h.run('buildCurve();seedEl.value="876";resetRace();const first=JSON.stringify(racers.map(r=>r.aiPersonality));openRaceSetup();for(let i=0;i<600;i++)advanceDemo(.05);resetRace();');assert.equal(h.run('JSON.stringify(racers.map(r=>r.aiPersonality))'),h.run('first'));});
test('course transitions dispose owned resources and retain a bounded render graph',()=>{const h=harness({three});h.context.document.createElement=()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})});h.run('scene=new THREE.Scene();loadScenery=()=>{};createTrack();createCourseScenery();let disposed=0;arenaGroup.traverse(n=>n.geometry?.addEventListener("dispose",()=>disposed++));for(let k=0;k<12;k++)switchCourse(Object.keys(COURSES)[k%4]);');assert.equal(h.run('scene.children.length'),2);assert.equal(h.run('checkpointMarkers.length'),8);assert.ok(h.run('disposed')>100);assert.ok(h.run('arenaGroup.children.length')<500);});
for(const course of ['crownway','frostglass','foundry','skygarden'])test(`${course} live demo completes and loops legal laps without records or session RNG consumption`,()=>{const h=harness({three});const result=h.run(`(()=>{buildCurve();courseEl.value='${course}';raceRandomState=987;openRaceSetup();let credits=0,invalid=0;const gate=checkpointUpdate;checkpointUpdate=r=>{const cp=r.nextCheckpoint,lap=r.lap,t=trackTangents[checkpointIndex(cp)];gate(r);if(r.nextCheckpoint!==cp||r.lap!==lap){credits++;if(r.falling||r.vx*t.x+r.vz*t.z<=0)invalid++;}};for(let i=0;i<1800&&demo.loops<1;i++)advanceDemo(.05);return{loops:demo.loops,credits,invalid,records:Object.keys(personalBests).length,rng:raceRandomState,allBots:racers.every(r=>!r.player)};})()`);assert.equal(result.loops,1);assert.equal(result.credits,32);assert.equal(result.invalid,0);assert.equal(result.records,0);assert.equal(result.rng,987);assert.equal(result.allBots,true);});

test('Skygarden world arrows follow the actual local gust vector on curved segments in both cycles',()=>{
 const h=harness({three});h.context.document.createElement=()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})});
 h.run('scene=new THREE.Scene();activeCourse="skygarden";racers=[];createTrack();');
 const alignment=()=>Array.from(h.run('hazardVisuals.map((v,j)=>{const idx=40+j*100,tip=new THREE.Vector3(0,1,0).applyQuaternion(v.mesh.quaternion),direction=trackNormals[idx].clone().multiplyScalar(windState().side);return tip.dot(direction);})'));
 assert.ok(alignment().every(dot=>dot>.999),'initial warning markers point along the local normal, not a global axis');
 for(const time of [4,6,16,18]){h.run(`raceTime=${time};updateVisuals(1/60,${time});`);assert.ok(alignment().every(dot=>dot>.999),`warning/active arrow orientation at ${time}s`);}
 for(const time of [6,18]){const dots=h.run(`raceTime=${time};updateVisuals(1/60,${time});hazardVisuals.map((v,j)=>{const idx=40+j*100,p=lanePosition(idx,0),r={x:p.x,y:p.y,z:p.z,trackIdx:idx,vx:0,vz:0,rushCooldown:1,falling:false,lap:0};updateCourseInteraction(r,.1);return new THREE.Vector3(r.vx,0,r.vz).normalize().dot(new THREE.Vector3(0,1,0).applyQuaternion(v.mesh.quaternion));})`);assert.ok(Array.from(dots).every(dot=>dot>.999),`arrow and real applied force agree at ${time}s`);}
});

test('overlapping Foundry loads share one steam texture and stale loads cannot change the active sprite resource',async()=>{
 const requests=[];class DeferredTextureLoader{loadAsync(){return new Promise((resolve,reject)=>requests.push({resolve,reject}));}}
 const h=harness({three:{...three,TextureLoader:DeferredTextureLoader}});h.context.document.createElement=()=>({getContext:()=>new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)})});
 h.run('scene=new THREE.Scene();activeCourse=loadedCourse="foundry";createTrack();const template=new THREE.Group();template.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial()));template.traverse(n=>{n.userData.sharedAsset=true;});sceneryTemplate=()=>Promise.resolve(template);const oldGroup=environmentGroup;const oldLoad=loadScenery();');
 await new Promise(setImmediate);assert.equal(requests.length,1);
 h.run('switchCourse("frostglass");switchCourse("foundry");const currentGroup=environmentGroup;');await new Promise(setImmediate);
 // Resolve requests newest-first: reproduces the old late-A-overwrites-live-B race.
 for(let i=requests.length-1;i>=0;i--){const texture=new three.Texture();texture.name=`request-${i}`;requests[i].resolve(texture);await new Promise(setImmediate);}
 await h.run('oldLoad');
 assert.equal(requests.length,1,'one pending texture load is shared across course generations');
 assert.equal(h.run('oldGroup.children.filter(n=>n.isSprite&&n.material.map===steamTexture).length'),0,'stale generation attaches no steam sprites');
 assert.equal(h.run('hazardVisuals.filter(v=>v.smoke&&v.smoke.material.map===steamTexture).length'),3,'all active sprites use the authoritative cache');
 h.run('let steamDisposals=0;steamTexture.addEventListener("dispose",()=>steamDisposals++);switchCourse("frostglass");switchCourse("foundry");');await new Promise(setImmediate);
 assert.equal(requests.length,1);assert.equal(h.run('steamDisposals'),0,'shared texture survives course-owned material disposal');assert.equal(h.run('hazardVisuals.filter(v=>v.smoke&&v.smoke.material.map===steamTexture).length'),3);
});

test('failed shared steam loading is cached without retry storms and leaves racing available',async()=>{
 let calls=0;class FailedTextureLoader{loadAsync(){calls++;return Promise.reject(new Error('image unavailable'));}}
 const h=harness({three:{...three,TextureLoader:FailedTextureLoader}});
 const results=await Promise.all([h.run('loadSteamTexture()'),h.run('loadSteamTexture()')]);assert.deepEqual(results,[null,null]);
 assert.equal(await h.run('loadSteamTexture()'),null);assert.equal(calls,1);assert.equal(h.run('assetStatus.failed'),1);
 h.run('courseEl.value="foundry";buildCurve();resetRace();phase="race";updatePlayer=updateAI;fixedUpdate(1/120);');assert.ok(h.run('raceTime')>0);assert.equal(h.run('steamTexture'),null);
});


test('every shipped GLB/glTF has a complete local image/buffer resource closure with recorded hashes',()=>{
 const gameRoot=fileURLToPath(new URL('../games/royal-roller-ruckus/',import.meta.url)),assetRoot=resolve(gameRoot,'source/assets');
 const records=new Map(JSON.parse(readFileSync(resolve(assetRoot,'provenance.json'),'utf8')).map(r=>[r.file,r]));
 const manifest=JSON.parse(readFileSync(resolve(gameRoot,'manifest.json'),'utf8')),visited=new Set();
 const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(dir,entry.name)):[resolve(dir,entry.name)]);
 function visit(file){
  const name=relative(assetRoot,file);assert.ok(!name.startsWith('..'),'resource stays inside the shipped asset root');
  assert.ok(existsSync(file),`missing GLTF resource: ${name}`);if(visited.has(file))return;visited.add(file);
  const bytes=readFileSync(file),record=records.get(name);assert.ok(record,`provenance covers ${name}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,`exact resource hash: ${name}`);
  assert.ok(manifest.source.paths.includes(relative(gameRoot,file)),`manifest includes ${name}`);
  if(!['.glb','.gltf'].includes(extname(file)))return;
  let gltf;if(extname(file)==='.glb'){assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());}else gltf=JSON.parse(bytes.toString());
  for(const resource of [...(gltf.images||[]),...(gltf.buffers||[])]){
   if(!resource.uri||resource.uri.startsWith('data:'))continue;
   const url=new URL(resource.uri,pathToFileURL(file));assert.equal(url.protocol,'file:',`no runtime remote model dependency: ${resource.uri}`);visit(fileURLToPath(url));
  }
 }
 const models=walk(assetRoot).filter(file=>['.glb','.gltf'].includes(extname(file)));assert.equal(models.length,4);models.forEach(visit);
 assert.ok(visited.has(resolve(assetRoot,'Textures/colormap.png')),'castle material texture is reached through the actual GLB URI');
});
