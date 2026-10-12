// Browser QA only: install Playwright outside the checkout; use the bundled Three.js r180.
// PLAYWRIGHT_MODULE=/.../playwright/index.mjs THREE_BUILD_DIR=/.../three/build
// BROWSER_BIN=/usr/bin/chromium node .../browser.mjs [checks|perf]
// Optional ROLLER_ENTRY, EVIDENCE_DIR, RENDER_MODE=balanced|performance.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import http from 'node:http';
import path from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const original=await readFile(process.env.ROLLER_ENTRY||new URL('../source/index.html',import.meta.url),'utf8');
const evidence=process.env.EVIDENCE_DIR||'/tmp/roller-browser';await mkdir(evidence,{recursive:true});
const mode=process.argv[2]||'checks';
const hook='window.__rollerTest={run:code=>eval(code)};';
const fixture=original.replace('https://cdn.jsdelivr.net/npm/three@0.180.0/+esm','/three.module.js').replace('./vendor/three.module.js','/three.module.js').replace('initRenderer();createTrack();',hook+'initRenderer();createTrack();').replace('requestAnimationFrame(t=>{lastTime=t;animate(t)});','');
const server=http.createServer(async(req,res)=>{try{if(req.url.startsWith('/three.')||req.url.startsWith('/vendor/three.')){res.setHeader('Content-Type','text/javascript');res.end(await readFile(path.join(process.env.THREE_BUILD_DIR||new URL('../source/vendor/',import.meta.url).pathname,path.basename(req.url))));}else{res.setHeader('Content-Type','text/html');res.end(req.url.includes('dependency-failure')?original:fixture);}}catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_BIN||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{let seed=123;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
 const url=`http://127.0.0.1:${server.address().port}`;await page.goto(url);await page.waitForFunction(()=>window.__rollerTest);const run=code=>page.evaluate(code=>window.__rollerTest.run(code),code);
 await run(`soundOn=false;racerCountEl.value='10';resetRace();phase='race';paused=false;countdownEl.classList.add('hidden');loading.style.display='none';`);
 const environment=await run(`(()=>{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,seed:123,dependency:'bundled Three.js r180, test-only local route'}})()`);environment.browser=await browser.version();
 if(mode==='diagnostic'){
  const result=await run(`(async()=>{const results=[];for(const condition of ['idle','render-with-ui','render-no-ui']){
   if(condition==='render-no-ui')for(const child of document.querySelector('#app').children)if(child.id!=='viewport')child.style.visibility='hidden';
   const start=performance.now();let previous=start,frames=0,renderMs=0;
   await new Promise(resolve=>{function frame(){const begin=performance.now();if(condition!=='idle'){renderer.render(scene,camera);renderer.getContext().finish();}renderMs+=performance.now()-begin;frames++;previous=performance.now();if(previous-start>=6000)resolve();else requestAnimationFrame(frame)}requestAnimationFrame(frame)});
   results.push({condition,durationMs:previous-start,frames,meanFrameMs:(previous-start)/frames,meanRenderCallMs:renderMs/frames,visibility:document.visibilityState});
  }return results;})()`);console.log(JSON.stringify({environment,diagnostics:result,errors}));
 }else if(mode==='perf'){
  const graphics=process.env.RENDER_MODE||'balanced';
  const report=await run(`(async()=>{graphicsEl.value=${JSON.stringify(graphics)};applyGraphicsMode();
   // Identical stationary scene and camera for base/candidate; no simulation or changing random inputs.
   const p=trackSamples[10],t=trackTangents[10];camera.position.set(p.x-t.x*7.3,p.y+5.36,p.z-t.z*7.3);camera.lookAt(p.x+t.x*2.2,p.y+.71,p.z+t.z*2.2);camera.fov=49;camera.updateProjectionMatrix();
   for(let i=0;i<3;i++){renderer.render(scene,camera);renderer.getContext().finish();}
   const diagnostics=[];for(const shadows of [true,false]){renderer.shadowMap.enabled=shadows;const begin=performance.now();for(let i=0;i<3;i++){renderer.render(scene,camera);renderer.getContext().finish();}diagnostics.push({shadows,meanRenderMs:(performance.now()-begin)/3,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});}applyGraphicsMode();
   const intervals=[];const start=performance.now();let previous=start;
   await new Promise(resolve=>{function frame(){renderer.render(scene,camera);renderer.getContext().finish();const now=performance.now();intervals.push(now-previous);previous=now;if(now-start>=60000)resolve();else requestAnimationFrame(frame);}requestAnimationFrame(frame);});
   intervals.sort((a,b)=>a-b);return{scene:'ten-racer seeded stationary grid, fixed camera; render+GPU completion per frame',graphics:graphicsEl.value,durationMs:previous-start,frames:intervals.length,meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,medianMs:intervals[Math.floor(intervals.length*.5)],p95Ms:intervals[Math.floor(intervals.length*.95)],diagnostics};})()`);
  await writeFile(path.join(evidence,'performance.json'),JSON.stringify({environment,...report,errors},null,2));console.log(JSON.stringify({environment,...report,errors}));
 }else{
  await page.keyboard.down('w');await page.dispatchEvent('body','blur'); // Native window event below.
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await run('readKeyboardTouch().moveY'),0);assert.equal(await run('paused'),true);
  await page.click('#resumeBtn');assert.equal(await run('paused'),false);await page.keyboard.up('w');
  await page.click('#settingsBtn');await page.click('#closeSettings');assert.equal(await run('paused'),true);await page.click('#resumeBtn');
  await page.dispatchEvent('#joyWrap','pointerdown',{pointerId:9,clientX:450,clientY:620});await page.dispatchEvent('#joyWrap','pointercancel',{pointerId:9});assert.equal(await run('joystick.active'),false);
  await run(`window.CallbackInput.push(0,{moveX:1,sequence:1});samplePlayerInput(0);window.CallbackInput.disconnect(0);`);assert.equal(await run('inputSlots[0].moveX'),0);
  const code=await run('window.CallbackCamera.set({rotate:45,zoom:1.2,tilt:-10});window.CallbackCamera.save()');await run('window.CallbackCamera.reset()');assert.equal(await run(`window.CallbackCamera.load(${JSON.stringify(code)})`),true);await run('window.CallbackCamera.reset()');
  const frames=[];
  for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
   await page.setViewportSize(viewport);await run('resize()');
   for(const idx of [10,226,351,512]){
    await run(`(()=>{const r=racers[0],p=trackSamples[${idx}],t=trackTangents[${idx}];Object.assign(r,{x:p.x,y:p.y+CAGE_R,z:p.z,trackIdx:${idx},vx:t.x*7.7,vz:t.z*7.7,speed:7.7,falling:false});cameraNeedsReset=true;for(let i=0;i<60;i++)updateCamera(1/60);updateVisuals(0,0);updateHUD();renderer.render(scene,camera);})()`);
    const bounds=await run(`(()=>{camera.updateMatrixWorld();const p=racers[0],v=new THREE.Vector3(p.x,p.y-CAGE_R,p.z).project(camera);return{playerBottom:(1-v.y)*innerHeight/2,controlsTop:document.querySelector('.controls').getBoundingClientRect().top}})()`);assert.ok(bounds.playerBottom<bounds.controlsTop,JSON.stringify({viewport,idx,bounds}));frames.push({viewport,idx,bounds});
    await page.screenshot({path:path.join(evidence,`camera-${viewport.width}-${idx}.png`)});
   }
  }
  assert.deepEqual(errors,[]);
  const failure=await browser.newPage();await failure.route('**/vendor/three.*',r=>r.abort());await failure.route('https://cdn.jsdelivr.net/**',r=>r.abort());await failure.goto(url+'/?dependency-failure');await failure.waitForSelector('#retryLoad');assert.match(await failure.locator('#loading').innerText(),/could not be (downloaded|loaded)/);await failure.close();
  console.log(JSON.stringify({environment,checks:'blur, touch cancel, settings/manual resume, disconnect, CAM codes, desktop/portrait framing, dependency failure',frames,errors}));
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
