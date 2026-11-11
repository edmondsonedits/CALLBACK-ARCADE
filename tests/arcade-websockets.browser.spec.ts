import {test,expect} from '@playwright/test';
import {ARCADE_GAMES} from '../lib/arcade/catalog';
import {ONLINE_HOSTED_GAMES} from '../lib/arcade/online/catalog';
const games=[...ARCADE_GAMES,...ONLINE_HOSTED_GAMES.filter(g=>!ARCADE_GAMES.some(n=>n.id===g.id))];
const online=new Set(ONLINE_HOSTED_GAMES.map(g=>g.id));
test('every available Arcade game uses host and phone WebSockets and preserves party identity',async({page,browser,baseURL})=>{
 test.setTimeout(600000);
 const created=await page.request.post('/api/sessions',{data:{}});expect(created.status()).toBe(201);const {code}=await created.json();
 const phoneContext=await browser.newContext({baseURL,viewport:{width:390,height:844}}),phone=await phoneContext.newPage();
 expect((await phone.request.post(`/api/sessions/${code}/join`,{data:{nickname:'Socket QA'}})).ok()).toBeTruthy();
 const before=await (await phone.request.get(`/api/sessions/${code}?role=player`)).json();
 const mirrorContext=await browser.newContext({baseURL,viewport:{width:1280,height:720}}),mirror=await mirrorContext.newPage();
 const parent=await(await page.request.get(`/api/sessions/${code}`)).json();expect((await mirror.request.post('/api/sessions/mirror',{data:{code:parent.mirrorCode}})).ok()).toBeTruthy();
 const counts={host:0,phone:0,mirror:0};const errors:string[]=[];let phase='';const polls:string[]=[];
 for(const [key,p] of [['host',page],['phone',phone],['mirror',mirror]] as const){p.on('pageerror',e=>errors.push(e.message));p.on('websocket',ws=>{if(!/\/(socket)$/.test(ws.url()))return;ws.on('framereceived',e=>{try{const v=JSON.parse(String(e.payload));if(['snapshot','ready','bootstrap','status'].includes(v.type))counts[key]++;}catch{/* Ignore non-JSON transport frames. */}})});p.on('request',r=>{if(phase==='steady'&&(/\/api\/rooms\/[^/]+\/sync$/.test(r.url())||/\/api\/arcade\/online\/rooms\/[^/]+\/(input|host)$/.test(r.url())))polls.push(r.url());});}
 const action=async(operation:string,game?:unknown)=>{for(let i=0;i<3;i++){const current=await(await page.request.get(`/api/sessions/${code}`)).json();const r=await page.request.post(`/api/sessions/${code}/host`,{data:{operation,version:current.version,...(game?{game}:{})}});if(r.ok())return await r.json();if(i===2)throw Error(await r.text());}throw Error('unreachable')};
 try{
 await page.goto(`/session/${code}/host`);await phone.goto(`/session/${code}/play`);await mirror.goto(`/session/${code}/mirror`);
 for(const game of games){await test.step(game.id,async()=>{
 phase='loading';const h=counts.host,p=counts.phone,m=counts.mirror;
 await action('launch',online.has(game.id)?{kind:'online',gameId:game.id}:{kind:'main',gameId:'arcade',arcadeGameId:game.id});
 await expect.poll(()=>counts.host,{timeout:25000,message:game.id+' host socket'}).toBeGreaterThan(h);
 await expect.poll(()=>counts.phone,{timeout:25000,message:game.id+' phone socket'}).toBeGreaterThan(p);
 await expect.poll(()=>counts.mirror,{timeout:25000,message:game.id+' mirror socket'}).toBeGreaterThan(m);
 await page.waitForTimeout(1500);phase='steady';await page.waitForTimeout(1800);phase='cleanup';
 expect(polls.splice(0),game.id+' uses socket rather than gameplay polling').toEqual([]);
 const after=await(await phone.request.get(`/api/sessions/${code}?role=player`)).json();expect(after.selfId).toBe(before.selfId);
 await action('lobby');await expect(page.locator('.session-game-frame')).toHaveCount(0);console.log('socket verified:',game.id);
 });}
 expect(games).toHaveLength(23);expect(errors).toEqual([]);
 }finally{phase='cleanup';await action('close');await phoneContext.close();await mirrorContext.close();}
});
