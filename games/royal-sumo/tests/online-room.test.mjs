import test from 'node:test';
import assert from 'node:assert/strict';
import {Room,parseInput} from '../server/room.mjs';
const socket=()=>({messages:[],send(x){this.messages.push(JSON.parse(x))},close(){this.closed=true}});
async function setup(){let now=1000;const room=await Room.create({code:'ABC234',localSeats:[0],now:()=>now});const h=socket();await room.receive(h,{v:1,type:'auth',role:'host',token:room.hostToken});await room.receive(h,{v:1,type:'status',active:true,paused:false,phase:'fight',fighters:10});return {room,h,time:x=>now=x}}
test('room assigns a bot seat and rejects forged, duplicate and invalid inputs',async()=>{
 const {room,h}=await setup();const p=socket();await room.receive(p,{v:1,type:'auth',role:'player',name:'Danny'});
 const welcome=p.messages.find(x=>x.type==='welcome');assert.equal(welcome.seat,1);assert.ok(welcome.token.length>=32);
 assert.equal(parseInput({v:1,type:'input',seq:1,x:NaN,y:0,bash:false,dash:false}),null);
 assert.equal(parseInput({v:1,type:'input',seq:1,x:0,y:0,bash:false,dash:false,seat:2}),null);
 const msg={v:1,type:'input',seq:1,x:1,y:0,bash:true,dash:false};await room.receive(p,msg);await room.receive(p,msg);
 assert.equal(h.messages.filter(x=>x.type==='input').length,1);
 assert.equal(h.messages.find(x=>x.type==='input').seat,1);
 const bad=socket();await room.receive(bad,{v:1,type:'auth',role:'host',token:'wrong'});assert.ok(bad.closed);
});
test('disconnected phones become bots and authenticated reconnect reclaims the same seat',async()=>{
 const {room,h,time}=await setup();const p=socket();await room.receive(p,{v:1,type:'auth',role:'player',name:'Danny'});const w=p.messages.find(x=>x.type==='welcome');
 await room.receive(p,{v:1,type:'input',seq:40,x:0,y:0,bash:false,dash:false});
 room.disconnect(p);assert.equal(h.messages.at(-1).players[0].connected,false);
 const p2=socket();await room.receive(p2,{v:1,type:'auth',role:'player',token:w.token,name:'Changed'});assert.equal(p2.messages.find(x=>x.type==='welcome').seat,w.seat);assert.equal(p2.messages.find(x=>x.type==='welcome').nextSeq,41);
 time(5000);room.tick();assert.equal(h.messages.at(-1).players[0].connected,false);
});
test('capacity, paused rooms and host disconnect are enforced',async()=>{
 const {room,h}=await setup();const clients=[];for(let i=0;i<9;i++){const p=socket();await room.receive(p,{v:1,type:'auth',role:'player',name:'P'+i});clients.push(p)}
 const full=socket();await room.receive(full,{v:1,type:'auth',role:'player',name:'Extra'});assert.equal(full.messages.at(-1).code,'ROOM_FULL');
 await room.receive(h,{v:1,type:'status',active:true,paused:true,phase:'fight',fighters:10});const p=clients[0];
 await room.receive(p,{v:1,type:'input',seq:1,x:1,y:0,bash:false,dash:false});assert.equal(h.messages.filter(x=>x.type==='input').length,0);
 room.disconnect(h);assert.equal(p.messages.at(-1).hostConnected,false);
});

test('ended rooms stay closed after durable storage reload',async()=>{
 const {room,h}=await setup();const credential=room.hostToken;
 await room.receive(h,{v:1,type:'close'});
 const restored=new Room(room.saved());const reconnect=socket();
 await restored.receive(reconnect,{v:1,type:'auth',role:'host',token:credential});
 assert.equal(reconnect.messages.at(-1).code,'ROOM_EXPIRED');assert.ok(reconnect.closed);
});
