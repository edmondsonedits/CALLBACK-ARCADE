export const ballistix={
 id:'royal-ballistix',entry:'games/royal-ballistix/source/index.html',
 async exercise({page,check,capture,profile}) {
  const state=()=>page.evaluate(()=>window.RoyalBallistix.getState());
  const cueLayout=()=>page.evaluate(()=>{const cue=document.querySelector('#arenaCue'),roster=document.querySelector('#roster'),a=cue.getBoundingClientRect(),b=roster.getBoundingClientRect();return{overlap:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top,clipped:cue.scrollWidth>cue.clientWidth+1,inside:a.left>=0&&a.right<=innerWidth+1,top:a.top,rosterBottom:b.bottom,height:a.height}});
  await page.locator('#menuOv.open').waitFor();
  await page.waitForFunction(()=>window.RoyalBallistix?.getState().demo===true);
  check('title runs a real demo',(await state()).demo===true);
  check('no horizontal document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await capture('title');
  await page.locator('#watchDemo').click();
  await page.locator('#returnMenu').waitFor({state:'visible'});
  check('Watch keeps the live demo running',(await state()).demo===true);
  await capture('watch');
  await page.locator('#returnMenu').click();
  await page.locator('#menuOv.open').waitFor();
  for(const arena of ['beach','gale','moon','clockwork']) {
   await page.locator('#setupSettings').click();
   await page.locator('#settingsOv.open').waitFor();
   if(arena==='beach') {
    await page.locator('#styleSettings summary').click();
    await page.locator('#playerName').fill('');
    await page.locator('#playerName').pressSequentially('Ada Lovelace');
    check('native name field accepts ordinary multiword typing',await page.locator('#playerName').inputValue()==='Ada Lovelace');
    await page.locator('#styleSettings summary').click();
   }
   const field=page.locator('#arena');
   // Group disclosures may be closed. Open only the observed ancestor group.
   const group=field.locator('xpath=ancestor::details');
   if(await group.count()&&!await field.isVisible())await group.locator('summary').click();
   await field.selectOption(arena);
   await page.locator('#playerCount').selectOption('10');
   await page.locator('#close').click();
   await page.locator('#menuOv.open').waitFor();
   await page.waitForFunction(id=>window.RoyalBallistix.getState().arena===id,arena);
   const before=await state();await page.waitForTimeout(2200);const after=await state();
   check(`${arena}: demo advances simulation`,before.arenaTime!==after.arenaTime||before.demoRounds!==after.demoRounds,{before:before.arenaTime,after:after.arenaTime});
   check(`${arena}: demo does not award wins`,after.wins.every(w=>w===0),after.wins);
   await capture(`${arena}-demo`);
   await page.locator('#startSiege').click();
   await page.locator('#menuOv').waitFor({state:'hidden'});
   const started=await state();
   check(`${arena}: full roster and name survive Start`,started.playerCount===10&&started.players[0].name==='Ada Lovelace',{count:started.playerCount,name:started.players[0].name});
   check(`${arena}: starts the selected real court`,started.arena===arena&&started.demo===false,{arena:started.arena,demo:started.demo});
   await page.waitForTimeout(3600);
   await capture(`${arena}-play`);
   const cue=await cueLayout();
   check(`${arena}: hazard cue fits without covering standings`,!cue.overlap&&!cue.clipped&&cue.inside,cue);
   const controlBounds=await page.locator('#track,#magnet,#pulse').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,visible:getComputedStyle(el).display!=='none'&&r.width>0,inside:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}}));
   check(`${arena}: active controls fit viewport`,controlBounds.every(r=>!r.visible||r.inside),controlBounds);
   await page.locator('#pause').click();await page.locator('#pauseOv.open').waitFor();
   check(`${arena}: explicit pause stops play`,(await state()).paused===true);
   await page.locator('#pauseSettings').click();
   await page.locator('#settingsOv.open').waitFor();
   if(arena==='beach')await capture('settings');
   await page.locator('#close').click();
   await page.locator('#pauseOv.open').waitFor();
   check(`${arena}: settings returns to pause`,(await state()).paused===true);
   await page.locator('#pauseMenu').click();
   await page.locator('#menuOv.open').waitFor();
   check(`${arena}: menu restores demo`,(await state()).demo===true);
  }
  await page.locator('#startTour').click();
  const tour=await state();
  check('Tour starts a fresh four-court session',tour.mode==='tour'&&tour.tour?.index===0&&tour.tour?.maps.length===4,tour.tour);
  await capture('tour-start');
  const tourCue=await cueLayout();
  check('Tour cue fits without covering standings',!tourCue.overlap&&!tourCue.clipped&&tourCue.inside,tourCue);
  check('native settings controls available',await page.locator('#settingsOv input,#settingsOv select').count()>=12);
 }
};
