// Run only against the explicitly selected Sites deployment after publication.
import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base||!/^https:\/\//.test(base))throw Error('Pass the deployed HTTPS site URL');
const origin=new URL(base).origin;
const games=['royal-sumo','royal-ballistix','royal-scratch-match','royal-roller-ruckus','royal-twisted','space-bash','blind-crown'];
const latencies=[];
async function post(path,body={},cookie=''){
 const start=performance.now();
 const response=await fetch(origin+'/api/arcade-phone/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const raw=await response.text();let data;try{data=JSON.parse(raw)}catch{throw Error(`Phone API ${path.split('/').at(-1)} returned ${response.status} with ${raw.length} non-JSON bytes`)}latencies.push(performance.now()-start);
 return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]||cookie};
}
for(const game of games){
 const asset=await fetch(origin+'/arcade-games/'+game+'/index.html');assert.equal(asset.status,200,game+' asset');const html=await asset.text();assert.ok(html.includes('phone/host.js'),game+' host injection');
 const room=await post('create',{game});assert.equal(room.status,201,JSON.stringify(room.data));const {code}=room.data;
 try{
  const count=game==='royal-sumo'?10:2;
  const phones=await Promise.all(Array.from({length:count},(_,i)=>post(code+'/join',{name:'Verification '+(i+1)})));
  for(const p of phones)assert.equal(p.status,201,JSON.stringify(p.data));assert.equal(new Set(phones.map(p=>p.data.seat)).size,count);
  if(count===10)assert.equal((await post(code+'/join',{name:'Capacity check'})).status,409);
  const status={phase:'verification',paused:false,active:true,text:'Connection verification'};
  const privateStates=Object.fromEntries(phones.map(p=>[p.data.seat,{ownSeat:p.data.seat}]));
  assert.equal((await post(code+'/host',{status,privateStates},room.cookie)).status,200);
  // Poll concurrently, as the actual TV does, instead of waiting for the slowest phone response.
  const received=new Set();const ack={};let sending=true;let roster=[];
  const inputWork=Promise.all(phones.map(p=>post(code+'/input',{seq:1,x:.5,y:0,buttons:1},p.cookie))).finally(()=>{sending=false});
  const deadline=performance.now()+12000;
  do{
   const host=await post(code+'/host',{status,ack},room.cookie);assert.equal(host.status,200);roster=host.data.roster;
   for(const item of host.data.inputs){assert.equal(item.packet.seq,1);received.add(item.seat);ack[item.seat]=item.packet.seq}
   if(received.size===count&&!sending)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }while(performance.now()<deadline&&(sending||received.size<count));
  const inputs=await inputWork;
  for(const input of inputs)assert.equal(input.status,200,JSON.stringify(input.data));
  assert.equal(roster.length,count);
  const delivered=received.size;
  assert.equal(delivered,count,game+' must deliver each phone input within the safety window');
  const own=await Promise.all(phones.map(p=>post(code+'/poll',{},p.cookie)));
  own.forEach((result,i)=>{assert.equal(result.status,200);assert.deepEqual(result.data.privateState,{ownSeat:phones[i].data.seat});assert.equal(result.data.lastSeq,1)});
  const restored=await post(code+'/join',{name:'Reconnected verification'},phones[0].cookie);assert.equal(restored.data.seat,phones[0].data.seat);
  assert.equal((await post(code+'/host',{status},phones[0].cookie)).status,401);
  console.log(JSON.stringify({game,roomCodeWorks:true,seats:count,deliveredWithinSafetyWindow:delivered,expected:count,privateRouting:true,reconnect:true}));
 }finally{const closed=await post(code+'/close',{},room.cookie);assert.equal(closed.status,200);assert.equal((await post(code+'/host',{status:{phase:'closed',paused:true,active:false,text:''}},room.cookie)).status,404)}
}
latencies.sort((a,b)=>a-b);console.log(JSON.stringify({requests:latencies.length,medianRoundTripMs:Math.round(latencies[Math.floor(latencies.length*.5)]),p95RoundTripMs:Math.round(latencies[Math.floor(latencies.length*.95)])}));
