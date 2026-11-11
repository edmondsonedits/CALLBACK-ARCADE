import {test,expect} from '@playwright/test';
test('Sumo real-time host and two phones reconnect and retain their party for the next game',async({page,browser})=>{
 test.setTimeout(120000);page.setDefaultTimeout(12000);await page.setViewportSize({width:1366,height:768});
 const created=await page.request.post('/api/sessions',{data:{}});expect(created.status()).toBe(201);const {code}=await created.json();
 const origin=new URL(test.info().project.use.baseURL as string).origin;
 const contexts=await Promise.all([browser.newContext({baseURL:origin,viewport:{width:390,height:844},hasTouch:true}),browser.newContext({baseURL:origin,viewport:{width:375,height:667}})]);
 const phones=await Promise.all(contexts.map(c=>c.newPage()));let inputAcks=0,snapshots=0;const browserErrors:string[]=[];const sentInputs:{x:number;y:number;bashDown:boolean;dash:boolean}[]=[];const lastPhoneStatus:Record<string,unknown>[]=[];
 phones[0].on('websocket',ws=>ws.on('framesent',e=>{try{const v=JSON.parse(String(e.payload));if(v.type==='input')sentInputs.push(v)}catch{/* Non-game frames. */}}));
 page.on('pageerror',e=>browserErrors.push(e.message));
 try{
  for(let i=0;i<phones.length;i++){phones[i].on('websocket',ws=>ws.on('framereceived',e=>{try{const v=JSON.parse(String(e.payload));if(v.type==='status')lastPhoneStatus[i]=v;if(v.type==='input-ack'&&v.accepted)inputAcks++;if(v.type==='error')console.log('phone-error',JSON.stringify(v))}catch{/* Non-game frames. */}}));expect((await contexts[i].request.post(`/api/sessions/${code}/join`,{data:{nickname:'Pilot '+i}})).ok()).toBeTruthy();await phones[i].goto(`/session/${code}/play`);await expect(phones[i].getByRole('heading',{name:'Welcome, Pilot '+i})).toBeVisible();}
  const before=await Promise.all(contexts.map(async c=>(await c.request.get(`/api/sessions/${code}?role=player`)).json()));
  page.on('websocket',ws=>ws.on('framereceived',e=>{try{const v=JSON.parse(String(e.payload));if(v.view?.dynamic)snapshots++;if(v.type==='control-ack'||v.type==='error')console.log('host-control',JSON.stringify(v))}catch{/* Non-game frames. */}}));
  await page.goto(`/session/${code}/host`);await expect(page.locator('.session-roster-player')).toHaveCount(2);await page.locator('.session-category-grid button').filter({hasText:'Arcade'}).click();await page.getByRole('button',{name:'Royal Sumo · Crownfall',exact:false}).click();
  const host=page.frameLocator('.session-game-frame');await expect(host.getByRole('button',{name:'Start Sumo',exact:true})).toBeEnabled();await host.getByRole('button',{name:'Start Sumo',exact:true}).click();
  const phone=phones[0].frameLocator('.session-game-frame');await expect(phone.getByRole('button',{name:'Move fighter'})).toBeEnabled({timeout:15000});await expect.poll(()=>snapshots).toBeGreaterThan(2);
  const touch=await contexts[0].newCDPSession(phones[0]);
  const stickBox=await phone.getByRole('button',{name:'Move fighter'}).boundingBox();const chargeBox=await phone.getByRole('button',{name:/Hold to charge/}).boundingBox();expect(stickBox).toBeTruthy();expect(chargeBox).toBeTruthy();
  const stickPoint={id:1,x:stickBox!.x+stickBox!.width*.65,y:stickBox!.y+stickBox!.height/2};const chargePoint={id:2,x:chargeBox!.x+chargeBox!.width/2,y:chargeBox!.y+chargeBox!.height/2};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stickPoint]});await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[stickPoint,chargePoint]});await expect(phone.getByRole('button',{name:/Hold to charge/})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>sentInputs.some(v=>v.x>.2&&v.bashDown)).toBeTruthy();
  // CDP ends all contacts together. Independent releases are covered by party-phone.test.ts.
  const releaseAt=sentInputs.length;await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(phone.getByRole('button',{name:/Hold to charge/})).toHaveAttribute('aria-pressed','false');await expect.poll(()=>sentInputs.slice(releaseAt).some(v=>v.x===0&&!v.bashDown)).toBeTruthy();await touch.detach();
  await phone.locator('body').click({position:{x:15,y:15}});await phones[0].keyboard.down('ArrowRight');await expect.poll(()=>inputAcks).toBeGreaterThan(3);await phones[0].keyboard.up('ArrowRight');await phone.getByRole('button',{name:'Dash',exact:true}).click();
  await page.screenshot({path:'.logs/party-latency/sumo-host.png'});await phones[0].screenshot({path:'.logs/party-latency/sumo-phone.png'});
  await host.getByRole('button',{name:'Pause',exact:true}).click();await expect(phone.getByRole('status')).toContainText('Paused');
  // Pause through reload so bots cannot eliminate the test seat while navigation reconnects.
  const prior=inputAcks;await phones[0].reload();const refreshed=phones[0].frameLocator('.session-game-frame');await expect(refreshed.getByRole('status')).toContainText('Paused');
  await host.getByRole('button',{name:'Resume',exact:true}).first().click();await expect.poll(()=>lastPhoneStatus[0]?.paused).toBe(false);await expect.poll(()=>inputAcks).toBeGreaterThan(prior+3);
  // A living seat must regain controls; an eliminated seat must stay disabled after reconnect.
  await expect.poll(async()=>{const status=lastPhoneStatus[0],seat=Number(status?.seatId),alive=(status?.alive as boolean[]|undefined)?.[seat];return typeof alive==='boolean'&&(await refreshed.getByRole('button',{name:'Move fighter'}).isEnabled())===alive;}).toBeTruthy();
  await phones[0].setViewportSize({width:667,height:375});await phones[0].screenshot({path:'.logs/party-latency/sumo-phone-landscape.png'});expect(await refreshed.locator('body').evaluate(el=>el.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'New Game',exact:true}).click();await page.getByRole('button',{name:'Choose New Game',exact:true}).click();
  await expect.poll(async()=>await page.getByRole('dialog').count()===0||await page.getByRole('alert').filter({hasText:'previous game is still closing'}).count()>0,{timeout:15000}).toBeTruthy();
  // The local Worker occasionally times out retiring open sockets; its idempotent retry must recover.
  if(await page.getByRole('dialog').count())await page.getByRole('button',{name:'Choose New Game',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0,{timeout:15000});for(const p of phones)await expect(p.getByRole('heading',{name:/Welcome, Pilot/})).toBeVisible();
  const after=await Promise.all(contexts.map(async c=>(await c.request.get(`/api/sessions/${code}?role=player`)).json()));expect(after.map(x=>x.selfId)).toEqual(before.map(x=>x.selfId));expect(after.map(x=>x.code)).toEqual([code,code]);
  await page.getByRole('button',{name:/Arcade/}).click();await page.getByRole('button',{name:/Air Hockey/}).click();for(const p of phones)await expect(p.frameLocator('.session-game-frame').getByText(/Waiting for the host/)).toBeVisible();
  expect(browserErrors).toEqual([]);
 }catch(error){console.log('pilot-failure-status',JSON.stringify(lastPhoneStatus),await phones[0].frameLocator('.session-game-frame').getByRole('status').allTextContents());await phones[0].screenshot({path:'.logs/party-latency/pilot-failure-phone.png'});throw error;}finally{const current=await (await page.request.get(`/api/sessions/${code}`)).json();await page.request.post(`/api/sessions/${code}/host`,{data:{operation:'close',version:current.version}});for(const c of contexts)await c.close();}
});
