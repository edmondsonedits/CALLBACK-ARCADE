import test from 'node:test';import assert from 'node:assert/strict';import {WebSocket} from 'ws';import {startServer} from '../server/local.mjs';
function open(url,auth){return new Promise((resolve,reject)=>{const socket=new WebSocket(url),messages=[];socket.on('open',()=>socket.send(JSON.stringify({v:1,type:'auth',...auth})));socket.on('error',reject);socket.on('message',data=>{const m=JSON.parse(data);messages.push(m);if(m.type==='welcome')resolve({socket,messages,welcome:m})})})}
async function until(f){for(let i=0;i<80;i++){if(f())return;await new Promise(r=>setTimeout(r,20))}assert.ok(f(),'Expected network event did not arrive')}
test('real WebSocket phones replace unique bot seats, disconnect and reclaim ownership',async()=>{
 const server=await startServer({port:0});try{
  const made=await(await fetch(server.url+'/api/rooms',{method:'POST',body:JSON.stringify({v:1,localSeats:[0]})})).json();const url=server.url.replace('http','ws')+'/api/rooms/'+made.code+'/socket';
  const h=await open(url,{role:'host',token:made.token});h.socket.send(JSON.stringify({v:1,type:'status',active:true,paused:false,phase:'fight',fighters:10}));
  const a=await open(url,{role:'player',name:'Danny'}),b=await open(url,{role:'player',name:'Kristin'});assert.equal(a.welcome.seat,1);assert.equal(b.welcome.seat,2);
  const msg={v:1,type:'input',seq:1,x:.5,y:-.5,bash:true,dash:false};a.socket.send(JSON.stringify(msg));a.socket.send(JSON.stringify(msg));await until(()=>h.messages.some(x=>x.type==='input'));assert.equal(h.messages.filter(x=>x.type==='input').length,1);
  a.socket.close();await until(()=>h.messages.at(-1).type==='roster'&&!h.messages.at(-1).players.find(x=>x.seat===1).connected);
  const again=await open(url,{role:'player',token:a.welcome.token,name:'Other'});assert.equal(again.welcome.seat,1);assert.equal(again.welcome.name,'Danny');
  h.socket.close();await until(()=>again.messages.at(-1).hostConnected===false);
  b.socket.close();again.socket.close();
 }finally{await server.close()}
});
