import {test,expect,type Page} from '@playwright/test';

async function audible(page:Page){return page.locator('audio.host-music-deck').evaluateAll(nodes=>nodes.filter(node=>{const a=node as HTMLAudioElement;return !a.paused&&!a.muted&&a.volume>0.001&&a.volume<=0.111;}).length);}
async function startOverlapAudit(page:Page){await page.evaluate(()=>{const w=window as typeof window&{__musicOverlap?:{timer:number;max:number}};const state={timer:0,max:0};state.timer=window.setInterval(()=>{const count=[...document.querySelectorAll<HTMLAudioElement>('audio.host-music-deck')].filter(a=>!a.paused&&!a.muted&&a.volume>0.001).length;state.max=Math.max(state.max,count);},15);w.__musicOverlap=state;});}
async function finishOverlapAudit(page:Page){return page.evaluate(()=>{const w=window as typeof window&{__musicOverlap?:{timer:number;max:number}};if(!w.__musicOverlap)return 0;clearInterval(w.__musicOverlap.timer);return w.__musicOverlap.max;});}

test('Main Host preserves Music on despite an older saved host mute, and intentional mute survives reload',async({page})=>{
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('host-music-default-seeded')){
      localStorage.setItem('king-prompter-menu-preferences:v3',JSON.stringify({version:1,soundEnabled:true,volume:0.2,motion:'reduced'}));
      localStorage.setItem('callback-host-audio-v3',JSON.stringify({muted:true,music:false,musicVolume:0.7,effects:false,narrator:false,voiceURI:'saved-voice'}));
      sessionStorage.setItem('host-music-default-seeded','true');
    }
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'Start Callback'}).click();
  await expect(page.getByRole('heading',{name:'Get everyone together.',exact:true})).toBeVisible();
  await expect.poll(()=>audible(page)).toBe(1);
  await page.getByRole('button',{name:'Host a game',exact:true}).click();
  await expect(page).toHaveURL(/\/session\/[A-Z2-9]{4}\/host$/);
  await startOverlapAudit(page);
  await page.evaluate(()=>{
    const dispatch=(context:'thinking'|'voting'|'results'|'game')=>window.dispatchEvent(new CustomEvent('king-prompter:host-music-phase',{detail:{type:'host-music-phase',phase:'game',gameId:'standard',context}}));
    dispatch('thinking');window.setTimeout(()=>dispatch('voting'),160);window.setTimeout(()=>dispatch('results'),320);window.setTimeout(()=>dispatch('game'),480);
  });
  await page.waitForTimeout(2300);
  expect(await finishOverlapAudit(page)).toBeLessThanOrEqual(1);
  await expect.poll(()=>audible(page)).toBe(1);
  await expect(page.getByRole('button',{name:'Mute host music',exact:true})).toHaveText(/Music on/);
  await expect.poll(()=>audible(page)).toBe(1);
  await page.getByRole('button',{name:'Mute host music',exact:true}).click();
  await expect(page.getByRole('button',{name:'Unmute host music',exact:true})).toHaveText(/Music off/);
  await expect.poll(()=>audible(page)).toBe(0);
  await page.reload();
  const control=page.locator('button.host-music-toggle');
  await expect(control).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('king-prompter-menu-preferences:v3')!).soundEnabled)).toBe(false);
  await expect.poll(()=>audible(page)).toBe(0);
  await expect.poll(async()=>{const playing=await page.locator('audio.host-music-deck').evaluateAll(nodes=>nodes.some(node=>{const a=node as HTMLAudioElement;return !a.paused&&a.currentTime>2;}));return playing||await control.getAttribute('aria-label')==='Enable host music';}).toBe(true);
  await control.click();
  await expect.poll(()=>audible(page)).toBe(1);
  await expect(page.locator('.session-category-tabs').getByRole('button',{name:'Party Games',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.locator('.game-menu-grid').getByRole('button',{name:/King Prompter/}).click();
  await expect(page.locator('iframe.session-game-frame')).toBeVisible();
  await expect(page.getByRole('button',{name:'Mute host music',exact:true})).toHaveText(/Music on/);
  await expect.poll(()=>audible(page)).toBe(1);
  const game=page.frameLocator('iframe.session-game-frame');
  await game.getByRole('button',{name:'Open host controls',exact:true}).click();
  const adaptiveMusic=game.getByRole('checkbox',{name:/Adaptive music/});
  await expect(adaptiveMusic).toBeChecked();
  await page.getByRole('button',{name:'Mute host music',exact:true}).click();
  await expect(adaptiveMusic).not.toBeChecked();
  await expect.poll(()=>audible(page)).toBe(0);
  await page.getByRole('button',{name:'Unmute host music',exact:true}).click();
  await expect(adaptiveMusic).toBeChecked();
  await expect.poll(()=>audible(page)).toBe(1);
  await page.getByRole('button',{name:'Mute host music',exact:true}).click();
  await page.evaluate(()=>localStorage.setItem('king-prompter-menu-preferences:v3',JSON.stringify({version:1,soundEnabled:true,volume:0.2,motion:'reduced'})));
  await expect(adaptiveMusic).toBeChecked();
  await page.evaluate(()=>localStorage.setItem('king-prompter-menu-preferences:v3',JSON.stringify({version:1,soundEnabled:false,volume:0.2,motion:'reduced'})));
  await expect(adaptiveMusic).not.toBeChecked();
  await game.getByRole('checkbox',{name:/Sound effects/}).check();
  await expect(adaptiveMusic).not.toBeChecked();
  await game.getByRole('checkbox',{name:/Narrator/}).uncheck();
  await expect(adaptiveMusic).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Unmute host music',exact:true})).toHaveText(/Music off/);
  await expect.poll(()=>audible(page)).toBe(0);
});

