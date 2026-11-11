import {test,expect} from '@playwright/test';

test('shared lobby waits for an outstanding snapshot before polling again',async({page,baseURL})=>{
  const created=await page.request.post('/api/sessions',{headers:{Origin:baseURL!},data:{}});
  expect(created.status()).toBe(201);
  const {code}=await created.json() as {code:string};
  // This scenario exercises HTTP fallback; healthy sockets intentionally suppress polls.
  await page.route('**/api/sessions/'+code+'/socket-ticket?role=host',route=>route.fulfill({status:503,json:{error:{code:'QA_HTTP_FALLBACK'}}}));
  let calls=0,release:()=>void=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/sessions/'+code+'?role=host',async route=>{calls++;await held;await route.continue();});
  try{
    await page.goto('/session/'+code+'/host');
    await expect.poll(()=>calls).toBe(1);
    // Hold longer than two normal polling periods: no second request may start.
    await page.waitForTimeout(3300);
    expect(calls).toBe(1);
    release();
    await expect(page.getByRole('heading',{name:'What are we playing?'})).toBeVisible();
    await expect.poll(()=>calls).toBeGreaterThan(1);
  }finally{release();await page.unrouteAll({behavior:'wait'});}
});
