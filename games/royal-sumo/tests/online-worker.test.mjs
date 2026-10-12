import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.mjs';

test('relay only allows configured origins, including JSON preflight',async()=>{
 const env={ALLOWED_ORIGINS:'https://edmondsonedits.github.io'};
 const url='https://sumo.example/api/health';
 const ok=await worker.fetch(new Request(url,{headers:{Origin:env.ALLOWED_ORIGINS}}),env);
 assert.equal(ok.status,200);assert.equal(ok.headers.get('Access-Control-Allow-Origin'),env.ALLOWED_ORIGINS);
 const bad=await worker.fetch(new Request(url,{headers:{Origin:'https://uninvited.example'}}),env);
 assert.equal(bad.status,403);assert.equal(bad.headers.get('Access-Control-Allow-Origin'),null);
 const preflight=await worker.fetch(new Request('https://sumo.example/api/rooms',{method:'OPTIONS',headers:{Origin:env.ALLOWED_ORIGINS,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}}),env);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Headers'),'Content-Type');
});

test('cross-origin room creation returns usable CORS response',async()=>{
 const origin='https://edmondsonedits.github.io';
 const env={ALLOWED_ORIGINS:origin,SUMO_ROOMS:{idFromName:n=>n,get:()=>({fetch:async r=>{
  assert.equal(r.url,'https://internal/create');assert.deepEqual(await r.json(),{v:1,localSeats:[0]});
  return Response.json({code:'ABC234',token:'opaque-test-token'});
 }})}};
 const reply=await worker.fetch(new Request('https://sumo.example/api/rooms',{method:'POST',headers:{Origin:origin},body:JSON.stringify({v:1,localSeats:[0]})}),env);
 assert.equal(reply.status,200);assert.equal(reply.headers.get('Access-Control-Allow-Origin'),origin);assert.equal((await reply.json()).code,'ABC234');
});
