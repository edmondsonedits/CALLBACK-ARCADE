// Ordinary Chromium, real production entry and native UI. No injected game hooks.
export const rollerRuckus = {
 id:'royal-roller-ruckus',entry:'games/royal-roller-ruckus/source/index.html',
 async exercise({page,check,capture,profile}) {
  await page.locator('#setupOverlay.open').waitFor();
  await page.locator('#loading').waitFor({state:'hidden',timeout:20000});
  const render=await page.locator('#viewport canvas').evaluate(canvas=>{
   const gl=canvas.getContext('webgl2');
   return {width:canvas.width,height:canvas.height,webgl2:!!gl,lost:gl?.isContextLost()??true};
  });
  check('production Three renderer creates a live WebGL2 context',render.webgl2&&!render.lost&&render.width>0&&render.height>0,render);
  await capture('title');
  await page.locator('#startRaceBtn').click();
  await page.locator('#setupOverlay.open').waitFor({state:'hidden'});
  await page.waitForTimeout(3600);
  if(profile.touch){
   const stick=await page.locator('#joyWrap').boundingBox();
   await page.touchscreen.tap(stick.x+stick.width/2,stick.y+stick.height*.22);
  }else{
   await page.keyboard.down('w');await page.waitForTimeout(600);await page.keyboard.up('w');
  }
  await capture('race');
  check('race timer begins',await page.locator('#timer').innerText()!=='0:00.0');
  await page.locator('#settingsBtn').click();await page.locator('#settingsModal.open').waitFor();
  await capture('settings');
  await page.locator('#closeSettings').click();await page.locator('#pauseOverlay.open').waitFor();
  await page.locator('#pauseMenuBtn').click();await page.locator('#setupOverlay.open').waitFor();
  check('settings and pause return cleanly to title',await page.locator('#startRaceBtn').isVisible());
 }
};
