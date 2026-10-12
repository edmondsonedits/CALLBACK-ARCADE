// Ordinary Chromium, production entry and native UI. No injected game hooks.
export const rollerRuckus = {
 id:'royal-roller-ruckus',entry:'games/royal-roller-ruckus/source/index.html',
 async exercise({page,check,capture,profile}) {
  page.setDefaultTimeout(45000); // Software WebGL startup is slower than Canvas in this runner.
  const state=()=>page.evaluate(()=>window.CallbackRace.getState());
  const bounds=async selector=>page.locator(selector).evaluateAll(els=>els.filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getBoundingClientRect().width>0}).map(el=>{const r=el.getBoundingClientRect();return{id:el.id,x:r.x,y:r.y,width:r.width,height:r.height,inside:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,clipped:el.scrollWidth>el.clientWidth+1};}));
  const toTitle=async()=>{await page.locator('#settingsBtn').click();await page.locator('#closeSettings').click();await page.locator('#pauseOverlay.open').waitFor();await page.locator('#pauseMenuBtn').click();await page.locator('#setupOverlay.open').waitFor();};
  await page.locator('#setupOverlay.open').waitFor();
  await page.locator('#loading').waitFor({state:'hidden',timeout:45000});
  await page.waitForFunction(()=>window.CallbackRace);
  const render=await page.locator('#viewport canvas').evaluate(canvas=>{
   const gl=canvas.getContext('webgl2');
   const ext=gl?.getExtension('WEBGL_debug_renderer_info');
   return {width:canvas.width,height:canvas.height,webgl2:!!gl,lost:gl?.isContextLost()??true,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};
  });
  check('production Three renderer creates a live WebGL2 context',render.webgl2&&!render.lost&&render.width>0&&render.height>0,render);
  check('title is a real all-bot demo',(await state()).isDemo&&(await state()).demo.allBots);
  check('responsive title preserves word spacing',/ROYAL\s+ROLLER RUCKUS/.test(await page.locator('.setup-card h1').innerText()));
  await capture('title-default-balanced');
  await page.locator('#setupOptionsBtn').click();await page.locator('#graphics').selectOption('performance');await page.locator('#closeSettings').click();
  check('sustained flow QA uses the real Performance preference',await page.locator('#graphics').inputValue()==='performance');
  await capture('title-performance');
  await page.locator('#watchBtn').click();await page.locator('#watchBar.open').waitFor();
  const watch=await bounds('#watchStartBtn,#watchReturnBtn');check('Watch Start and Return fit',watch.length===2&&watch.every(x=>x.inside),watch);
  await capture('watch');
  await page.locator('#watchReturnBtn').click();await page.locator('#watchBtn').click();await page.locator('#watchStartBtn').click();
  const started=await state();check('Watch Start creates clean real race',!started.isDemo&&started.raceTime===0&&started.racers.every(r=>r.lap===0&&!r.finished));
  await toTitle();
  await page.locator('#setupOptionsBtn').click();
  await page.locator('#racerCount').selectOption('10');await page.locator('#sessionMode').selectOption('practice');
  await page.locator('#playerName').fill('');await page.locator('#playerName').pressSequentially('Ada Lovelace');
  check('native name supports spaces and empty editing',await page.locator('#playerName').inputValue()==='Ada Lovelace');
  await page.locator('#playerName').press('Tab');await page.locator('#cageTrim').selectOption('gold');await page.locator('#helmetStyle').selectOption('crown');
  await capture('settings');
  const footer=await bounds('#settingsModal .modal-buttons button');check('settings actions fit viewport',footer.length===2&&footer.every(x=>x.inside),footer);
  check('at least twelve meaningful native preferences exist',await page.locator('#settingsModal input,#settingsModal select,#settingsModal button.toggle').count()>=12);
  await page.locator('#closeSettings').click();
  for(const course of ['crownway','frostglass','foundry','skygarden']) {
   await page.locator('#setupOptionsBtn').click();await page.locator('#courseSetting').selectOption(course);await page.locator('#closeSettings').click();
   await page.waitForFunction(id=>window.CallbackRace.getState().activeCourse===id,course);
   const before=await state(),wallStart=Date.now();await page.waitForTimeout(1600);const after=await state(),wallSeconds=(Date.now()-wallStart)/1000;
   check(`${course}: live demo advances real racers`,after.isDemo&&after.demo.time>before.demo.time&&JSON.stringify(after.racers.map(r=>r.position))!==JSON.stringify(before.racers.map(r=>r.position)),{wallSeconds,simulationSeconds:after.demo.time-before.demo.time,graphics:'performance'});
   check(`${course}: demo leaves real race clock untouched`,after.raceTime===before.raceTime);
   check(`${course}: scene remains finite`,after.racers.every(r=>r.position.every(Number.isFinite)));
   check(`${course}: no horizontal page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await capture(`${course}-demo`);
   await page.locator('#startRaceBtn').click();const fresh=await state();
   check(`${course}: selected ten-seat practice starts cleanly`,!fresh.isDemo&&fresh.activeCourse===course&&fresh.rules.seats===10&&fresh.rules.laps===1&&fresh.racers[0].name==='Ada Lovelace'&&fresh.racers.every(r=>r.lap===0&&!r.finished),fresh.rules);
   await page.waitForFunction(()=>window.CallbackRace.getState().phase==='race',null,{timeout:60000});
   if(profile.touch){
    const stick=await page.locator('#joyWrap').boundingBox();await page.touchscreen.tap(stick.x+stick.width/2,stick.y+stick.height*.25);
    await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height*.25);await page.mouse.down();await page.waitForTimeout(700);await page.mouse.up();
   }else{await page.keyboard.down('w');await page.waitForTimeout(700);await page.keyboard.up('w');}
   const racing=await state();check(`${course}: simulation advances after native input`,racing.raceTime>0&&racing.racers.every(r=>r.position.every(Number.isFinite)));
   await capture(`${course}-race`);
   const controls=await bounds('#joyWrap,#respawnBtn');check(`${course}: steering and any visible recovery action fit`,controls.some(x=>x.id==='joyWrap')&&controls.every(x=>x.inside),controls);
   const cue=await page.evaluate(()=>{const a=document.querySelector('.guidance').getBoundingClientRect(),b=document.querySelector('.speed-pill').getBoundingClientRect();return {cue:{top:a.top,bottom:a.bottom,left:a.left,right:a.right},speed:{top:b.top,bottom:b.bottom,left:b.left,right:b.right},clear:a.top>=b.bottom||a.bottom<=b.top||a.left>=b.right||a.right<=b.left};});
   check(`${course}: coaching clears the speed display`,cue.clear,cue);
   if(course==='crownway') {
    const recoveries=(await state()).racers[0].recoveries;
    await page.keyboard.down('a');
    try {await page.locator('#respawnBtn.show').waitFor({state:'visible',timeout:60000});} finally {await page.keyboard.up('a');}
    const recovery=await bounds('#respawnBtn');check('visible recovery button fits after a real fall',recovery.length===1&&recovery.every(x=>x.inside),recovery);
    if(profile.touch)await page.locator('#respawnBtn').tap();else await page.locator('#respawnBtn').click();
    await page.waitForFunction(n=>window.CallbackRace.getState().racers[0].recoveries>n,recoveries);
    check('native recovery action returns a fallen racer',(await state()).racers[0].recoveries>recoveries);
    await capture('recovered');
   }
   await page.locator('#settingsBtn').click();const paused=await state();await page.waitForTimeout(200);check(`${course}: settings freezes race clock`,paused.paused&&(await state()).raceTime===paused.raceTime);
   await page.locator('#courseSetting').selectOption(course==='crownway'?'foundry':'crownway');check(`${course}: map edit stages until next Start`,(await state()).activeCourse===course);
   await page.locator('#closeSettings').click();await page.locator('#pauseOverlay.open').waitFor();await page.locator('#pauseMenuBtn').click();
   check(`${course}: title resumes a bot session`,(await state()).isDemo);
  }
  await page.locator('#setupOptionsBtn').click();await page.locator('#sessionMode').selectOption('series');await page.locator('#closeSettings').click();await page.locator('#startRaceBtn').click();
  const series=await state();check('Series begins on Crownway with empty scores',series.mode==='series'&&series.activeCourse==='crownway'&&series.series.index===0&&series.series.races.length===0&&series.series.scores.every(x=>x===0),series.series);
  await capture('series-start');
  check('local licensed scenery loaded',(await state()).assets.loaded>0,(await state()).assets);
 }
};
