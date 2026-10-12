import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {startServer} from '../server/local.mjs';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.env.SUMO_EVIDENCE_DIR||new URL('./evidence/',import.meta.url).pathname;await mkdir(dir,{recursive:true});
const server=await startServer({port:0});const errors=[],checks=[];let browser;
const record=(name)=>{checks.push(name);console.log('PASS '+name)};
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-zygote']});
 const ctx=await browser.newContext({viewport:{width:1100,height:740},hasTouch:true});await ctx.addInitScript(()=>{
  localStorage.setItem('royalSumo.v1',JSON.stringify({v:1,values:{},flags:{seenHelp:true}}));
  // This headless runner has no hardware gamepad bus. Avoid its native udev probe.
  Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
 });
 const capture=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text())})};
 const host=await ctx.newPage();capture(host);await host.goto(server.url);await host.waitForFunction(()=>window.RoyalSumo?.version==='1.3.0');record('v1.3.0 boots with WebGL2');
 await host.getByRole('button',{name:'Phone players',exact:true}).click();await host.getByRole('button',{name:'Create room',exact:true}).click();await host.waitForFunction(()=>window.CallbackSumoOnline?.getState().connected);
 const code=await host.evaluate(()=>CallbackSumoOnline.getState().code);record('host creates and authenticates room');
 const phone=await ctx.newPage();capture(phone);await phone.setViewportSize({width:390,height:844});await phone.goto(server.url+'/online/controller.html?room='+code);await phone.locator('#name').fill('Danny');await phone.getByRole('button',{name:'Join game'}).click();await phone.waitForFunction(()=>!document.querySelector('#controller').hidden);
 await host.waitForFunction(()=>RoyalSumo.multiplayer.getSlots()[1].owner==='remote');record('phone takes seat 1 from a bot');
 await host.locator('#so-start').click();await host.evaluate(()=>RoyalSumo.debug.advance(3.6));await phone.waitForFunction(()=>!document.querySelector('#controller').classList.contains('disabled'));
 // Hold other fighters still so AI collisions cannot invalidate input assertions.
 await host.evaluate(()=>{const s=RoyalSumo.debug.sim();s.fighters.forEach((f,i)=>{if(i!==1){s.setOwner(i,'remote');f.x=Math.cos(i)*7;f.z=Math.sin(i)*7}else{f.x=f.z=0}f.vx=f.vz=0;f.bashCd=f.dashCd=f.recover=f.stagger=f.bashT=f.dashT=0})});
 await phone.mouse.move(80,610);await phone.mouse.down();await phone.mouse.move(135,610);await host.waitForFunction(()=>RoyalSumo.debug.sim().inputs[1].mx>.8);await host.evaluate(()=>RoyalSumo.debug.advance(.2));assert.ok(await host.evaluate(()=>RoyalSumo.debug.sim().fighters[1].x>0));await phone.mouse.up();record('phone joystick moves its assigned fighter');
 // Pause while two real touch contacts are held; no stale stick/charge may survive.
 const touch=await ctx.newCDPSession(phone);const touchBash=await phone.locator('#bash').boundingBox();
 const attack={x:touchBash.x+touchBash.width/2,y:touchBash.y+touchBash.height/2,id:2};
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:80,y:610,id:1},attack]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:135,y:610,id:1},attack]});
 await host.waitForFunction(()=>RoyalSumo.debug.sim().inputs[1].mx>.8&&RoyalSumo.debug.sim().inputs[1].bashDown);
 await host.locator('.hud-pause').click();await phone.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Paused'));
 await new Promise(resolve=>setTimeout(resolve,2600));
 assert.equal(await host.evaluate(()=>RoyalSumo.multiplayer.getSlots()[1].owner),'remote');
 assert.deepEqual(await host.evaluate(()=>{const r=RoyalSumo.debug.control().remote.read(1,performance.now(),{});return {x:r.mx,bash:r.bashDown}}),{x:0,bash:false});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await host.getByRole('button',{name:'Resume',exact:true}).click();await phone.waitForFunction(()=>!document.querySelector('#controller').classList.contains('disabled'));
 await host.evaluate(()=>{const f=RoyalSumo.debug.sim().fighters[1];f.bashCd=f.recover=f.bashT=f.stagger=0;f.prevBash=f.charging=false});record('multitouch pause clears held controls and preserves phone ownership');
 const bashBox=await phone.locator('#bash').boundingBox();await phone.mouse.move(bashBox.x+bashBox.width/2,bashBox.y+bashBox.height/2);await phone.mouse.down();await host.waitForFunction(()=>RoyalSumo.debug.sim().inputs[1].bashDown);await host.evaluate(()=>RoyalSumo.debug.advance(.45));assert.ok(await host.evaluate(()=>RoyalSumo.debug.sim().fighters[1].charge>.3));
 const before=await host.evaluate(()=>RoyalSumo.debug.sim().stats[1].bashes||0);await phone.mouse.up();await host.waitForFunction(()=>!RoyalSumo.debug.sim().inputs[1].bashDown);await host.evaluate(()=>RoyalSumo.debug.advance(.2));assert.equal(await host.evaluate(()=>RoyalSumo.debug.sim().stats[1].bashes||0),before+1);record('phone hold/release Bash reaches simulation');
 await host.evaluate(()=>RoyalSumo.debug.advance(1));const dashBefore=await host.evaluate(()=>RoyalSumo.debug.sim().stats[1].dashes||0);await phone.locator('#dash').click();await host.waitForFunction(v=>(RoyalSumo.debug.sim().stats[1].dashes||0)>v,dashBefore);record('phone Dash reaches simulation');
 await host.screenshot({path:join(dir,'online-host.png')});await phone.screenshot({path:join(dir,'phone-controller.png')});
 const saved=await phone.evaluate(code=>sessionStorage.getItem('royalSumo.phone:'+location.origin+':'+code),code);await phone.close();await host.waitForFunction(()=>RoyalSumo.multiplayer.getSlots()[1].owner==='bot');record('disconnect hands fighter back to AI');
 const back=await ctx.newPage();capture(back);await back.setViewportSize({width:844,height:390});await back.addInitScript(({code,saved})=>sessionStorage.setItem('royalSumo.phone:'+location.origin+':'+code,saved),{code,saved});await back.goto(server.url+'/online/controller.html?room='+code);await back.waitForFunction(()=>!document.querySelector('#controller').hidden);await host.waitForFunction(()=>RoyalSumo.multiplayer.getSlots()[1].owner==='remote');record('credential reconnect reclaims the same fighter');await back.screenshot({path:join(dir,'phone-landscape.png')});
 const extra=await ctx.newPage();capture(extra);await extra.goto(server.url+'/online/controller.html?room='+code);await extra.locator('#name').fill('Alex');await extra.getByRole('button',{name:'Join game'}).click();await extra.waitForFunction(()=>!document.querySelector('#controller').hidden);
 await host.evaluate(()=>RoyalSumo.debug.control().startFromMenu({fighters:2,map:'keep'},{players:2,mode:'quick'}));
 await extra.waitForFunction(()=>document.querySelector('#status').textContent.includes('ask the host to add fighters'));
 await host.waitForFunction(()=>RoyalSumo.multiplayer.getSlots()[1].owner==='remote');
 await host.evaluate(()=>RoyalSumo.debug.control().startFromMenu({fighters:10,map:'keep'},{players:1,mode:'quick'}));
 await host.waitForFunction(()=>RoyalSumo.multiplayer.getSlots()[2].owner==='remote');record('new matches preserve phone seats and unavailable fighters wait clearly');
 await extra.locator('#leave').click();await host.waitForFunction(()=>RoyalSumo.multiplayer.getSlots()[2].owner==='bot');assert.equal(await host.evaluate(()=>CallbackSumoOnline.getState().players.length),1);record('Leave removes a phone and restores its bot');await extra.close();
 await host.evaluate(()=>CallbackSumoOnline.end());await back.waitForFunction(()=>!document.querySelector('#join').hidden);record('host closes room for all phones');
 await host.evaluate(()=>{RoyalSumo.scenario({fighters:4,seed:21});RoyalSumo.debug.advance(3.6)});
 await host.locator('.hud-pause').click();await host.locator('[data-ovl="pause"]').getByRole('button',{name:'Settings',exact:true}).click();assert.equal(await host.evaluate(()=>RoyalSumo.debug.stats().paused),true);
 await host.getByRole('button',{name:'Open camera controls'}).click();await host.locator('[data-camera-control="rotate"]').evaluate(el=>el.value='35');await host.locator('[data-camera-control="rotate"]').dispatchEvent('input');await host.locator('[data-camera-control="zoom"]').evaluate(el=>el.value='120');await host.locator('[data-camera-control="zoom"]').dispatchEvent('input');
 const camera=await host.evaluate(()=>{const c=CallbackCamera.code();CallbackCamera.reset();CallbackCamera.load(c);return CallbackCamera.get()});assert.equal(camera.rotate,35);assert.equal(camera.zoom,1.2);record('preserved camera settings and camera codes work');
 await host.locator('[data-camera-action="close"]').click();await host.locator('[data-ovl="settings"]').getByRole('button',{name:'Done'}).click();assert.equal(await host.evaluate(()=>RoyalSumo.debug.stats().paused),true);await host.getByRole('button',{name:'Resume',exact:true}).click();assert.equal(await host.evaluate(()=>RoyalSumo.debug.stats().paused),false);record('settings close remains paused until explicit Resume');
 for(const map of ['keep','floe','plaza','wharf','teeter','mesa']){await host.evaluate(map=>{RoyalSumo.scenario({map,fighters:10,seed:21});RoyalSumo.debug.advance(3.6)},map);assert.equal(await host.evaluate(()=>RoyalSumo.getState().n),10)}record('all six arenas start with ten fighters');
 assert.deepEqual(errors,[]);record('no browser runtime errors');
 await writeFile(join(dir,'browser-results.json'),JSON.stringify({date:new Date().toISOString(),checks,errors,limits:['Software WebGL; no physical phone or gamepad testing','Local WebSocket transport; public relay not deployed']},null,2));
}finally{await browser?.close();await server.close()}
