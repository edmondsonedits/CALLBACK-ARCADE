import {test,expect} from '@playwright/test';

test('offline epochs reject late sync bodies and late failures after recovery',async({browser,baseURL})=>{
  const host=await browser.newContext({baseURL});const phone=await browser.newContext({baseURL});
  const headers={Origin:baseURL!,'X-Callback-Test-Mode':'deterministic-matrix'};
  try{
    const made=await host.request.post('/api/rooms',{headers,data:{gameLength:'pictures',contentMode:'party',timerAccessibility:false}});expect(made.status()).toBe(201);
    const {code}=await made.json();expect((await phone.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:'Epoch player'}})).status()).toBe(201);
    const page=await phone.newPage();
    await page.route('**/realtime',route=>route.fulfill({status:503,json:{error:{code:'QA_HTTP_FALLBACK'}}}));
    await page.addInitScript(()=>{
      const state={armed:false,held:false,cached:null as unknown,release:(_reject:boolean)=>{void _reject;}};
      (window as unknown as {__epochQA:typeof state}).__epochQA=state;
      const original=window.fetch;
      window.fetch=async(...args)=>{
        const response=await original(...args);if(!String(args[0]).includes('/sync'))return response;
        if(response.status===200)state.cached=await response.clone().json();
        if(!state.armed)return response;
        state.armed=false;state.held=true;
        const body=new Promise((resolve,reject)=>{state.release=fail=>{state.held=false;if(fail)reject(Error('Delayed old request'));else resolve(state.cached);};});
        return {ok:true,status:200,headers:response.headers,json:()=>body} as Response;
      };
    });
    await page.goto(`/play/${code}`);await expect(page.locator('.phone-self strong')).toHaveText('Epoch player');
    const arm=async()=>{await page.evaluate(()=>{(window as unknown as {__epochQA:{armed:boolean}}).__epochQA.armed=true;});await page.waitForFunction(()=>(window as unknown as {__epochQA:{held:boolean}}).__epochQA.held);};
    const release=async(fail:boolean)=>{await page.evaluate(fail=>(window as unknown as {__epochQA:{release:(fail:boolean)=>void}}).__epochQA.release(fail),fail);};
    await arm();await phone.setOffline(true);await expect(page.locator('.connection-banner')).toBeVisible();
    await release(false);await expect(page.locator('.connection-banner')).toBeVisible();
    await phone.setOffline(false);await expect(page.locator('.connection-banner')).toHaveCount(0);
    await arm();await phone.setOffline(true);await expect(page.locator('.connection-banner')).toBeVisible();
    await phone.setOffline(false);await expect(page.locator('.connection-banner')).toHaveCount(0);
    await release(true);await expect(page.locator('.connection-banner')).toHaveCount(0);
  }finally{await phone.close();await host.close();}
});
