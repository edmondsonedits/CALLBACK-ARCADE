import { expect, test } from '@playwright/test';
import { DEFAULT_AVATAR } from '../lib/avatar-runtime';
const baseURL=process.env.CALLBACK_TEST_BASE_URL??'http://localhost:3000';
const headers={Origin:baseURL,'X-Callback-Test-Mode':'deterministic-matrix'};
const avatarConfig={...DEFAULT_AVATAR,photoFaceId:'ba11958b-767c-4e45-a92d-b6a59ad3346c'};
test('copied photo IDs cannot enter rooms through join, updates, sessions or host seats',async({browser})=>{
 const host=await browser.newContext({baseURL});const player=await browser.newContext({baseURL});
 try {
  await player.request.get('/api/profile');
  const created=await host.request.post('/api/rooms',{headers,data:{gameLength:'pictures',contentMode:'party',timerAccessibility:false}});expect(created.status()).toBe(201);const {code}=await created.json();
  const forged=await player.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:'Photo',avatarConfig}});expect(forged.status()).toBe(422);
  const joined=await player.request.post(`/api/rooms/${code}/join`,{headers,data:{nickname:'Drawn'}});expect(joined.status()).toBe(201);
  const update=await player.request.post(`/api/rooms/${code}/player-actions`,{headers,data:{type:'UPDATE_AVATAR',actionId:crypto.randomUUID(),roundId:'lobby',expectedPhase:'LOBBY',payload:{avatarConfig,avatarPreset:null}}});expect(update.status()).toBe(422);
  const session=await host.request.post('/api/sessions',{headers,data:{}});expect(session.status()).toBe(201);const lobby=await session.json();
  expect((await player.request.post(`/api/sessions/${lobby.code}/join`,{headers,data:{nickname:'Photo',avatarConfig}})).status()).toBe(422);
  expect((await host.request.post('/api/rooms',{headers,data:{gameLength:'bowl-of-fools',contentMode:'party',timerAccessibility:false,foolHostAvatarConfig:avatarConfig}})).status()).toBe(422);
 }finally{await host.close();await player.close();}
});
