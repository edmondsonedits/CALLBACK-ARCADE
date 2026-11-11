import {expect,test} from '@playwright/test';
import {setupFish,completeMain,openScreens,openFish,fishAction} from './fixtures/fish-room';

test('fish airbrush builds while held, stops on release and pause, and survives undo and reload',async({browser})=>{
 test.setTimeout(300_000);
 const room=await setupFish(browser,3);
 try{
  await completeMain(room);await openScreens(room);await openFish(room,'peaceful');
  const page=room.pages[0]!;await page.bringToFront();
  await page.setViewportSize({width:393,height:700});
  const editor=page.getByRole('region',{name:'Fish drawing editor',exact:true});
  await editor.getByRole('button',{name:'Got it',exact:true}).click();
  const canvas=editor.locator('canvas');
  const pixels=()=>canvas.evaluate((el:HTMLCanvasElement)=>el.toDataURL());
  const light=()=>canvas.evaluate((el:HTMLCanvasElement)=>{
   const d=el.getContext('2d')!.getImageData(500,372,24,24).data;let n=0;
   for(let i=0;i<d.length;i+=4)n+=d[i]!+d[i+1]!+d[i+2]!;
   return n/(24*24*3);
  });
  const baseline=await pixels();const box=(await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
  await expect.poll(light).toBeLessThan(235);const first=await light();
  await expect.poll(light,{timeout:5000}).toBeLessThan(first-10);
  await page.mouse.up();await expect(editor.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  const painted=await pixels();
  // A deliberate timing check: released pointers must not keep depositing paint.
  await page.waitForTimeout(300);expect(await pixels()).toBe(painted);
  await page.screenshot({path:test.info().outputPath('fish-airbrush-held.png')});
  await editor.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(pixels).toBe(baseline);
  await editor.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(pixels).toBe(painted);
  await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('fish:')&&localStorage.getItem(k)!.includes('spray')))).toBe(true);
  await page.reload();await editor.getByRole('button',{name:'Got it',exact:true}).click();await expect.poll(pixels).toBe(painted);
  const next=(await canvas.boundingBox())!;await page.mouse.move(next.x+next.width*.6,next.y+next.height*.5);await page.mouse.down();
  await fishAction(room.host,room.code,'FISH_PAUSE');
  await expect(editor.getByText(/Paused/)).toBeVisible();
  const paused=await pixels();await page.waitForTimeout(300);expect(await pixels()).toBe(paused);
  await page.mouse.up();
 }finally{await room.close();}
});
