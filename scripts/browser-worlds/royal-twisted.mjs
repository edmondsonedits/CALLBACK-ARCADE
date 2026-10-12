// Production Three entry with native UI; no injected game state or accelerated time.
export const twisted = {
 id:'royal-twisted',entry:'games/royal-twisted/source/index.html',
 async exercise({page,check,capture,profile}) {
  page.setDefaultTimeout(45000);
  const state=()=>page.evaluate(()=>window.RoyalTwisted.getState());
  const session=()=>page.evaluate(()=>window.RoyalTwisted.getSession());
  const bounds=async selector=>page.locator(selector).evaluateAll(els=>els.filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0}).map(el=>{const r=el.getBoundingClientRect();return{id:el.id,x:r.x,y:r.y,width:r.width,height:r.height,inside:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,clipped:el.scrollWidth>el.clientWidth+1}}));
  const toTitle=async()=>{await page.locator('#settingsBtn').click();await page.locator('#closeSettings').click();await page.locator('#pauseOverlay.open').waitFor();await page.locator('#pauseMenuBtn').click();await page.locator('#setupModal.open').waitFor();};
  await page.locator('#setupModal.open').waitFor();await page.locator('#loading').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.RoyalTwisted);
  const render=await page.locator('#viewport canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{width:canvas.width,height:canvas.height,webgl2:!!gl,lost:gl?.isContextLost()??true,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null}});
  check('production renderer creates a live WebGL2 context',render.webgl2&&!render.lost&&render.width>0&&render.height>0,render);
  check('title runs a genuine bot demo',(await session()).demo===true);
  check('original camera default preserved',await page.evaluate(()=>window.CallbackCamera.code())==='CAM-3R-23-U');
  if(profile.name==='portrait'){
   const visibility=await page.evaluate(()=>{const p=window.RoyalTwisted.getState().player.screen,r=document.querySelector('#setupModal .modal')?.getBoundingClientRect();return {player:p,panel:r?{top:r.top,bottom:r.bottom}:null};});
   check('portrait menu leaves demo player visible',!!visibility.player?.head.visible&&(!!visibility.panel&&(visibility.player.head.y<visibility.panel.top||visibility.player.feet.y>visibility.panel.bottom)),visibility);
  }
  await capture('title-default-balanced');
  await page.locator('#setupSettingsBtn').click();await page.locator('#graphics').selectOption('performance');await page.locator('#closeSettings').click();
  check('sustained flow uses actual Performance preference',await page.locator('#graphics').inputValue()==='performance');
  await page.locator('#watchBtn').click();await page.locator('#returnTitleBtn').waitFor({state:'visible'});
  const watch=await bounds('#demoStartBtn,#returnTitleBtn');check('Watch Start and Return fit',watch.length===2&&watch.every(x=>x.inside),watch);
  await capture('watch');
  await page.locator('#demoStartBtn').click();const watched=await session();check('Watch Start clears demo statistics and input',!watched.demo&&watched.standings.every(r=>r.stats.clears===0));
  await toTitle();
  await page.locator('#setupSettingsBtn').click();await page.locator('#playerCount').selectOption('10');await page.locator('#goalSelect').selectOption('short');
  await page.locator('#playerName').fill('');await page.locator('#playerName').pressSequentially('Ada Lovelace');
  check('native player name keeps empty editing and spaces',await page.locator('#playerName').inputValue()==='Ada Lovelace');
  await page.locator('#playerName').press('Tab');
  check('at least twelve real preferences exist',await page.locator('#settingsModal input,#settingsModal select,#settingsModal button.toggle').count()>=12);
  await page.locator('#helmetStyle').selectOption('plume');await capture('settings');
  await page.locator('#closeSettings').scrollIntoViewIfNeeded();const footer=await bounds('#restartBtn,#closeSettings');check('settings footer actions are reachable and fit',footer.length===2&&footer.every(x=>x.inside),footer);
  await page.locator('#closeSettings').click();
  for(const tower of ['spiral','ember','frost','storm']) {
   await page.locator('#towerSelect').selectOption(tower);await page.locator('#modeSelect').selectOption('practice');
   await page.waitForFunction(id=>window.RoyalTwisted.getSession().tower===id,tower);
   const before=await state(),wallStart=Date.now();await page.waitForTimeout(1400);const after=await state(),wallSeconds=(Date.now()-wallStart)/1000;
   check(`${tower}: title bots advance real simulation`,(await session()).demo&&after.demoElapsed>before.demoElapsed&&after.controllers.every(c=>c==='ai'),{beforeElapsed:before.demoElapsed,afterElapsed:after.demoElapsed,wallSeconds,softwareFps:after.fps,render:after.render,nearest:after.nearest,pattern:after.choreography.pattern});
   check(`${tower}: no horizontal page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#setupSettingsBtn').click();await page.locator('#graphics').selectOption('balanced');await page.locator('#closeSettings').click();await page.waitForLoadState('networkidle');
   await capture(`${tower}-demo-balanced`);
   await page.locator('#setupSettingsBtn').click();await page.locator('#graphics').selectOption('performance');await page.locator('#closeSettings').click();
   await page.locator('#startBtn').click();const fresh=await session();
   check(`${tower}: clean selected ten-seat practice`,!fresh.demo&&fresh.tower===tower&&fresh.mode==='practice'&&fresh.standings.length===10&&fresh.standings[0].name==='Ada Lovelace',fresh);
   await page.waitForFunction(()=>window.RoyalTwisted.getState().phase==='fight',null,{timeout:60000});
   if(profile.touch)await page.locator('#jumpBtn').tap();else await page.keyboard.press('Space');
   await page.waitForFunction(()=>window.RoyalTwisted.getState().player.jump>0,null,{timeout:15000});
   check(`${tower}: native jump becomes airborne`,(await state()).player.jump>0);
   await capture(`${tower}-jump`);
   await page.waitForFunction(()=>window.RoyalTwisted.getState().player.jump===0,null,{timeout:30000});
   await page.keyboard.down('Shift');
   try{await page.waitForFunction(()=>window.RoyalTwisted.getState().player.duck===true);check(`${tower}: held native duck reaches grounded posture`,(await state()).player.duck);}finally{await page.keyboard.up('Shift');}
   await page.waitForFunction(()=>window.RoyalTwisted.getState().player.duck===false);
   const controls=await bounds('#jumpBtn,#duckBtn');check(`${tower}: both action targets fit viewport`,controls.length===2&&controls.every(x=>x.inside&&x.height>=44),controls);
   await page.locator('#settingsBtn').click();const paused=await state();await page.waitForTimeout(200);check(`${tower}: settings freezes gameplay clock`,paused.paused&&(await state()).time===paused.time);
   await page.locator('#settingsTower').selectOption(tower==='spiral'?'ember':'spiral');check(`${tower}: tower change stages during an active run`,(await session()).tower===tower);
   const active=(await session()).rules.goal;await page.locator('#goalSelect').selectOption(active==='short'?'long':'short');check(`${tower}: run length stages until next Start`,(await session()).rules.goal===active);await page.locator('#goalSelect').selectOption('short');
   await page.locator('#closeSettings').click();await page.locator('#pauseOverlay.open').waitFor();await page.locator('#pauseMenuBtn').click();
  }
  await page.locator('#modeSelect').selectOption('tour');await page.locator('#startBtn').click();const tour=await session();
  check('Tour begins with a finite first stage and no inherited score',tour.mode==='tour'&&tour.tower==='spiral'&&tour.tour.index===0&&tour.tour.score===0&&tour.stageDuration>0,tour);
  await capture('tour-start');
  if(profile.name==='desktop'){
   await page.locator('#settingsBtn').click();await page.locator('#playerName').fill('Ada Prime');await page.locator('#playerName').press('Tab');await page.locator('#helmetStyle').selectOption('plain');await page.locator('#closeSettings').click();await page.locator('#resumeBtn').click();
   await page.waitForFunction(()=>window.RoyalTwisted.getState().player.setback>.02,null,{timeout:240000});await capture('tour-setback');
   await page.locator('#resultsModal.open').waitFor({state:'visible',timeout:360000});const ended=await session();
   check('Tour stage reaches real finite results',ended.phase==='matchover'&&ended.tour.stages.length===1&&!ended.tour.complete,ended.tour);await capture('tour-stage-results');
   await page.locator('#nextTowerBtn').click();const next=await session();check('Next tower advances to Ember with retained stage result',next.tower==='ember'&&next.tour.index===1&&next.tour.stages.length===1,next.tour);await capture('tour-next-tower');
  }else if(profile.name==='portrait'){
   await page.locator('#settingsBtn').click();await page.locator('#playerName').fill('Ada Prime');await page.locator('#playerName').press('Tab');await page.locator('#helmetStyle').selectOption('plain');await page.locator('#closeSettings').click();await page.locator('#resumeBtn').click();
   await page.locator('#resultsModal.open').waitFor({state:'visible',timeout:360000});await capture('tour-stage-results');
   await page.locator('#rematchBtn').click();const replay=await session();check('native Replay preserves latest player style and captured rules',replay.standings[0].name==='Ada Prime'&&replay.seed===tour.seed&&replay.mode==='tour'&&replay.rules.goal===tour.rules.goal&&replay.tour.index===0&&replay.tour.stages.length===0,replay);await capture('tour-replayed');
  }
 }
};
