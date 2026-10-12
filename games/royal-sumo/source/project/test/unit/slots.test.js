import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SlotTable,sanitizeName,assignStyles,NAME_MAX,SLOTS_KEY} from '../../src/core/slots.js';
import {MAX_PLAYERS} from '../../src/core/tune.js';

const memStore=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))},removeItem:k=>m.delete(k),_m:m}};

test('factory seating: seat 0 is the local player on device p1, everyone else is a bot',()=>{
  const t=new SlotTable();
  assert.equal(t.owner(0),'local');assert.equal(t.get(0).device,'p1');
  for(let i=1;i<MAX_PLAYERS;i++)assert.equal(t.owner(i),'bot',String(i));
  assert.deepEqual(t.humans(4),[0]);
});
test('setOwner validates seat, owner and device and reports what happened',()=>{
  const t=new SlotTable();
  assert.equal(t.setOwner(2,'remote'),true);assert.equal(t.owner(2),'remote');assert.equal(t.get(2).device,null);
  assert.equal(t.setOwner(2,'bot'),true);assert.equal(t.owner(2),'bot');
  assert.equal(t.setOwner(-1,'bot'),false);assert.equal(t.setOwner(MAX_PLAYERS,'bot'),false);assert.equal(t.setOwner(1.5,'bot'),false);
  assert.equal(t.setOwner(2,'admin'),false);assert.equal(t.setOwner(2,'local',{device:'p9'}),false);
  assert.equal(t.owner(2),'bot','a rejected call changes nothing');
});
test('a local device belongs to exactly one seat',()=>{
  const t=new SlotTable();
  assert.equal(t.setOwner(1,'local'),true);assert.equal(t.get(1).device,'p2','seat 1 gets the free device');
  assert.equal(t.setOwner(2,'local'),false,'no third local device');
  assert.equal(t.setOwner(2,'local',{device:'p1'}),false,'p1 is already seat 0');
  assert.equal(t.owner(2),'bot');
});
test('setLocalPlayers: 1 and 2 players claim the devices, evict other holders, and leave remote seats alone',()=>{
  const t=new SlotTable();
  t.setOwner(3,'remote');
  assert.equal(t.setLocalPlayers(2),2);
  assert.deepEqual([t.owner(0),t.get(0).device,t.owner(1),t.get(1).device],['local','p1','local','p2']);
  assert.equal(t.owner(3),'remote');
  t.setLocalPlayers(1);
  assert.deepEqual([t.owner(0),t.owner(1)],['local','bot']);
  assert.equal(t.owner(3),'remote','remote seats are not touched by the Players setting');
  // seat 0 was handed to a remote controller, then the menu asks for 1 local player: the person gets it back
  t.setOwner(0,'remote');t.setLocalPlayers(1);
  assert.equal(t.owner(0),'local');
  // device stolen from another seat
  const u=new SlotTable();u.setOwner(0,'bot');u.setOwner(5,'local',{device:'p1'});u.setLocalPlayers(1);
  assert.equal(u.owner(5),'bot');assert.equal(u.owner(0),'local');
});
test('names are sanitised: control characters, bidi tricks, whitespace and length',()=>{
  assert.equal(sanitizeName('  Ada  Lovelace  '),'Ada Lovelace');
  assert.equal(sanitizeName('A‮B​C\u0007D'),'A B C D'.replace(/ /g,' '));
  assert.equal(sanitizeName('x'.repeat(40)).length,NAME_MAX);
  assert.equal(sanitizeName('\u{1F600}'.repeat(30)),Array.from('\u{1F600}'.repeat(NAME_MAX)).join(''),'counts characters, not UTF-16 units');
  for(const v of [null,undefined,{},[],()=>1,'',' \n\t '])assert.equal(sanitizeName(v),'',String(v));
  assert.equal(sanitizeName(12345),'12345');
});
test('setName persists across restarts of the table (names survive), empty resets to the default',()=>{
  const st=memStore();let t=new SlotTable({storage:st});
  assert.equal(t.setName(2,'  Zed '),'Zed');assert.equal(t.displayName(2,4),'Zed');
  assert.ok(st._m.has(SLOTS_KEY),'written to storage');
  t=new SlotTable({storage:st});assert.equal(t.displayName(2,4),'Zed','still there after a reload');
  t.setName(2,'');assert.equal(t.displayName(2,4),'MABEL');
  t=new SlotTable({storage:st});assert.equal(t.displayName(2,4),'MABEL');
});
test('default names depend on who sits there',()=>{
  const t=new SlotTable();
  assert.equal(t.displayName(0,4),'YOU');assert.equal(t.displayName(1,4),'RUFUS');
  t.setLocalPlayers(2);assert.equal(t.displayName(0,4),'P1');assert.equal(t.displayName(1,4),'P2');
  t.setLocalPlayers(1);t.setOwner(0,'bot');assert.notEqual(t.displayName(0,4),'YOU','a bot in seat 0 is never called YOU');
  t.setOwner(3,'remote');assert.equal(t.displayName(3,4),'P4');
});
test('remote ownership is NOT persisted; names, looks and skills are',()=>{
  const st=memStore();let t=new SlotTable({storage:st});
  t.setOwner(2,'remote');t.setName(2,'Net');t.setStyle(2,7);t.setSkill(2,'legend');
  t=new SlotTable({storage:st});
  assert.equal(t.owner(2),'bot');assert.equal(t.get(2).name,'Net');assert.equal(t.get(2).style,7);assert.equal(t.get(2).skill,'legend');
});
test('corrupt or hostile storage never breaks loading',()=>{
  for(const raw of ['not json','{"v":2}','{"v":1,"slots":"x"}','null','[]','{"v":1,"slots":[null,5,{"name":{"a":1},"style":99,"skill":"constructor"}]}']){
    const st=memStore();st.setItem(SLOTS_KEY,raw);
    const t=new SlotTable({storage:st});
    for(let i=0;i<MAX_PLAYERS;i++){assert.equal(typeof t.get(i).name,'string');assert.ok(t.get(i).style===-1||t.get(i).style<MAX_PLAYERS);assert.equal(t.get(i).skill,'')}
  }
  const st={getItem(){throw new Error('denied')},setItem(){throw new Error('denied')}};
  const t=new SlotTable({storage:st});t.setName(1,'ok');assert.equal(t.get(1).name,'ok','storage failures are swallowed');
});
test('assignStyles gives every seat a distinct look and honours explicit picks',()=>{
  assert.deepEqual(assignStyles([],4),[0,1,2,3]);
  assert.deepEqual(assignStyles([-1,5],4),[0,5,2,3]);
  const r=assignStyles([-1,-1,0],4);                      // seat 2 insists on look 0, seat 0 must move
  assert.equal(r[2],0);assert.equal(new Set(r).size,4);
  const clash=assignStyles([3,3,3],3);assert.equal(new Set(clash).size,3);assert.equal(clash[0],3,'lowest seat wins a clash');
  const all=assignStyles(new Array(MAX_PLAYERS).fill(9),MAX_PLAYERS);assert.equal(new Set(all).size,MAX_PLAYERS);
  for(const v of assignStyles([99,-5,1.5,NaN],4))assert.ok(v>=0&&v<MAX_PLAYERS);
});
test('resolve gives the Sim everything it needs, with unique looks',()=>{
  const t=new SlotTable();t.setOwner(2,'remote');t.setName(2,'Zed');t.setStyle(2,0);t.setSkill(1,'hard');
  const r=t.resolve(4);
  assert.equal(r.length,4);assert.deepEqual(r.map(x=>x.owner),['local','bot','remote','bot']);
  assert.equal(r[2].name,'Zed');assert.equal(r[2].custom,true);assert.equal(r[1].skill,'hard');
  assert.equal(new Set(r.map(x=>x.style)).size,4);assert.equal(r[2].style,0);
  assert.equal(t.resolve(99).length,MAX_PLAYERS);
});
test('snapshot exposes the v0.21 shape (id,name,human,local) plus owner/device/style',()=>{
  const t=new SlotTable();t.setOwner(1,'remote');
  const s=t.snapshot(3);
  assert.deepEqual(s.map(x=>[x.id,x.human,x.local,x.owner]),[[0,true,true,'local'],[1,true,false,'remote'],[2,false,false,'bot']]);
  s[0].name='mutated';assert.notEqual(t.displayName(0,3),'mutated','snapshot is a copy');
});
test('change listeners hear about owner / name / style changes and can unsubscribe',()=>{
  const t=new SlotTable(),seen=[];const off=t.on(e=>seen.push(e.type+':'+e.slot));
  t.setOwner(2,'remote');t.setName(2,'A');t.setStyle(2,4);t.setOwner(2,'remote');
  off();t.setName(2,'B');
  assert.deepEqual(seen,['owner:2','name:2','style:2']);
});
test('reset restores factory seating; reset(true) also forgets names',()=>{
  const st=memStore(),t=new SlotTable({storage:st});
  t.setOwner(2,'remote');t.setName(2,'Zed');t.setLocalPlayers(2);
  t.reset();assert.deepEqual([t.owner(0),t.owner(1),t.owner(2)],['local','bot','bot']);assert.equal(t.get(2).name,'Zed');
  t.reset(true);assert.equal(t.get(2).name,'');
});
