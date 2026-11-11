import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {localOrigin} from './qa-config.mjs';

const base=localOrigin(process.env.CALLBACK_TEST_BASE_URL??'http://127.0.0.1:3017');
const headers={Origin:base,'X-Callback-Test-Mode':'deterministic-matrix'};
const browser=await chromium.launch();
try{
  const host=await browser.newContext({baseURL:base,extraHTTPHeaders:headers,viewport:{width:1366,height:768}});
  const created=await host.request.post('/api/rooms',{data:{gameLength:'standard',contentMode:'party',timerAccessibility:false}});
  if(created.status()!==201)throw Error('Benchmark room creation failed');
  const {code}=await created.json();const phones=[];
  for(let i=0;i<5;i++){const context=await browser.newContext({baseURL:base,extraHTTPHeaders:headers});const r=await context.request.post(`/api/rooms/${code}/join`,{data:{nickname:'Latency '+i}});if(r.status()!==201)throw Error('Benchmark join failed');phones.push({context,id:(await r.json()).id});}
  const sync=async()=>(await host.request.post(`/api/rooms/${code}/sync`,{data:{version:0}})).json();
  for(let i=0;i<5;i++){const s=await sync();if(s.phase==='ANSWERING')break;const r=await host.request.post(`/api/rooms/${code}/host-actions`,{data:{type:s.phase==='LOBBY'?'START_GAME':'SKIP',actionId:crypto.randomUUID(),roundId:s.roundId,expectedPhase:s.phase,payload:{}}});if(r.status()!==200)throw Error('Benchmark start failed');}
  const snapshot=await sync();if(snapshot.phase!=='ANSWERING')throw Error('Benchmark did not reach answering');
  const page=await host.newPage();
  await page.addInitScript(()=>{
    window.__qaObserved=[];
    const record=s=>{if(s?.submittedPlayerIds)window.__qaObserved.push({version:s.stateVersion,ids:s.submittedPlayerIds});};
    const originalFetch=window.fetch;
    window.fetch=async(...args)=>{const r=await originalFetch(...args);if(String(args[0]).includes('/sync')&&r.status===200)void r.clone().json().then(record);return r;};
    const OriginalSocket=window.WebSocket;
    window.WebSocket=class extends OriginalSocket{constructor(...args){super(...args);this.addEventListener('message',event=>{try{const message=JSON.parse(event.data);if(message.type==='snapshot')record(message.snapshot);}catch{ /* Ignore non-JSON transport frames. */ }});}};
  });
  await page.goto(`/host/${code}`);await page.waitForFunction(()=>window.__qaObserved.length>0);
  const samples=[];
  for(const [i,phone]of phones.entries()){
    const start=performance.now();
    const r=await phone.context.request.post(`/api/rooms/${code}/player-actions`,{data:{type:'SUBMIT_ANSWER',actionId:crypto.randomUUID(),roundId:snapshot.roundId,expectedPhase:'ANSWERING',payload:{answer:'A royal latency goose number '+i}}});
    if(r.status()!==200)throw Error('Benchmark submission failed');
    await page.waitForFunction(id=>window.__qaObserved.some(s=>s.ids.includes(id)),phone.id,{polling:10,timeout:10000});
    samples.push(Math.round(performance.now()-start));
  }
  const sorted=[...samples].sort((a,b)=>a-b);
  const frameCadence=await page.evaluate(()=>new Promise(resolve=>{const deltas=[];let previous;const frame=time=>{if(previous!==undefined)deltas.push(time-previous);previous=time;if(deltas.length<120)requestAnimationFrame(frame);else{deltas.sort((a,b)=>a-b);resolve({samples:deltas.length,p50Ms:Math.round(deltas[60]*10)/10,p95Ms:Math.round(deltas[114]*10)/10});}};requestAnimationFrame(frame);}));
  const result={measurement:'Local browser phone action to host-accepted snapshot',environment:'Loopback, desktop Chromium, disposable app and real local party Worker; synthetic five-player room',samplesMs:samples,p50Ms:sorted[2],p95Ms:sorted[4],hostAnimationCallbackCadence:frameCadence,limits:'Animation callback cadence is not a GPU frame-time profile. No physical phone, TV, Wi-Fi, internet or load claim; no before/after speedup claim'};
  await mkdir('.logs/qa-local',{recursive:true});await writeFile('.logs/qa-local/latency.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser.close();}
