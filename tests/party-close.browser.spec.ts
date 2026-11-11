import {test,expect} from '@playwright/test';
import {OwnedPartyRooms} from './helpers/owned-party-rooms';

test('HTTP End Game releases only its own native lease before the next party joins',async({browser,baseURL})=>{
  const owned=new OwnedPartyRooms(),contexts=[];
  try{
    for(let i=0;i<2;i++){
      const host=await browser.newContext({baseURL,extraHTTPHeaders:{Origin:baseURL!}});contexts.push(host);
      const made=await host.request.post('/api/rooms',{data:{gameLength:'standard',contentMode:'party',timerAccessibility:false}});expect(made.status()).toBe(201);
      const {code}=await made.json();await owned.track(host,code,baseURL!);
      const page=await host.newPage();let snapshots=0;
      page.on('websocket',socket=>{if(socket.url().includes('/native-arcade/'))socket.on('framereceived',frame=>{try{if(JSON.parse(String(frame.payload)).type==='snapshot')snapshots++;}catch{/* Ignore unrelated frames. */}});});
      await page.goto(`/host/${code}`);await expect.poll(()=>snapshots).toBeGreaterThan(0);
      await owned.closeAll();
      const ended=await host.request.post(`/api/rooms/${code}/sync`,{data:{version:0}});
      expect(ended.status()).toBe(200);expect((await ended.json()).phase).toBe('ENDED');
    }
  }finally{await owned.closeAll();await Promise.all(contexts.map(c=>c.close()));}
});
