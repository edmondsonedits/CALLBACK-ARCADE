export const blindCrown={id:'blind-crown',entry:'games/blind-crown/source/index.html',async exercise({page,check,capture,profile}){
 const state=()=>page.evaluate(()=>window.BlindCrownDebug.getState());
 const session=()=>page.evaluate(()=>window.BlindCrownDebug.getSession());
 const closeSettings=async()=>page.locator('#settingsClose').click();
 const title=async()=>{await page.locator('#settingsBtn').click();await page.locator('#menuBtn').click();await closeSettings();};
 await page.locator('#overlayStart').waitFor({state:'visible'});await page.waitForFunction(()=>window.BlindCrownDebug?.getSession);
 await capture('title');check('title heading clears demo status and remains inside scroll viewport',await page.evaluate(()=>{const h=document.querySelector('#welcomeTitle').getBoundingClientRect(),o=document.querySelector('#arenaBackdrop').getBoundingClientRect(),b=document.querySelector('#demoBar').getBoundingClientRect();return h.top>=o.top&&h.bottom<=o.bottom&&h.top>=b.bottom;}));const first=await session();await page.waitForTimeout(1200);const later=await session();check('live demo advances without starting a real match',later.demoElapsed>first.demoElapsed&&(await state()).phase==='lobby',later);
 await page.locator('#watchDemo').click();await page.locator('#returnDemo').waitFor({state:'visible'});await capture('watch');await page.locator('#returnDemo').click();
 await page.locator('#settingsBtn').click();await page.locator('#botSlider').focus();await page.keyboard.press('End');await page.locator('#timeSelect').selectOption('8');await page.locator('#nameInput').fill('');await page.locator('#nameInput').pressSequentially('Ada Lovelace');check('native name retains spaces while editing',await page.locator('#nameInput').inputValue()==='Ada Lovelace');await page.locator('#nameInput').press('Tab');
 const maps=await page.locator('#arenaSelect option').evaluateAll(es=>es.map(e=>e.value));check('four tactical arenas selectable',maps.length===4,maps);check('at least twelve customization controls',await page.locator('#settingsDialog input,#settingsDialog select').count()>=12);await capture('settings');await closeSettings();
 for(const map of maps){
  await page.locator('#settingsBtn').click();await page.locator('#arenaSelect').selectOption(map);await closeSettings();await page.waitForTimeout(1100);await capture(`${map}-demo`);
  check(`${map}: no horizontal page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#overlayStart').click();await page.waitForFunction(()=>window.BlindCrownDebug.getState().phase==='planning');const s=await state();check(`${map}: ten seats start on selected arena`,s.players.length===10&&s.settings.arena===map,s.settings);check(`${map}: rival private plans are absent`,s.players.slice(1).every(p=>!('x' in p)&&!('y' in p)&&!('a' in p)));
  await page.locator('#lockBtn').click();check(`${map}: native lock commits local plan`,(await state()).players[0].locked);await capture(`${map}-planning`);await title();
 }
 await page.locator('#settingsBtn').click();await page.locator('#sessionSelect').selectOption('tour');await closeSettings();await page.locator('#overlayStart').click();const tour=await session();
 if(profile.name==='desktop'){
  for(const view of ['overhead','isometric','third','first']){await page.locator('#quickView').selectOption(view);await capture(`camera-${view}`);}
 }
 await page.locator('#nextStage').waitFor({state:'visible',timeout:120000});await capture('tour-stage-result');check('results heading starts inside scroll viewport',await page.evaluate(()=>{const h=document.querySelector('#welcomeTitle').getBoundingClientRect(),o=document.querySelector('#arenaBackdrop').getBoundingClientRect();return h.top>=o.top&&h.bottom<=o.bottom;}));const ended=await session();check('Tour records a completed stage',ended.tour.records.length===1,ended);check('incomplete Tour does not reveal future seed data',ended.captured===null&&ended.tour.records.every(r=>!('seed' in r)),ended.tour);
 if(profile.name==='desktop'){
  await page.locator('#settingsBtn').click();await page.locator('#reviewBtn').click();await page.locator('#reviewDialog').waitFor({state:'visible'});check('review contains completed rounds',await page.locator('#reviewRound option').count()>0);await page.locator('#reviewScrub').focus();await page.keyboard.press('Home');await capture('completed-review');await page.locator('#reviewClose').click();await closeSettings();
 }
 await page.locator('#settingsBtn').click();await page.locator('#botSlider').focus();await page.keyboard.press('Home');await closeSettings();
 if(profile.name==='portrait'){await page.locator('#replayStage').click();const replay=await session();check('Replay restarts captured stage and preserves earned Tour history',replay.captured===null&&replay.historyRounds===0&&JSON.stringify(replay.tour.records)===JSON.stringify(ended.tour.records)&&JSON.stringify(replay.tour.standings)===JSON.stringify(ended.tour.standings)&&replay.tour.stage===1&&(await state()).phase==='planning'&&(await state()).players.length===10,replay);await capture('tour-replay');}
 else {await page.locator('#nextStage').click();const next=await session();check('Next advances Tour',next.tour.stage===2&&(await state()).players.length===10,next);await capture('tour-next');}
}};
