import {test,expect} from '@playwright/test';
import {setup,read,readPhone,gameAction,openScreens,uploadMain,art,headers,nextMain,ordinaryAction} from './fixtures/fish-room';
test('quick Sorcery workshop saves scenery, awards bounded preference points and closes editors once',async({browser})=>{
 test.setTimeout(180000);const h=await setup(browser,3,{sorceryLength:'quick'});
 try{
  for(const [i,p]of h.phones.entries())await gameAction(p,h.code,'SUBMIT_SKETCH_PROMPT',{prompt:`A royal duck carrying a sandwich ${i}`});
  for(const p of h.phones){const own=(await readPhone(p,h.code)).sketchRelay!.showdown!;await gameAction(p,h.code,'RANK_SKETCH_PROMPTS',{ranking:own.promptOptions!.filter(o=>o.id!==own.ownPromptId).slice(0,3).map(o=>o.id)});}
  let m=(await read(h.host,h.code)).sketchRelay!;expect(m.totalRounds).toBe(2);expect(m.deadline-m.showdown!.phaseStartedAt).toBe(120000);
  const bytes=await art(h.fixture,false);await uploadMain(h,h.phones[0]!,bytes);await openScreens(h);
  const page=h.pages[0]!;await page.bringToFront();const workshop=page.getByRole('region',{name:'Sorcery workshop',exact:true});await expect(workshop).toBeVisible();
  await workshop.getByRole('button',{name:'Practice drawing',exact:false}).click();
  await expect(page.getByRole('dialog',{name:'Practice drawing',exact:true})).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog',{name:'Practice drawing',exact:true})).toHaveCount(0);
  await expect(workshop.getByRole('button',{name:'Choose a favourite prompt',exact:false})).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/play/${h.code}$`));
  await workshop.getByRole('button',{name:'Choose a favourite prompt',exact:false}).click();
  const confirm=workshop.getByRole('button',{name:/Confirm in/});await expect(confirm).toBeDisabled();
  const prompt=(await readPhone(h.phones[0]!,h.code)).sketchRelay!.showdown!.workshop!.ballot!;expect(prompt.options).toHaveLength(3);
  const early=await h.phones[0]!.request.post(`/api/rooms/${h.code}/workshop`,{headers,data:{actionId:crypto.randomUUID(),matchId:m.matchId,round:m.round,type:'choose',ballotId:prompt.id,choice:prompt.options[0]!.id}});expect(early.status()).toBe(409);
  await workshop.getByRole('button',{name:prompt.options[0]!.text,exact:true}).click();
  await workshop.getByRole('button',{name:'Confirm favourite',exact:true}).click();
  await expect.poll(async()=>(await read(h.host,h.code)).sketchRelay!.scores[h.ids[0]!]).toBe(25);
  await workshop.getByRole('button',{name:'Workshop menu',exact:false}).click();await workshop.getByRole('button',{name:'Add to our aquarium',exact:false}).click();
  await workshop.getByRole('button',{name:'Create an addition',exact:false}).click();
  const editor=workshop.getByRole('region',{name:'Fish drawing editor',exact:true});await editor.getByRole('button',{name:'Got it',exact:true}).click();
  await editor.getByRole('button',{name:'Body',exact:true}).click();
  const box=(await editor.locator('canvas').boundingBox())!;await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);
  for(const p of h.phones.slice(1))await uploadMain(h,p,bytes);
  m=(await read(h.host,h.code)).sketchRelay!;expect(m.showdown!.workshop!.closeUntil).toBeGreaterThan(0);
  await editor.getByRole('button',{name:'Save creation',exact:true}).click();
  await expect.poll(async()=>{const r=await h.phones[0]!.request.get('/api/profile/creations');return (await r.json() as {creations:Array<{state:string}>}).creations.some(c=>c.state==='ready');}).toBe(true);
  const collection=await h.phones[0]!.request.get('/api/profile/creations');expect(collection.ok()).toBe(true);const records=(await collection.json() as {creations:Array<{id:string;state:string}>}).creations;expect(records.some(c=>c.state==='ready')).toBe(true);
  const forgedFish=await h.phones[0]!.request.post('/api/profile/creations',{headers,data:{kind:'fish',source:{}}});expect(forgedFish.status()).toBe(422);
  const other=await h.phones[1]!.request.get(`/api/profile/creations/${records[0]!.id}/image`);expect([401,404]).toContain(other.status());
  const manifest=await h.host.request.get(`/api/rooms/${h.code}/creations`);expect(manifest.ok()).toBe(true);expect((await manifest.json() as {assets:unknown[]}).assets.length).toBeGreaterThan(0);
  const hide=await h.host.request.post('/api/rooms/'+h.code+'/creations',{headers,data:{hideReturningArt:true}});expect(hide.status()).toBe(200);
  const hidden=await h.phones[0]!.request.get('/api/rooms/'+h.code+'/creations');expect((await hidden.json() as {assets:unknown[]}).assets).toEqual([]);
  await h.phones[0]!.request.post('/api/rooms/'+h.code+'/creations',{headers,data:{hideReturningArt:false}});
  const stillHidden=await h.host.request.get('/api/rooms/'+h.code+'/creations');expect((await stillHidden.json() as {hidden:boolean}).hidden).toBe(true);
  expect((await h.host.request.post('/api/rooms/'+h.code+'/creations',{headers,data:{hideReturningArt:false}})).status()).toBe(200);
  await expect.poll(async()=>['showcase','laughter-voting','artist-guessing'].includes((await read(h.host,h.code)).sketchRelay!.phase),{timeout:20000}).toBe(true);
  await page.screenshot({path:'.logs/workshop-phone.png'});
  const consent=await h.phones[0]!.request.get('/api/rooms/'+h.code+'/showcase');expect((await consent.json() as {enabled:boolean;scope:string})).toMatchObject({enabled:false,scope:'hall'});
  await h.phones[0]!.request.post('/api/rooms/'+h.code+'/showcase',{headers,data:{enabled:true}});
  for(let step=0;step<60;step++){
   const current=(await read(h.host,h.code)).sketchRelay!;
   if(current.phase==='complete'){expect(current.totalRounds).toBe(2);break;}
   if(current.phase==='laughter-voting'){for(const p of h.phones){const own=(await readPhone(p,h.code)).sketchRelay!.showdown!;await gameAction(p,h.code,'RANK_SKETCH_LAUGHTER',{ranking:own.entries.filter(e=>e.entryId!==own.ownEntryId).slice(0,3).map(e=>e.entryId)});}}
   else if(current.phase==='artist-guessing'){for(const p of h.phones)await gameAction(p,h.code,'GUESS_SKETCH_ARTISTS',{guesses:[]});}
   else if(current.phase==='curse-selection'){const c=current.showdown!.curse!;await gameAction(h.phones[h.ids.indexOf(c.chooserId)]!,h.code,'CHOOSE_SKETCH_CURSE',{curse:c.options[0]});}
   else if(current.phase==='drawing'){for(const p of h.phones)await uploadMain(h,p,bytes);}
   else if(current.phase==='transforming'){await expect.poll(async()=>(await read(h.host,h.code)).sketchRelay!.phase,{timeout:20000}).not.toBe('transforming');}
   else if(current.phase==='round-results'&&current.showdown!.workshop!.intermission){for(const [i,p]of h.phones.entries()){const own=(await readPhone(p,h.code)).sketchRelay!;const entry=own.showdown!.revealedEntries.find(e=>e.round===own.round&&e.playerId===(i===0?h.ids[1]:h.ids[0]));const response=await p.request.post('/api/rooms/'+h.code+'/workshop',{headers,data:{actionId:crypto.randomUUID(),matchId:own.matchId,round:own.round,type:'nominate',choice:entry!.entryId}});expect(response.status(),await response.text()).toBe(200);}await nextMain(h);if(h.tv){await expect(h.tv.getByTestId('sorcery-hall-honours')).toBeVisible();expect(await h.tv.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);const footer=(await h.tv.locator('section[aria-label="Sketch and Sorcery shared screen"] > footer').boundingBox())!;const honour=(await h.tv.getByTestId('sorcery-hall-honours').boundingBox())!;expect(honour.y+honour.height).toBeLessThanOrEqual(footer.y+1);const replay=h.tv.getByRole('button',{name:'One more exhibition ↗',exact:true});if(await replay.count()){const button=(await replay.boundingBox())!;expect(button.y+button.height).toBeLessThanOrEqual(footer.y+1);}await h.tv.screenshot({path:'.logs/workshop-hall.png'});}}
   else {if(current.phase==='revealing'&&h.tv){await expect(h.tv.getByTestId('sorcery-reveal-morph')).toBeVisible();await h.tv.screenshot({path:'.logs/workshop-tv-reveal.png'});}await nextMain(h);}
  }
  const finished=(await read(h.host,h.code)).sketchRelay!;expect(finished.phase).toBe('complete');expect(finished.showdown!.workshop!.earned).toBe(0);
  expect((await readPhone(h.phones[0]!,h.code)).sketchRelay!.showdown!.workshop!.earned).toBe(25);
  await ordinaryAction(h.host,h.code,'PLAY_AGAIN',{},true);expect((await read(h.host,h.code)).phase).toBe('LOBBY');

 }finally{await h.close();}
});
