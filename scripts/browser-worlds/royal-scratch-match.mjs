export const scratchMatch = {
 id:'royal-scratch-match',entry:'games/royal-scratch-match/source/index.html',
 async exercise({page,check,capture,profile}) {
  const state=()=>page.evaluate(()=>window.ScratchMatchAPI.getState());
  const reveal=async selector=>{const field=page.locator(selector);if(!await field.isVisible()){const group=field.locator('xpath=ancestor::details').first();if(await group.count())await group.locator('summary').first().click();}return field;};
  const bounds=async selector=>page.locator(selector).evaluateAll(els=>els.filter(el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&el.getBoundingClientRect().width>0}).map(el=>{const r=el.getBoundingClientRect();return{id:el.id||el.dataset.lane,x:r.x,y:r.y,width:r.width,height:r.height,inside:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,clipped:el.scrollWidth>el.clientWidth+1};}));
  await page.locator('#menu').waitFor({state:'visible'});
  check('title opens in demo mode',(await state()).demo.active);
  await capture('title');
  await page.locator('#watchBtn').click();await page.locator('#returnWatchBtn').waitFor({state:'visible'});
  check('Watch keeps demo active',(await state()).demo.active);await capture('watch');
  await page.locator('#returnWatchBtn').click();
  await page.locator('#setupSettingsBtn').click();await page.locator('#pauseSheet').waitFor({state:'visible'});
  await (await reveal('#modeSetting')).selectOption('practice');
  for(let i=0;i<6;i++)await page.locator('#playerPlus').click();
  const name=await reveal('#nameSetting');await name.fill('');await name.pressSequentially('Ada Lovelace');
  check('native field retains multiword name',await name.inputValue()==='Ada Lovelace');
  await name.press('Tab');await (await reveal('#costumeSetting')).selectOption('mage');
  await capture('settings');
  const footer=await bounds('#pauseSheet .settings-footer button');check('settings footer stays inside viewport',footer.length>0&&footer.every(x=>x.inside),footer);
  await page.locator('#resumeBtn').click();
  for(const stage of ['royal','tide','foundry','mirror']) {
   await page.locator('#stageSetting').selectOption(stage);
   await page.waitForFunction(id=>window.ScratchMatchAPI.getState().demo.stage===id,stage);
   const before=await state();await page.waitForTimeout(1800);const after=await state();
   check(`${stage}: demo advances`,before.demo.phaseTime!==after.demo.phaseTime||before.demo.phase!==after.demo.phase||before.demo.resolved!==after.demo.resolved,{before:before.demo,after:after.demo});
   check(`${stage}: demo leaves the real session untouched`,after.totalInputs===before.totalInputs&&after.totalResolved===before.totalResolved&&JSON.stringify(after.players)===JSON.stringify(before.players));
   check(`${stage}: page has no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await capture(`${stage}-demo`);
   await page.locator('#startBtn').click();await page.locator('#menu').waitFor({state:'hidden'});
   const start=await state();
   check(`${stage}: clean ten-seat rehearsal start`,!start.demo.active&&start.stage===stage&&start.playerCount===10&&start.players[0].name==='Ada Lovelace'&&start.totalInputs===0&&start.totalResolved===0,{stage:start.stage,seats:start.playerCount,name:start.players[0].name,phase:start.phase});
   await page.waitForFunction(()=>window.ScratchMatchAPI.getState().phase==='call',null,{timeout:20000});
   await page.waitForTimeout(900);await capture(`${stage}-call`);
   const controls=await bounds('#controls .beat-btn');check(`${stage}: all four touch controls fit`,controls.length===4&&controls.every(x=>x.inside),controls);
   await page.waitForFunction(()=>window.ScratchMatchAPI.getState().phase==='response',null,{timeout:25000});
   const response=await state(), first=response.pattern[0];
   if(stage==='mirror')check('Mirror exposes the advertised legal echo lanes',JSON.stringify(first.responseLanes)===JSON.stringify(first.lanes.map(x=>3-x).sort((a,b)=>a-b)),first);
   await page.waitForFunction(t=>window.ScratchMatchAPI.getState().phaseTime>=t-.08,first.time,{timeout:8000});
   if(profile.touch){for(const lane of first.responseLanes)await page.locator(`.beat-btn[data-lane="${lane}"]`).tap();}
   else {for(const lane of first.responseLanes)await page.keyboard.press(['d','f','j','k'][lane]);}
   check(`${stage}: real ${profile.touch?'touch':'keyboard'} input reaches the game`,(await state()).totalInputs>response.totalInputs);
   await capture(`${stage}-response`);
   if(stage==='foundry') {
    await page.waitForFunction(()=>window.ScratchMatchAPI.getState().phase==='practiceReview',null,{timeout:25000});
    const original=(await state()).pattern.map(n=>[n.time,n.lanes,n.responseLanes]);
    const actions=await bounds('#practiceActions button');check('rehearsal actions fit the viewport',actions.length===3&&actions.every(x=>x.inside),actions);
    await capture('rehearsal-review');
    await page.locator('#repeatPhraseBtn').click();
    const retry=await state();check('Repeat phrase returns to the same chord pattern',retry.phase==='call'&&JSON.stringify(retry.pattern.map(n=>[n.time,n.lanes,n.responseLanes]))===JSON.stringify(original));
   }
   await page.locator('#pauseBtn').click();const paused=await state();await page.waitForTimeout(200);const still=await state();
   check(`${stage}: settings pauses the musical clock`,paused.paused&&still.phaseTime===paused.phaseTime,{before:paused.phaseTime,after:still.phaseTime});
   await page.locator('#pauseMenuBtn').click();await page.locator('#menu').waitFor({state:'visible'});
   check(`${stage}: returning to title resumes a demo`,(await state()).demo.active);
  }
  await page.locator('#setupSettingsBtn').click();await (await reveal('#modeSetting')).selectOption('tour');await page.locator('#resumeBtn').click();
  await page.locator('#startBtn').click();const tour=await state();
  check('Tour starts at Royal Hall with clean standings',tour.mode==='tour'&&tour.stage==='royal'&&tour.tour.index===0&&tour.tour.records.length===0,tour.tour);
  await capture('tour-start');
  check('customization offers at least twelve real native settings',await page.locator('#pauseSheet input,#pauseSheet select').count()>=12);
 }
};
