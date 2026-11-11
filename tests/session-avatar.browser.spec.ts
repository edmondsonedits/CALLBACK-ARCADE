import {test,expect} from '@playwright/test';
import {DEFAULT_AVATAR} from '../lib/avatar-runtime';

test('character changes in a child lobby persist through New Game and the next child',async({browser})=>{
 const baseURL=process.env.CALLBACK_TEST_BASE_URL??'http://localhost:3000';
 const headers={Origin:baseURL,'X-Callback-Test-Mode':'deterministic-matrix'};
 const host=await browser.newContext({baseURL,extraHTTPHeaders:headers}),phone=await browser.newContext({baseURL,extraHTTPHeaders:headers});
 try{
  const created=await host.request.post('/api/sessions',{data:{}});expect(created.status()).toBe(201);const {code}=await created.json();
  expect((await phone.request.post(`/api/sessions/${code}/join`,{data:{nickname:'Persistent Style',avatarConfig:{...DEFAULT_AVATAR,bodyWidth:1},avatarPreset:null}})).status()).toBe(201);
  const launch=async()=>{const s=await(await host.request.get(`/api/sessions/${code}`)).json();const response=await host.request.post(`/api/sessions/${code}/host`,{data:{operation:'launch',version:s.version,game:{kind:'main',gameId:'pictures'}}});expect(response.status()).toBe(200);return response.json();};
  const first=await launch();await phone.request.get(`/api/sessions/${code}?role=player`);
  const sync=async(child:string)=>(await phone.request.post(`/api/rooms/${child}/sync`,{headers:{'X-Callback-Role':'player'},data:{version:0}})).json();
  const before=await sync(first.activeGame.code);
  const action={type:'UPDATE_AVATAR',actionId:crypto.randomUUID(),roundId:before.roundId,expectedPhase:before.phase,payload:{avatarConfig:{...DEFAULT_AVATAR,bodyWidth:1.1},avatarPreset:null}};
  expect((await phone.request.post(`/api/rooms/${first.activeGame.code}/player-actions`,{data:action})).status()).toBe(200);
  const parent=await(await host.request.get(`/api/sessions/${code}`)).json();
  expect(parent.players[0].avatarConfig.bodyWidth).toBe(1.1);
  expect((await host.request.post(`/api/sessions/${code}/host`,{data:{operation:'lobby',version:parent.version}})).status()).toBe(200);
  const next=await launch();await phone.request.get(`/api/sessions/${code}?role=player`);
  expect((await sync(next.activeGame.code)).players.find((p:{nickname:string})=>p.nickname==='Persistent Style').avatarConfig.bodyWidth).toBe(1.1);
  const last=await(await host.request.get(`/api/sessions/${code}`)).json();await host.request.post(`/api/sessions/${code}/host`,{data:{operation:'close',version:last.version}});
 }finally{await Promise.all([host.close(),phone.close()]);}
});
