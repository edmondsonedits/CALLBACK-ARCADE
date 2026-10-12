import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RemoteInputs,parseCommand,REMOTE_IDLE_MS} from '../../src/core/remote.js';

const read=(r,slot,now)=>r.read(slot,now,{});

test('parseCommand accepts both the v0.21 vocabulary and the sim vocabulary',()=>{
  assert.deepEqual(parseCommand({moveX:.5,moveY:-.25,bashPressed:true,bashCharge:.6,dashPressed:true,sequence:7}),{mx:.5,mz:-.25,strike:.6,dash:true,sequence:7});
  assert.deepEqual(parseCommand({mx:1,mz:0,bashDown:true,dash:true}),{mx:1,mz:0,bashDown:true,dash:true});
  assert.deepEqual(parseCommand({}),{});
  assert.deepEqual(parseCommand(null),{});assert.deepEqual(parseCommand('hello'),{});assert.deepEqual(parseCommand(42),{});
});
test('parseCommand clamps and rejects garbage',()=>{
  const p=parseCommand({moveX:99,moveY:-99});assert.equal(p.mx,1);assert.equal(p.mz,-1);
  for(const bad of [NaN,Infinity,-Infinity,'abc',{},[],null,undefined,'']){const q=parseCommand({moveX:bad,moveY:bad});assert.equal(q.mx,undefined,String(bad));assert.equal(q.mz,undefined)}
  assert.equal(parseCommand({moveX:'0.5'}).mx,.5,'numeric strings are fine');
  assert.equal(parseCommand({bashPressed:true,bashCharge:0}).strike,.12,'minimum strike power');
  assert.equal(parseCommand({bashPressed:true,bashCharge:50}).strike,1);
  assert.equal(parseCommand({bashPressed:true}).strike,.35,'default strike power');
  assert.equal(parseCommand({bashPressed:true,bashCharge:'x'}).strike,.35);
  assert.equal(parseCommand({bashPressed:'yes'}).strike,undefined,'only a real true counts');
  assert.equal(parseCommand({bashDown:'false'}).bashDown,false);
});
test('stick and hold are levels: partial updates merge and persist',()=>{
  const r=new RemoteInputs();
  assert.equal(r.submit(2,{moveX:1},0),true);
  r.submit(2,{bashDown:true},10);
  let o=read(r,2,20);assert.deepEqual([o.mx,o.mz,o.bashDown],[1,0,true]);
  o=read(r,2,30);assert.deepEqual([o.mx,o.mz,o.bashDown],[1,0,true],'still held on the next tick');
  r.submit(2,{moveX:0,moveY:1,bashDown:false},40);
  o=read(r,2,50);assert.deepEqual([o.mx,o.mz,o.bashDown],[0,1,false]);
});
test('strike and dash are edges: they fire exactly once',()=>{
  const r=new RemoteInputs();
  r.submit(1,{bashPressed:true,bashCharge:.8,dashPressed:true},0);
  let o=read(r,1,1);assert.equal(o.bashPower,.8);assert.equal(o.dash,true);
  o=read(r,1,2);assert.equal(o.bashPower,-1);assert.equal(o.dash,false);
});
test('the stick vector is limited to the unit circle',()=>{
  const r=new RemoteInputs();r.submit(1,{moveX:1,moveY:1},0);
  const o=read(r,1,1);assert.ok(Math.abs(Math.hypot(o.mx,o.mz)-1)<1e-9);
});
test('a seat that goes quiet stops walking and releases BASH (dead-man), a heartbeat keeps it alive',()=>{
  const r=new RemoteInputs();
  r.submit(3,{moveX:1,bashDown:true},0);
  assert.equal(read(r,3,REMOTE_IDLE_MS-1).mx,1);
  const o=read(r,3,REMOTE_IDLE_MS+1);assert.deepEqual([o.mx,o.mz,o.bashDown,o.dash,o.bashPower],[0,0,false,false,-1]);
  assert.equal(r.stale(3,REMOTE_IDLE_MS+1),true);
  const r2=new RemoteInputs();r2.submit(3,{moveX:1},0);r2.submit(3,{},REMOTE_IDLE_MS-100);
  assert.equal(read(r2,3,REMOTE_IDLE_MS+500).mx,1,'an empty command is a heartbeat');
  const r3=new RemoteInputs({idleMs:0});r3.submit(3,{moveX:1},0);assert.equal(read(r3,3,1e9).mx,1,'idleMs 0 = never time out');
  r.setIdle(100);r.submit(3,{moveX:-1},1000);assert.equal(read(r,3,1050).mx,-1);assert.equal(read(r,3,1200).mx,0);
});
test('out-of-order packets are dropped by sequence number, and clear() forgets the sequence',()=>{
  const r=new RemoteInputs();
  assert.equal(r.submit(1,{moveX:1,sequence:10},0),true);
  assert.equal(r.submit(1,{moveX:-1,sequence:9},1),false);
  assert.equal(read(r,1,2).mx,1);
  assert.equal(r.submit(1,{moveX:.5,sequence:10},3),true,'equal sequence is accepted');
  r.clear(1);assert.equal(r.submit(1,{moveX:-1,sequence:0},4),true,'a reconnecting client may restart at 0');
});
test('invalid seats are rejected and never throw',()=>{
  const r=new RemoteInputs();
  for(const bad of [-1,10,1.5,NaN,'2',null,undefined])assert.equal(r.submit(bad,{moveX:1},0),false,String(bad));
  const o=r.read(99,0,{});assert.deepEqual([o.mx,o.mz,o.bashDown],[0,0,false]);
});
test('a seat that never sent anything is neutral, and seats are independent',()=>{
  const r=new RemoteInputs();r.submit(2,{moveX:1},0);
  assert.equal(read(r,3,1).mx,0);assert.equal(read(r,2,1).mx,1);
  assert.equal(r.age(3,100),Infinity);assert.equal(r.age(2,100),100);
});
