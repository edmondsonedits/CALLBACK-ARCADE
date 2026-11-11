import { test, expect, type Page } from '@playwright/test';
import type { SessionView } from '../lib/session-contracts';

async function sessionSnapshot(page:Page,path:string):Promise<SessionView>{const result=await page.evaluate(async path=>{const response=await fetch(path,{credentials:'include',cache:'no-store'});return {status:response.status,data:await response.json()};},path);expect(result.status).toBe(200);return result.data as SessionView;}

test('Callback title, roles, one lobby and two phones survive main/Arcade/main games',async({page,browser})=>{
  test.setTimeout(180000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Start Callback'})).toBeEnabled();
  await expect(page.getByText('CALLBACK',{exact:true})).toBeVisible();
  await expect(page.getByText(/Sound on ·|Sound off/)).toHaveCount(0);
  await page.screenshot({path:'.logs/callback-lobby/title-desktop.png'});
  await page.getByRole('button',{name:'Start Callback'}).click();
  await expect(page.getByRole('heading',{name:'Get everyone together.',exact:true})).toBeVisible();
  await page.screenshot({path:'.logs/callback-lobby/home-desktop.png'});
  await page.getByRole('button',{name:'Host a game',exact:true}).click();
  await expect(page).toHaveURL(/\/session\/[A-Z2-9]{4}\/host$/);
  const code=new URL(page.url()).pathname.split('/')[2]!;
  const enlargeQr=page.getByRole('button',{name:`Enlarge QR code to join ${code}`,exact:true});
  await expect(enlargeQr).toBeVisible();
  await enlargeQr.click();
  await expect(page.getByRole('dialog',{name:`Join room ${code}`})).toBeVisible();
  await expect(page.getByRole('img',{name:`QR code to join room ${code}`})).toBeVisible();
  await page.getByRole('button',{name:'Close ×',exact:true}).click();
  const baseURL=new URL(page.url()).origin;
  const contexts=await Promise.all([browser.newContext({baseURL,viewport:{width:390,height:844}}),browser.newContext({baseURL,viewport:{width:375,height:812}})]);
  const phones=await Promise.all(contexts.map(c=>c.newPage()));
  try{
    for(let i=0;i<phones.length;i++)await test.step(`join phone ${i+1} to the hosted lobby`,async()=>{
      const phone=phones[i]!;await phone.goto(`/session/${code}/play`);
      await expect(phone.getByLabel('Your name',{exact:true})).toBeEnabled();await phone.getByRole('button',{name:'Style',exact:true}).click();
      const editor=phone.getByRole('button',{name:'Customize character',exact:true});await expect(editor).toBeEnabled();await editor.click();
      const dialog=phone.getByRole('dialog',{name:'Make it look like you.'});await dialog.getByRole('button',{name:/Surprise me/}).click();
      const history=dialog.getByRole('combobox',{name:'Character history and resets'});await expect(history.locator('option[value="undo"]')).toBeEnabled();await history.selectOption('undo');await expect(history.locator('option[value="redo"]')).toBeEnabled();await history.selectOption('redo');
      await dialog.getByRole('button',{name:/Use this avatar/}).click();await phone.getByRole('button',{name:'Save character',exact:true}).click();await expect(phone.getByRole('status').filter({hasText:'Character saved'})).toBeVisible();
      await phone.reload();await expect(phone.getByLabel('Your name',{exact:true})).toBeEnabled();await phone.getByRole('button',{name:'Style',exact:true}).click();await phone.getByRole('button',{name:'Customize character',exact:true}).click();await expect(phone.getByRole('dialog',{name:'Make it look like you.'}).getByRole('combobox',{name:'Character history and resets'}).locator('option[value="undo"]')).toBeEnabled();await phone.screenshot({path:`.logs/callback-lobby/phone-profile-${i+1}.png`});
      await phone.getByRole('dialog',{name:'Make it look like you.'}).getByRole('button',{name:/Use this avatar/}).click();
      await phone.getByRole('button',{name:'Back',exact:true}).click();
      const name=phone.getByLabel('Your name',{exact:true});await name.fill('Friend '+i);const join=phone.getByRole('button',{name:'Join lobby',exact:true});await expect(join).toBeEnabled({timeout:5000});await join.click();await expect(phone.getByRole('heading',{name:'Welcome, Friend '+i})).toBeVisible();
    });
    const before=await Promise.all(phones.map(phone=>sessionSnapshot(phone,`/api/sessions/${code}?role=player`)));
    for(const snapshot of before)expect(snapshot.selfId).toEqual(expect.any(String));
    await page.screenshot({path:'.logs/callback-lobby/host-picker.png'});
    await phones[0]!.screenshot({path:'.logs/callback-lobby/phone-lobby.png'});
    await expect(page.locator('.session-category-tabs').getByRole('button',{name:'Party Games',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.locator('.game-menu-grid').getByRole('button',{name:/King Prompter/}).click();
    await expect(page.locator('iframe.session-game-frame')).toBeVisible();
    for(const phone of phones)await expect(phone.locator('iframe.session-game-frame')).toBeVisible();
    const main=await sessionSnapshot(page,`/api/sessions/${code}`);
    await expect(page.frameLocator('iframe.session-game-frame').getByText('Friend 0',{exact:true}).first()).toBeVisible();
    await page.getByRole('button',{name:'New Game',exact:true}).click();
    await page.getByRole('button',{name:'Choose New Game',exact:true}).click();
    for(const phone of phones)await expect(phone.getByRole('heading',{name:/Welcome/})).toBeVisible();
    await page.locator('.session-category-tabs').getByRole('button',{name:'Arcade',exact:true}).click();
    await page.locator('.game-menu-grid').getByRole('button',{name:/Sumo/}).filter({hasNotText:'Real-time pilot'}).click();
    await expect(page.locator('iframe.session-game-frame')).toBeVisible();
    for(const phone of phones)await expect(phone.locator('iframe.session-game-frame')).toBeVisible();
    await page.frameLocator('iframe.session-game-frame').getByRole('button',{name:'Start Sumo',exact:true}).click();
    await expect(page.frameLocator('iframe.session-game-frame').getByRole('button',{name:'Pause',exact:true})).toBeVisible();
    await page.screenshot({path:'.logs/callback-lobby/host-sumo.png'});
    await phones[0]!.reload();await expect(phones[0]!.locator('iframe.session-game-frame')).toBeVisible();
    await page.getByRole('button',{name:'New Game',exact:true}).click();await page.getByRole('button',{name:'Choose New Game',exact:true}).click();
    await page.locator('.session-category-tabs').getByRole('button',{name:'Party Games',exact:true}).click();await page.locator('.game-menu-grid').getByRole('button',{name:/Let’s Make a Comic/}).click();
    await expect(page.locator('iframe.session-game-frame')).toBeVisible();
    for(let i=0;i<contexts.length;i++){const after=await sessionSnapshot(phones[i]!,`/api/sessions/${code}?role=player`);expect(after.selfId).toBe(before[i]!.selfId);expect(after.code).toBe(code);expect(after.players).toHaveLength(2);expect(after.activeGame?.title).toBe('Let’s Make a Comic');}
    expect(main.activeGame).not.toBeNull();
    expect((await page.request.post(`/api/rooms/${main.activeGame!.code}/sync`,{data:{version:1},headers:{Origin:baseURL}})).status()).toBe(404);
    await page.reload();await expect(page.locator('iframe.session-game-frame')).toBeVisible();
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

test('phone code entry goes straight to the room without an in-app scanner',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>Promise.reject(new DOMException('Camera denied by test','NotAllowedError'))}});});
  await page.goto('/play');
  await expect(page.getByLabel('Four-character code',{exact:true})).toBeVisible();
  await page.screenshot({path:'.logs/callback-lobby/phone-entry.png'});
  await expect(page.getByRole('button',{name:/Scan/})).toHaveCount(0);
  await page.getByLabel('Four-character code',{exact:true}).fill('B4CK');
  await page.getByLabel('Your nickname',{exact:true}).fill('Morgan');
  await page.getByRole('button',{name:'Your character',exact:true}).click();
  await expect(page.getByRole('button',{name:'Customize character',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByLabel('Four-character code',{exact:true})).toHaveValue('B4CK');
  await expect(page.getByLabel('Your nickname',{exact:true})).toHaveValue('Morgan');
  await page.route('**/api/sessions/B4CK?lookup=1',route=>route.fulfill({json:{exists:true}}));
  await page.route('**/session/B4CK/play?nickname=Morgan',route=>route.fulfill({contentType:'text/html',body:'<h1>Joined room B4CK</h1>'}));
  await page.getByRole('button',{name:'Join game',exact:false}).click();
  await expect(page).toHaveURL(/\/session\/B4CK\/play\?nickname=Morgan$/);
});
