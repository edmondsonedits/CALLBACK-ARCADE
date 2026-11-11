import {test,expect,type Page} from '@playwright/test';

async function music(page:Page){return page.locator('audio.host-music-deck').evaluateAll(nodes=>nodes.map(node=>{const a=node as HTMLAudioElement;return {src:a.currentSrc||a.src,paused:a.paused,volume:a.volume,muted:a.muted,time:a.currentTime,duration:a.duration};}));}
async function expectMenu(page:Page){await expect.poll(async()=>{const decks=await music(page);return decks.filter(d=>!d.paused&&!d.muted&&d.volume>0.001&&d.volume<=0.111).length;}).toBe(1);}
async function beginOverlapAudit(page:Page){await page.evaluate(()=>{const w=window as typeof window&{__musicOverlap?:{timer:number;max:number}};const state={timer:0,max:0};state.timer=window.setInterval(()=>{const count=[...document.querySelectorAll<HTMLAudioElement>('audio.host-music-deck')].filter(a=>!a.paused&&!a.muted&&a.volume>0.001).length;state.max=Math.max(state.max,count);},20);w.__musicOverlap=state;});}
async function finishOverlapAudit(page:Page){return page.evaluate(()=>{const w=window as typeof window&{__musicOverlap?:{timer:number;max:number}};if(!w.__musicOverlap)return 0;clearInterval(w.__musicOverlap.timer);return w.__musicOverlap.max;});}
async function finishMusicTrack(page:Page,previousSource:string){
  const timing=await page.locator('audio.host-music-deck').evaluateAll((nodes,previousSource)=>{const a=nodes.find(n=>!(n as HTMLAudioElement).paused&&(n as HTMLAudioElement).src===previousSource) as HTMLAudioElement|undefined;if(!a)return {duration:0,time:0};const target=a.duration-3.8;const canSeek=Array.from({length:a.seekable.length},(_,i)=>[a.seekable.start(i),a.seekable.end(i)]).some(([start,end])=>start!<=target&&end!>=target);if(canSeek)a.currentTime=target;return {duration:a.duration,time:a.currentTime};},previousSource);
  expect(timing.duration).toBeGreaterThan(0);
  // Hosted media can be fully buffered while exposing no seekable timeline.
  // In that case verify its actual end rather than forcing an unsupported seek.
  await expect.poll(async()=>{const active=(await music(page)).filter(d=>!d.paused&&!d.muted&&d.volume>0.001);return active.length===1&&active[0]!.src!==previousSource&&active[0]!.volume<=0.111;},{timeout:Math.max(20000,(timing.duration-timing.time)*1000+20000),intervals:[250,500,1000]}).toBe(true);
}

test('main and mirror hosts rotate quiet non-overlapping music while phones stay silent through shared games',async({page,browser},testInfo)=>{
  test.setTimeout(420000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!localStorage.getItem('king-prompter-menu-preferences:v3'))localStorage.setItem('king-prompter-menu-preferences:v2',JSON.stringify({version:1,soundEnabled:false,volume:0.25,motion:'reduced'}));});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByRole('button',{name:'Start Callback'}).click();await expect(page.getByRole('heading',{name:'Get everyone together.',exact:true})).toBeVisible();
  await expectMenu(page);
  const before=await music(page);const active=before.find(d=>!d.paused)!;
  await page.getByRole('button',{name:'Host a game',exact:true}).click();await expect(page).toHaveURL(/\/session\/[A-Z2-9]{4}\/host$/);
  const code=new URL(page.url()).pathname.split('/')[2]!,baseURL=new URL(page.url()).origin;
  await expectMenu(page);const after=await music(page);expect(after.find(d=>!d.paused)!.src).toBe(active.src);expect(after.find(d=>!d.paused)!.time).toBeGreaterThan(active.time);
  const pin=page.locator('.session-mirror-code strong');await expect(pin).toHaveText(/^\d{4}$/);
  const mirrorContext=await browser.newContext({baseURL,viewport:{width:1280,height:720}});const mirror=await mirrorContext.newPage();
  const phones=await Promise.all([browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true}),browser.newContext({baseURL,viewport:{width:375,height:812},isMobile:true,hasTouch:true})]);
  const hostPosts:string[]=[],legacyMirrorJoins:string[]=[];mirror.on('request',r=>{if(r.method()==='POST'&&/\/api\/arcade\/online\/rooms\/[^/]+\/host/.test(r.url()))hostPosts.push(r.url());if(r.method()==='POST'&&/\/api\/rooms\/[^/]+\/display-session/.test(r.url()))legacyMirrorJoins.push(r.url());});
  try{
    await mirror.emulateMedia({reducedMotion:'reduce'});await mirror.goto('/');await mirror.getByRole('button',{name:'Start Callback'}).click();await mirror.getByRole('link',{name:'Connect another display',exact:true}).click();
    await expectMenu(mirror);
    await mirror.getByLabel('Four-digit mirror code').fill(await pin.innerText());await mirror.getByRole('button',{name:'Connect mirror',exact:true}).click();await expect(mirror).toHaveURL(new RegExp('/session/'+code+'/mirror$'));await expectMenu(mirror);
    for(let i=0;i<phones.length;i++){const p=await phones[i]!.newPage();await p.emulateMedia({reducedMotion:'reduce'});await p.goto('/');await p.getByRole('button',{name:'Start Callback'}).click();await p.getByRole('link',{name:'Join a game',exact:true}).click();await expect(p).toHaveURL(/\/play$/);await expect.poll(async()=> (await music(p)).filter(d=>!d.paused&&!d.muted&&d.volume>0).length).toBe(0);
      await p.goto('/session/'+code+'/play');await p.getByLabel('Your name',{exact:true}).fill('Music friend '+i);await expect(p.getByRole('button',{name:'Join lobby',exact:true})).toBeEnabled();await p.getByRole('button',{name:'Join lobby',exact:true}).click();await expect(p.getByRole('heading',{name:'Welcome, Music friend '+i})).toBeVisible();}
    const poseAccess=await mirror.evaluate(async code=>{const path=`/api/sessions/${code}/avatar-poses?role=mirror`;const read=await fetch(path);const write=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sequence:1,pose:{}})});return {read:read.status,write:write.status};},code);
    expect(poseAccess).toEqual({read:200,write:401});
    await expect(page.getByRole('heading',{name:'What are we playing?',exact:true})).toBeVisible();await expect(page.locator('.session-category-tabs').getByRole('button',{name:'Party Games',exact:true})).toHaveAttribute('aria-pressed','true');await expect(mirror.locator('.session-category-tabs').getByRole('button',{name:'Party Games',exact:true})).toHaveAttribute('aria-pressed','true');await page.locator('.game-menu-grid').getByRole('button',{name:/King Prompter/}).click();await expect(page.locator('iframe.session-game-frame')).toBeVisible();await expect(mirror.locator('iframe.session-game-frame')).toBeVisible();
    for(const host of [page,mirror])await expect(host.frameLocator('iframe.session-game-frame').getByText('Music friend 0',{exact:true}).first()).toBeVisible();
    await expect(mirror.frameLocator('iframe.session-game-frame').getByRole('button',{name:'Start the game',exact:true})).toHaveCount(0);
    await expect(page.frameLocator('iframe.session-game-frame').locator('.broadcast-room-code')).toBeHidden();
    await expect(page.frameLocator('iframe.session-game-frame').getByRole('link',{name:'Another TV',exact:true})).toBeHidden();
    const startBounds=await page.frameLocator('iframe.session-game-frame').getByRole('button',{name:'Start the game',exact:true}).boundingBox();expect(startBounds).not.toBeNull();expect(startBounds!.y+startBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);await expectMenu(page);await expectMenu(mirror);
    await expect.poll(async()=>{const child=page.frameLocator('iframe.session-game-frame').locator('audio.host-music-deck');return child.evaluateAll(nodes=>nodes.some(a=>!(a as HTMLAudioElement).paused));}).toBe(false);
    await page.screenshot({path:testInfo.outputPath('main-mirror-host.png')});await mirror.screenshot({path:testInfo.outputPath('mirror-main-game.png')});
    await page.getByRole('button',{name:'New Game',exact:true}).click();await page.getByRole('button',{name:'Choose New Game',exact:true}).click();await expect(mirror.getByRole('heading',{name:'What are we playing?'})).toBeVisible();
    await page.locator('.session-category-tabs').getByRole('button',{name:'Arcade',exact:true}).click();await expect(mirror.locator('.session-category-tabs').getByRole('button',{name:'Arcade',exact:true})).toHaveAttribute('aria-pressed','true');await page.locator('.game-menu-grid').getByRole('button',{name:/Sumo/}).filter({hasNotText:'Real-time pilot'}).click();await expect(page.locator('iframe.session-game-frame')).toBeVisible();await expect(mirror.frameLocator('iframe.session-game-frame').getByText('Waiting for the host…')).toBeVisible();
    await expectMenu(page);await expectMenu(mirror);await beginOverlapAudit(page);await beginOverlapAudit(mirror);await page.frameLocator('iframe.session-game-frame').getByRole('button',{name:'Start Sumo',exact:true}).click();
    await expect(mirror.frameLocator('iframe.session-game-frame').locator('iframe[title="Royal Sumo real-time match"]')).toBeVisible();
    for(const host of [page,mirror])await expect.poll(async()=> (await music(host)).filter(d=>!d.paused&&!d.muted&&d.volume>0.001).length).toBe(1);
    await page.waitForTimeout(1800);expect(await finishOverlapAudit(page)).toBeLessThanOrEqual(1);expect(await finishOverlapAudit(mirror)).toBeLessThanOrEqual(1);
    expect(hostPosts).toEqual([]);expect(legacyMirrorJoins).toEqual([]);
    await mirror.reload();
    // Vite can restore the parent session before it finishes loading the child document.
    await expect(mirror.locator('iframe.session-game-frame')).toBeVisible({timeout:30000});
    await expect(mirror.frameLocator('iframe.session-game-frame').locator('iframe[title="Royal Sumo real-time match"]')).toBeVisible({timeout:30000});
    await page.getByRole('button',{name:'New Game',exact:true}).click();await page.getByRole('button',{name:'Choose New Game',exact:true}).click();await expect(mirror.getByRole('heading',{name:'What are we playing?'})).toBeVisible();await expectMenu(page);
    const firstMenuSource=(await music(page)).find(d=>!d.paused)!.src;
    await finishMusicTrack(page,firstMenuSource);
    const secondMenuSource=(await music(page)).find(d=>!d.paused)!.src;expect(secondMenuSource).not.toBe(firstMenuSource);
    await finishMusicTrack(page,secondMenuSource);
    expect((await music(page)).filter(d=>!d.paused&&!d.muted&&d.volume>0.001).length).toBe(1);
    expect(errors).toEqual([]);
  }finally{await Promise.allSettled([mirrorContext.close(),...phones.map(c=>c.close())]);}
});
