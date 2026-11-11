import {expect,test} from '@playwright/test';
import {defaultCharacterProfile} from '../lib/character-profile';

test('simple phone entry screens fit while extended help and lists remain scrollable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/profile',route=>route.fulfill({json:{version:1,...defaultCharacterProfile(),created:false}}));
 for(const viewport of [{width:320,height:568},{width:393,height:700},{width:430,height:780}]){
  await page.setViewportSize(viewport);
  for(const route of ['/play','/mirror','/display','/avatar-studio']){
   await page.goto(route);await page.waitForLoadState('networkidle');
   expect(await page.evaluate(()=>document.documentElement.scrollHeight),`${route} at ${viewport.width} should fit`).toBeLessThanOrEqual(viewport.height+2);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
   for(const control of await page.getByRole('button').all())if(await control.isVisible())await expect(control).toBeInViewport({ratio:1});
   await page.screenshot({path:test.info().outputPath(`${route.slice(1)}-${viewport.width}.png`)});
  }
 }
 await page.setViewportSize({width:393,height:700});await page.goto('/?menu=1');
 await expect(page.getByRole('link',{name:'Join a game',exact:true})).toBeVisible();
 await expect.poll(()=>page.locator('.home-menu-screens').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(2);
 await expect(page.getByRole('button',{name:/House Edmondson/})).toBeInViewport({ratio:1});
 await page.screenshot({path:test.info().outputPath('home-phone.png')});
 await page.goto('/play');await page.getByRole('button',{name:'Your character',exact:true}).click();
 await expect(page.getByRole('button',{name:'Use a face photo',exact:true})).toBeInViewport({ratio:1});
 await page.getByText('How your character is saved',{exact:true}).click();
 await expect(page.getByText(/Clearing it or changing devices/)).toBeVisible();
 await page.setViewportSize({width:320,height:420});
 await page.getByRole('button',{name:'Back',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Back',exact:true}).click();
 await page.getByText('Joining an older Arcade room?',{exact:true}).click();
 const older=page.getByRole('link',{name:'Open its phone controller →',exact:true});await older.scrollIntoViewIfNeeded();await expect(older).toBeInViewport({ratio:1});
});
