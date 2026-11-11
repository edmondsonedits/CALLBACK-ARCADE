import {test,expect} from '@playwright/test';
import {setupFish,completeMain,openScreens,finale} from './fixtures/fish-room';
test('host can choose a longer fish drawing time before starting',async({browser})=>{
 test.setTimeout(180000); const room=await setupFish(browser,3);
 try {
  await completeMain(room); await openScreens(room);
  const page=room.tv!;
  const timer=page.getByRole('combobox',{name:'Drawing time',exact:true});
  await expect(timer).toHaveValue('240');
  await expect(timer.locator('option')).toHaveCount(6);
  await timer.selectOption('360');
  await page.getByRole('button',{name:'Start fish game',exact:false}).click();
  await expect.poll(async()=>(await finale(room.host,room.code)).phase).toBe('tutorial');
  expect((await finale(room.host,room.code)).drawingSeconds).toBe(360);
  await page.getByRole('button',{name:'Start drawing',exact:true}).click();
  await expect.poll(async()=>(await finale(room.host,room.code)).phase).toBe('drawing');
  const state=await finale(room.host,room.code);expect(state.deadline-state.phaseStartedAt).toBe(360000);
 }finally{await room.close();}
});


