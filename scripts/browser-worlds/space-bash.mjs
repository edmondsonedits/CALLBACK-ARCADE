// Native production UI and genuine simulation; no injected state.
export const spaceBash={id:'space-bash',entry:'games/space-bash/source/index.html',async exercise({page,check,capture,profile}){
 const state=()=>page.evaluate(()=>window.SpaceBash.getState());
 const openGroup=async id=>page.locator(id).evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
 const fit=async selector=>page.locator(selector).evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,inside:r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1,height:r.height};}));
 await page.locator('#setup.open').waitFor();await page.waitForFunction(()=>window.SpaceBash?.getState().demo);
 check('title has a live all-bot session',(await state()).demo);await capture('title');
 await page.locator('#watchDemo').click();await page.locator('#returnTitle').waitFor({state:'visible'});await capture('watch');await page.locator('#returnTitle').click();
 // Option IDs are read from the real controls so the test follows the published contract.
 await page.locator('#setupSettings').click();const maps=await page.locator('#map option').evaluateAll(es=>es.map(e=>e.value));
 check('four selectable decks',maps.length===4,maps);
 await page.locator('#players').selectOption('10');await openGroup('#playerName');await page.locator('#playerName').fill('');await page.locator('#playerName').pressSequentially('Ada Lovelace');
 check('native name accepts empty editing and spaces',await page.locator('#playerName').inputValue()==='Ada Lovelace');await page.locator('#playerName').press('Tab');
 check('customization has at least twelve functional controls',await page.locator('#modal input,#modal select').count()>=12);await capture('settings');
 await page.locator('#close').scrollIntoViewIfNeeded();check('settings close target fits',(await fit('#close')).every(r=>r.inside&&r.height>=44));await page.locator('#close').click();
 for(const map of maps){
  await page.locator('#setupSettings').click();await openGroup('#map');await page.locator('#map').selectOption(map);await page.locator('#mode').selectOption('classic');await page.locator('#rule').selectOption('practice');await page.locator('#close').click();
  const before=await state();await page.waitForTimeout(1100);const after=await state();check(`${map}: real bot demo advances`,after.demo&&after.demoMap===map&&after.demoFighters.length===10&&after.demoFighters.every(f=>f.control==='cpu')&&after.demoElapsed>before.demoElapsed,{elapsed:after.demoElapsed,hazard:after.demoHazard});
  check(`${map}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await capture(`${map}-demo`);
  await page.locator('#startMatch').click();await page.waitForFunction(()=>window.SpaceBash.getState().phase==='fight');const fresh=await state();check(`${map}: starts chosen ten-seat practice`,!fresh.demo&&fresh.map===map&&fresh.playerCount===10,fresh.rules);
  if(profile.touch)await page.locator('#jump').tap();else await page.keyboard.press('Space');await page.waitForFunction(()=>window.SpaceBash.getState().fighters[0].y>0);check(`${map}: native jump becomes airborne`,(await state()).fighters[0].y>0);await capture(`${map}-play`);
  await page.locator('#settings').click();const frozen=await state();await page.waitForTimeout(200);check(`${map}: settings pauses simulation`,frozen.paused&&(await state()).timeLeft===frozen.timeLeft);
  await page.locator('#map').selectOption(maps[(maps.indexOf(map)+1)%4]);check(`${map}: map preference stages until start`,(await state()).map===map);
  await page.locator('#close').click();await page.locator('#menu').click();
 }
 await page.locator('#setupSettings').click();await page.locator('#mode').selectOption('series');await page.locator('#rule').selectOption('standard');await page.locator('#roundLength').selectOption({index:0});await page.locator('#close').click();await page.locator('#startMatch').click();const series=await state();await capture('series-start');
 if(profile.name==='desktop'){
  await page.locator('#results.open').waitFor({timeout:120000});const ended=await state();check('finite Series stage records a real result',ended.series.history.length===1,ended.series);await capture('series-results');
  await page.locator('#nextStage').click();check('Next advances Series',(await state()).series.stage===1);await capture('series-next');
 }else if(profile.name==='portrait'){
  await page.locator('#results.open').waitFor({timeout:120000});await page.locator('#replay').click();const replay=await state();check('Replay resets Series and preserves seed',replay.seed===series.seed&&replay.series.stage===0&&replay.series.history.length===0,replay.series);await capture('series-replay');
 }
}};
