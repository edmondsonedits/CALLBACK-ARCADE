import { expect, test } from '@playwright/test';
import { AVATAR_PRESETS } from '../lib/avatar-motion';
import {OwnedPartyRooms} from './helpers/owned-party-rooms';
const ownedRooms=new OwnedPartyRooms();
test.afterEach(()=>ownedRooms.closeAll());
const baseURL=process.env.CALLBACK_TEST_BASE_URL??'http://localhost:3000';
const headers={Origin:baseURL,'X-Callback-Test-Mode':'deterministic-matrix'};
test('phone sections fit, all nine reactions send changing poses, and offline and reload reconnect',async({browser})=>{
  const host=await browser.newContext({baseURL});
  const phone=await browser.newContext({baseURL,viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  try {
    const created=await host.request.post('/api/rooms',{headers,data:{gameLength:'pictures',contentMode:'party',timerAccessibility:false}});
    expect(created.status()).toBe(201);const {code}=await created.json();await ownedRooms.track(host,code,baseURL);
    expect((await phone.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:'Danny'}})).status()).toBe(201);
    const page=await phone.newPage();await page.goto(`/play/${code}`);
    const fits=async()=>expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth<=innerWidth,y:document.documentElement.scrollHeight<=innerHeight+1,over:[...document.querySelectorAll<HTMLElement>('.phone-section-screen:not([hidden]),.avatar-puppet-panel')].some(el=>el.scrollHeight>el.clientHeight+1)}))).toEqual({x:true,y:true,over:false});
    await page.getByRole('button',{name:'Character',exact:true}).click();
    await page.screenshot({path:'.logs/qa-phone-polish/phone-drag.png'});
    await fits();await page.getByRole('button',{name:'Reactions',exact:true}).click();
    for(const name of AVATAR_PRESETS){
      const sent=page.waitForResponse(response=>response.url().endsWith('/avatar-poses')&&response.request().method()==='POST'&&response.status()===204&&Object.values(response.request().postDataJSON().pose).some(v=>Math.abs(Number(v))>.15));
      await page.locator(`[data-avatar-preset="${name}"]`).click();await sent;
      await fits();
      const settled=page.waitForResponse(response=>response.url().endsWith('/avatar-poses')&&response.request().method()==='POST'&&response.status()===204&&Object.values(response.request().postDataJSON().pose).every(v=>Math.abs(Number(v))<.15));
      await page.getByRole('button',{name:'Settle',exact:true}).click();await settled;
    }
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByRole('button',{name:'Game',exact:true}).click();await fits();
    const versionBefore=(await(await host.request.post(`/api/rooms/${code}/sync`,{headers,data:{version:0}})).json()).version;
    await phone.setOffline(true);await expect(page.locator('.connection-banner')).toBeVisible();
    await expect(page.locator('.phone-self strong')).toHaveText('Danny');await fits();
    await phone.setOffline(false);await expect(page.locator('.connection-banner')).toHaveCount(0);
    await page.getByRole('button',{name:'Character',exact:true}).click();await page.getByRole('button',{name:'Reactions',exact:true}).click();
    const recovered=page.waitForResponse(response=>response.url().endsWith('/avatar-poses')&&response.request().method()==='POST'&&response.status()===204&&Math.abs(response.request().postDataJSON().pose.rightArm)>10);
    await page.getByRole('button',{name:'Wave',exact:true}).click();await recovered;
    expect((await(await host.request.post(`/api/rooms/${code}/sync`,{headers,data:{version:0}})).json()).version).toBe(versionBefore);
    await page.getByRole('button',{name:'Game',exact:true}).click();
    for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);await page.getByRole('button',{name:'Character',exact:true}).click();await fits();await page.getByRole('button',{name:'Game',exact:true}).click();}
    await page.reload();await expect(page.locator('.phone-self strong')).toHaveText('Danny');await fits();
    await page.screenshot({path:'.logs/qa-phone-polish/phone-game.png'});
  }finally{await phone.close();await host.close();}
});

test('shared phone style editor fits and boundary values save',async({browser})=>{
 const host=await browser.newContext({baseURL});const phone=await browser.newContext({baseURL,viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 try{
  const {code}=await(await host.request.post('/api/sessions',{headers,data:{}})).json();
  await phone.request.post(`/api/sessions/${code}/join`,{headers,data:{nickname:'Danny'}});
  const page=await phone.newPage();await page.goto(`/session/${code}/play`);await expect(page.getByRole('heading',{name:'Welcome, Danny'})).toBeVisible();await page.getByRole('button',{name:'Style',exact:true}).click();await page.getByRole('button',{name:'Customize character',exact:true}).click();
  const modal=page.getByRole('dialog');await modal.locator('.avatar-mobile-modes').getByRole('button',{name:'Style',exact:true}).click();
  for(const field of ['faceWidth','faceHeight','browSpacing','eyeTilt','eyeHeight','glassesHeight','glassesSize','noseSize','facialHairSize','bodyHeight']){
   await modal.locator('.avatar-mobile-controls select').first().selectOption(field);
   const slider=modal.locator('.avatar-mobile-controls input[type=range]');await slider.focus();await page.keyboard.press('End');
  }
  for(const size of [{width:320,height:568},{width:390,height:844},{width:667,height:375}]){
   await page.setViewportSize(size);
   expect(await modal.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.right<=innerWidth+1;})).toBe(true);
   const done=await modal.getByRole('button',{name:/Use this avatar/}).boundingBox();expect(done!.y+done!.height).toBeLessThanOrEqual(size.height);
  }
  await page.screenshot({path:'.logs/qa-phone-polish/phone-style.png'});
  await modal.getByRole('button',{name:/Use this avatar/}).click();
  const saved=page.waitForResponse(r=>r.url().endsWith('/api/profile')&&r.request().method()==='PUT');await page.getByRole('button',{name:'Save character',exact:true}).click();expect((await saved).status()).toBe(200);
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.getByRole('heading',{name:'Welcome, Danny'})).toBeVisible();
 }finally{await phone.close();await host.close();}
});

test('game tasks stay coherent and preserve private drafts across sections',async({browser})=>{
 const host=await browser.newContext({baseURL});const phone=await browser.newContext({baseURL,viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 try{
  const {code}=await(await host.request.post('/api/rooms',{headers,data:{gameLength:'pictures',contentMode:'party',timerAccessibility:false}})).json();
  await phone.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:'Danny'}});
  const sync=async()=> (await host.request.post(`/api/rooms/${code}/sync`,{headers,data:{version:0}})).json();
  const action=async(type:string)=>{const s=await sync();const r=await host.request.post(`/api/rooms/${code}/host-actions`,{headers,data:{type,actionId:crypto.randomUUID(),roundId:s.roundId,expectedPhase:s.phase,payload:{}}});expect(r.status(),await r.text()).toBe(200);};
  const page=await phone.newPage();await page.goto(`/play/${code}`);await expect(page.locator('.phone-self strong')).toHaveText('Danny');
  await page.getByRole('button',{name:'Style',exact:true}).click();await page.getByRole('button',{name:'Customize character',exact:true}).click();
  const editor=page.getByRole('dialog');await editor.locator('.avatar-mobile-modes').getByRole('button',{name:'Style',exact:true}).click();await editor.locator('.avatar-mobile-controls select').first().selectOption('outfitColor');await editor.locator('.avatar-mobile-controls select').nth(1).selectOption('red');await editor.getByRole('button',{name:/Use this avatar/}).click();await page.getByRole('button',{name:'Save character',exact:true}).click();
  await expect(page.getByRole('button',{name:'Game',exact:true})).toHaveAttribute('aria-pressed','true');expect((await sync()).players[0].avatarConfig.outfitColor).toBe('red');
  await action('ADD_BOT');await action('START_GAME');for(let i=0;i<3&&(await sync()).phase!=='ANSWERING';i++)await action('SKIP');
  await expect(page.locator('#creative-answer')).toBeAttached();
  await expect(page.getByRole('button',{name:'Next area',exact:true})).toHaveCount(0);
  await expect(page.locator('#creative-answer')).toBeInViewport();
  await page.locator('#creative-answer').fill('A royal corgi DJ on the moon');
  await page.getByRole('button',{name:'Character',exact:true}).click();await page.getByRole('button',{name:'Game',exact:true}).click();await expect(page.locator('#creative-answer')).toHaveValue('A royal corgi DJ on the moon');
  await expect(page.getByRole('button',{name:'Next screen',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  await page.screenshot({path:'.logs/qa-phone-polish/phone-task.png'});
  await page.setViewportSize({width:667,height:321});
  await page.locator('#creative-answer').focus();
  await expect.poll(()=>page.locator('#creative-answer').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.phone-content')!.getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1;})).toBe(true);
  await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>{const r=document.activeElement!.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;})).toBe(true);
  await page.getByRole('button',{name:'Character',exact:true}).click();await page.getByRole('button',{name:'Reactions',exact:true}).click();
  const pad=page.locator('.avatar-puppet-panel');for(let i=0;i<3;i++){expect(await pad.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);for(const button of await pad.locator('[data-avatar-preset]').all()){const box=await button.boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(321);}if(i<2)await pad.getByRole('button',{name:'Next',exact:true}).click();}
  await page.screenshot({path:'.logs/qa-phone-polish/phone-landscape.png'});
 }finally{await phone.close();await host.close();}
});

test('ten names fit the shared phone lobby without scrolling',async({browser})=>{
 const host=await browser.newContext({baseURL});const phones=[];
 try{
  const {code}=await(await host.request.post('/api/sessions',{headers,data:{}})).json();
  for(let i=0;i<10;i++){const phone=await browser.newContext({baseURL,viewport:{width:320,height:568},isMobile:true,hasTouch:true});phones.push(phone);expect((await phone.request.post(`/api/sessions/${code}/join`,{headers,data:{nickname:i===0?'Danny':'Long Friend Name '+i}})).status()).toBe(201);}
  const page=await phones[0]!.newPage();await page.goto(`/session/${code}/play`);await expect(page.locator('.session-phone-roster span')).toHaveCount(10);
  for(const size of [{width:320,height:568},{width:667,height:375}]){await page.setViewportSize(size);expect(await page.locator('.session-phone-roster span').evaluateAll(items=>items.every(item=>{const r=item.getBoundingClientRect(),panel=item.closest('.phone-section-screen')!.getBoundingClientRect();return r.top>=panel.top&&r.bottom<=panel.bottom+1&&r.right<=innerWidth;}))).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);}
  await page.screenshot({path:'.logs/qa-phone-polish/phone-ten-names.png'});
 }finally{await Promise.all(phones.map(p=>p.close()));await host.close();}
});

test('crowded game lobby keeps every player and character control reachable at enlarged text',async({browser})=>{
 const host=await browser.newContext({baseURL});const phones=[];
 try{
  const created=await host.request.post('/api/rooms',{headers,data:{gameLength:'pictures',contentMode:'party',timerAccessibility:false}});
  expect(created.status()).toBe(201);const {code}=await created.json();await ownedRooms.track(host,code,baseURL);
  for(let i=0;i<10;i++){const phone=await browser.newContext({baseURL,viewport:{width:320,height:568}});phones.push(phone);expect((await phone.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:'Friend '+i}})).status()).toBe(201);}
  const page=await phones[0]!.newPage();await page.goto(`/play/${code}`);await expect(page.locator('.mini-roster>span')).toHaveCount(10);await expect(page.locator('.mini-roster').getByTitle('Friend 9',{exact:true})).toBeVisible();
  await page.addStyleTag({content:'html{font-size:20px!important}'});
  for(const size of [{width:320,height:568},{width:667,height:375}]){
   await page.setViewportSize(size);
   for(const control of await page.locator('.lobby-phone button,.mini-roster>*').all()){await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();}
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);
  }
 }finally{await Promise.all(phones.map(p=>p.close()));await host.close();}
});
test('character profile actions stay readable and editable on narrow phones',async({browser})=>{
 const host=await browser.newContext({baseURL});const phone=await browser.newContext({baseURL,viewport:{width:320,height:568},isMobile:true,hasTouch:true});
 try{
  const {code}=await(await host.request.post('/api/sessions',{headers,data:{}})).json();
  expect((await phone.request.post(`/api/sessions/${code}/join`,{headers,data:{nickname:'Danny'}})).status()).toBe(201);
  const page=await phone.newPage();await page.goto(`/session/${code}/play`);await expect(page.getByRole('heading',{name:'Welcome, Danny'})).toBeVisible();await page.getByRole('button',{name:'Style',exact:true}).click();
  for(const width of [320,390]){
   await page.setViewportSize({width,height:568});
   const customize=page.getByRole('button',{name:'Customize character',exact:true});const saved=page.getByRole('button',{name:'Character saved',exact:true});await expect(saved).toBeDisabled();
   const styles=await page.evaluate(()=>{const parse=(value:string)=>{const m=value.match(/[\d.]+/g)!.map(Number);return [m[0]!,m[1]!,m[2]!,m[3]??1] as const;};const effectiveBackground=(el:Element)=>{let node:Element|null=el;let layer=[0,0,0,0];while(node){const c=parse(getComputedStyle(node).backgroundColor),alpha=c[3],outAlpha=alpha+layer[3]*(1-alpha);layer=[0,1,2].map(i=>outAlpha?(c[i]*alpha+layer[i]*layer[3]*(1-alpha))/outAlpha:0).concat(outAlpha) as [number,number,number,number];if(outAlpha>=.999)return layer;node=node.parentElement;}return [0,1,2].map(i=>layer[i]*layer[3]+255*(1-layer[3]));};const contrast=(el:Element)=>{const s=getComputedStyle(el),fg=parse(s.color),bg=effectiveBackground(el),lum=(c:readonly number[])=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i]!,0),[a,b]=[lum(fg),lum(bg)].sort((x,y)=>y-x);return {ratio:(a+.05)/(b+.05),opacity:s.opacity};};return {customize:contrast(document.querySelector('.character-profile-actions .button-secondary')!),saved:contrast(document.querySelector('.character-profile-actions .button-primary:disabled')!)};});
   expect(styles.customize.ratio,`customize contrast at ${width}px`).toBeGreaterThanOrEqual(4.5);expect(styles.saved.ratio,`saved contrast at ${width}px`).toBeGreaterThanOrEqual(4.5);expect(styles.saved.opacity).toBe('1');
   await expect(page.getByRole('button',{name:'Use a face photo',exact:true})).toBeVisible();
   {const buttons=await page.locator('.character-profile-actions .button').evaluateAll(items=>items.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height};}));expect(buttons).toHaveLength(3);for(const box of buttons){expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);expect(box.y).toBeGreaterThanOrEqual(0);expect(box.bottom).toBeLessThanOrEqual(568);}await page.screenshot({path:'.logs/qa-phone-polish/character-profile-390.png'});}
   await customize.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:/Use this avatar/}).click();await expect(customize).toBeVisible();
  }
 }finally{await phone.close();await host.close();}
});
