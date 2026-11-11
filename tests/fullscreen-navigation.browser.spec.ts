import { expect, test, type Page } from '@playwright/test';

const baseURL=process.env.CALLBACK_TEST_BASE_URL??'http://127.0.0.1:3018';
const headers={Origin:baseURL,'Content-Type':'application/json'};
async function coherentNavigation(page:Page){
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.getByRole('button',{name:/^(Next screen|Previous screen|Next games|Previous games)$/})).toHaveCount(0);
}
test('home offers direct actions and returns from artwork to the same menu',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByRole('button',{name:'Start Callback',exact:true}).click();
 await expect(page.getByRole('button',{name:'Host a game',exact:true})).toBeInViewport();await expect(page.getByRole('link',{name:'Join a game',exact:true})).toBeInViewport();await coherentNavigation(page);
 await page.getByRole('button',{name:'Winning artwork',exact:true}).click();await expect(page.getByRole('region',{name:'Sketch & Sorcery winning artwork'})).toBeVisible();await coherentNavigation(page);
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('link',{name:'Your character',exact:true}).click();await expect(page.getByRole('button',{name:'Customize character',exact:true})).toBeVisible();await coherentNavigation(page);
});
test('party picker exposes the complete catalog with natural scrolling and a roster destination',async({browser})=>{
 const host=await browser.newContext({baseURL,viewport:{width:1366,height:768}});
 try{
  const response=await host.request.post('/api/sessions',{headers,data:{}});expect(response.status()).toBe(201);const {code}=await response.json();
  const page=await host.newPage();await page.goto(`/session/${code}/host`);await page.getByRole('button',{name:'Party Games',exact:false}).click();
  await expect(page.locator('.game-menu-grid button strong').first()).toBeVisible();
  for(const size of [{width:1366,height:768},{width:600,height:800},{width:1200,height:500}]){
   await page.setViewportSize(size);
   const names=await page.locator('.game-menu-grid button strong').allTextContents();
    await coherentNavigation(page);
    await expect(page.locator('.game-menu-grid>button')).toHaveCount(7);
    for(const card of await page.locator('.game-menu-grid>button').all()){await card.scrollIntoViewIfNeeded();await expect(card).toBeInViewport({ratio:1});}
   expect([...names]).toEqual(expect.arrayContaining(['Sketch & Sorcery','King Prompter','Bowl of Fools','Royal Rumours','Royal Frame-Up','Let’s Make a Comic','Legacy Standard']));
  }
  await page.locator('.session-options').getByRole('button',{name:/Players \(/}).click();await expect(page.getByRole('heading',{name:'Players',exact:true})).toBeVisible();await coherentNavigation(page);
  await expect(page.getByRole('button',{name:'Back',exact:true})).toBeFocused();
  await page.screenshot({path:'.logs/fullscreen/host-players.png'});
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.locator('.session-options').getByRole('button',{name:/Players \(/})).toBeFocused();
 }finally{await host.close();}
});
test('join and guest catalog remain readable without sliced pages',async({page})=>{
 for(const size of [{width:320,height:568},{width:667,height:375}]){
  await page.setViewportSize(size);await page.goto('/play');await expect(page.getByRole('heading',{name:'Find your group'})).toBeVisible();await coherentNavigation(page);
  await page.goto('/party-games');await coherentNavigation(page);const last=page.locator('.party-pack').last();await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();
 }
});
test('drawing menus replace the screen and keep every tool reachable',async({page})=>{
 await page.goto('/drawing-studio');await expect(page.getByTestId('sketch-canvas')).toBeVisible();
 for(const size of [{width:320,height:568},{width:667,height:375},{width:1366,height:768}]){
  await page.setViewportSize(size);
  for(const name of ['Ink colour','Brush size','Canvas options']){
   await page.getByRole('button',{name,exact:true}).click();const menu=page.getByRole('dialog');await expect(menu).toBeVisible();
   const box=(await menu.boundingBox())!;expect(box.x).toBe(0);expect(box.y).toBe(0);expect(box.width).toBe(size.width);expect(box.height).toBe(size.height);await coherentNavigation(page);
   await menu.getByRole('button',{name:'Close menu',exact:true}).click();
  }
 }
 await page.screenshot({path:'.logs/fullscreen/drawing-screen.png'});
});
