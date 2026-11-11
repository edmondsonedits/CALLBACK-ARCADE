import {test,expect,type Page} from '@playwright/test';

function trace(page:Page) {
  const result={parent:0,game:0,frames:[] as Array<{role:string;phase:string;stateVersion:number}>,polls:0};
  page.on('websocket',ws=>{
    if(/\/sessions\/[^/]+\/socket$/.test(ws.url()))result.parent++;
    if(!ws.url().includes('/native-arcade/'))return;
    result.game++;
    ws.on('framereceived',frame=>{try{const v=JSON.parse(String(frame.payload));if(v.type==='snapshot')result.frames.push(v.snapshot);}catch{/* binary/unrelated frame */}});
  });
  page.on('request',req=>{if(/\/api\/rooms\/[^/]+\/sync$/.test(req.url()))result.polls++;});
  return result;
}

test('all party packs push to host, four phones and mirror while one parent socket survives game changes',async({page,browser,baseURL})=>{
  test.setTimeout(480000);
  const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext({baseURL,viewport:{width:390,height:844}})));
  const phones=await Promise.all(contexts.map(c=>c.newPage()));
  const mirrorContext=await browser.newContext({baseURL}),mirror=await mirrorContext.newPage();
  const pages=[page,...phones,mirror],traces=pages.map(trace);
  const created=await page.request.post('/api/sessions',{data:{}});expect(created.status()).toBe(201);
  const {code}=await created.json();
  const action=async(operation:string,gameId?:string)=>{
    const view=await(await page.request.get(`/api/sessions/${code}`)).json();
    const response=await page.request.post(`/api/sessions/${code}/host`,{data:{operation,version:view.version,...(gameId?{game:{kind:'main',gameId}}:{})}});
    expect(response.ok(),await response.text()).toBeTruthy();return response.json();
  };
  try{
    for(let i=0;i<phones.length;i++)expect((await phones[i]!.request.post(`/api/sessions/${code}/join`,{data:{nickname:`Party QA ${i+1}`}})).ok()).toBeTruthy();
    const before=await(await phones[0]!.request.get(`/api/sessions/${code}?role=player`)).json();
    const view=await(await page.request.get(`/api/sessions/${code}`)).json();
    expect((await mirror.request.post('/api/sessions/mirror',{data:{code:view.mirrorCode}})).ok()).toBeTruthy();
    await page.goto(`/session/${code}/host`);await Promise.all(phones.map(p=>p.goto(`/session/${code}/play`)));await mirror.goto(`/session/${code}/mirror`);
    for(const t of traces)await expect.poll(()=>t.parent,{timeout:20000}).toBe(1);
    for(const gameId of ['royal-rumours','bowl-of-fools','standard','pictures','comic','king-mystery']){
      await test.step(gameId,async()=>{
        const counts=traces.map(t=>t.frames.length);
        await action('launch',gameId);
        for(let i=0;i<traces.length;i++)await expect.poll(()=>traces[i]!.frames.length,{timeout:30000,message:gameId+' initial socket snapshot'}).toBeGreaterThan(counts[i]!);
        expect(traces.map(t=>t.frames.at(-1)?.role)).toEqual(['host','player','player','player','player','display']);
        const hostGame=page.frameLocator('iframe.session-game-frame');
        await expect(hostGame.getByRole('button',{name:/^Start the game/})).toBeEnabled();
        const start=Date.now();await hostGame.getByRole('button',{name:/^Start the game/}).click();
        for(const t of traces)await expect.poll(()=>t.frames.at(-1)?.phase,{timeout:20000}).not.toBe('LOBBY');
        console.log(`party socket ${gameId}: all six views observed start in ${Date.now()-start}ms`);
        await page.waitForTimeout(1500);const polls=traces.map(t=>t.polls);
        await page.waitForTimeout(2500);expect(traces.map(t=>t.polls)).toEqual(polls);
        expect(traces.map(t=>t.parent),'parent connection survives ticket refresh and game changes').toEqual([1,1,1,1,1,1]);
        await action('lobby');await expect(page.locator('iframe.session-game-frame')).toHaveCount(0);
        const after=await(await phones[0]!.request.get(`/api/sessions/${code}?role=player`)).json();expect(after.selfId).toBe(before.selfId);
      });
    }
  }finally{
    await action('close');await Promise.all(contexts.map(c=>c.close()));await mirrorContext.close();
  }
});
