export const PROTOCOL=1;
export const token=()=>crypto.randomUUID()+crypto.randomUUID();
export const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const nameOf=s=>String(s||'Player').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,12)||'Player';
const send=(s,v)=>{try{s.send(JSON.stringify({v:PROTOCOL,...v}))}catch{}};
export function parseInput(v){
 if(!v||Object.keys(v).sort().join(',')!=='bash,dash,seq,type,v,x,y'||v.v!==1||v.type!=='input'||!Number.isSafeInteger(v.seq)||v.seq<0||typeof v.bash!=='boolean'||typeof v.dash!=='boolean'||![v.x,v.y].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1))return null;
 const l=Math.max(1,Math.hypot(v.x,v.y));return {seq:v.seq,x:v.x/l,y:v.y/l,bash:v.bash,dash:v.dash};
}
export class Room{
 static async create({code,localSeats=[0],now=Date.now}){
  const hostToken=token();const room=new Room({code,hostHash:await digest(hostToken),localSeats,expires:now()+6*3600000,players:[]},now);room.hostToken=hostToken;return room;
 }
 constructor(saved,now=Date.now){
  Object.assign(this,{code:saved.code,hostHash:saved.hostHash,localSeats:saved.localSeats,expires:saved.expires});this.now=now;this.host=null;this.hostLast=0;this.closed=!!saved.closed;
  this.players=saved.players.map(p=>({...p,socket:null,connected:false,last:now(),seq:-1,budget:60,budgetAt:now()}));this.sockets=new Map();this.status={active:false,paused:true,phase:'waiting',fighters:10};this.events=[];this.eventId=0;
 }
 record(type,data){this.events.push({id:++this.eventId,t:this.now(),type,...data});if(this.events.length>2048)this.events.shift()}
 saved(){return {code:this.code,hostHash:this.hostHash,localSeats:this.localSeats,expires:this.expires,closed:this.closed,players:this.players.map(({seat,name,hash})=>({seat,name,hash}))}}
 roster(){return {type:'roster',code:this.code,hostConnected:!!this.host,status:this.status,localSeats:this.localSeats,players:this.players.map(p=>({seat:p.seat,name:p.name,connected:p.connected}))}}
 broadcast(){const data=this.roster();if(this.host)send(this.host,data);for(const p of this.players)if(p.socket)send(p.socket,data)}
 fail(socket,code,close=false){send(socket,{type:'error',code});if(close){try{socket.close(1008,code)}catch{}}}
 async receive(socket,v){
  if(this.closed||this.now()>=this.expires){this.fail(socket,'ROOM_EXPIRED',true);return}
  if(!v||typeof v!=='object'||Array.isArray(v)||v.v!==1){this.fail(socket,'BAD_PROTOCOL');return}
  let session=this.sockets.get(socket);
  if(!session){
   if(v.type!=='auth'){this.fail(socket,'AUTH_REQUIRED',true);return}
   if(v.role==='host'){
    if(typeof v.token!=='string'||await digest(v.token)!==this.hostHash){this.fail(socket,'BAD_HOST',true);return}
    if(this.host&&this.host!==socket){this.sockets.delete(this.host);this.host.close(4001,'Host replaced')}
    this.host=socket;this.hostLast=this.now();this.sockets.set(socket,{role:'host'});send(socket,{type:'welcome',role:'host',code:this.code});this.record('host-connected',{});this.broadcast();return;
   }
   if(v.role!=='player'){this.fail(socket,'BAD_ROLE',true);return}
   if(!this.host){this.fail(socket,'HOST_OFFLINE',true);return}
   let p,credential;
   if(v.token){const hash=typeof v.token==='string'?await digest(v.token):'';p=this.players.find(p=>p.hash===hash);if(!p){this.fail(socket,'SEAT_EXPIRED',true);return}}
   else{
    const seat=Array.from({length:this.status.fighters},(_,i)=>i).find(i=>!this.localSeats.includes(i)&&!this.players.some(p=>p.seat===i));
    if(seat===undefined){this.fail(socket,'ROOM_FULL',true);return}
    credential=token();const hash=await digest(credential);
    // Another authentication can finish while the hash is computed.
    const actual=Array.from({length:this.status.fighters},(_,i)=>i).find(i=>!this.localSeats.includes(i)&&!this.players.some(p=>p.seat===i));
    if(actual===undefined){this.fail(socket,'ROOM_FULL',true);return}
    p={seat:actual,name:nameOf(v.name),hash};this.players.push(p);
   }
   if(p.socket&&p.socket!==socket){this.sockets.delete(p.socket);p.socket.close(4001,'Controller replaced')}
   Object.assign(p,{socket,connected:true,last:this.now(),seq:p.seq??-1,budget:60,budgetAt:this.now()});this.sockets.set(socket,{role:'player',player:p});
   send(socket,{type:'welcome',role:'player',code:this.code,seat:p.seat,name:p.name,nextSeq:p.seq+1,...(credential?{token:credential}:{})});this.record('joined',{seat:p.seat,name:p.name});this.broadcast();return;
  }
  if(session.role==='host'){
   this.hostLast=this.now();
   if(v.type==='close'){this.shutdown();return}
   if(v.type==='ping'){send(socket,{type:'pong'});return}
   if(v.type==='status'&&typeof v.active==='boolean'&&typeof v.paused==='boolean'&&Number.isInteger(v.fighters)&&v.fighters>=2&&v.fighters<=10&&['intro','countdown','fight','roundend','matchend','waiting'].includes(v.phase)){
    const status={active:v.active,paused:v.paused,phase:v.phase,fighters:v.fighters};const changed=JSON.stringify(status)!==JSON.stringify(this.status);this.status=status;if(changed)this.broadcast();return;
   }
   this.fail(socket,'BAD_HOST_MESSAGE');return;
  }
  const p=session.player;
  if(v.type==='leave'){this.disconnect(socket);this.players=this.players.filter(x=>x!==p);this.sockets.delete(socket);socket.close(1000,'Left room');this.broadcast();return}
  const input=parseInput(v);if(!input){this.fail(socket,'BAD_INPUT');return}
  if(input.seq<=p.seq){this.fail(socket,'OLD_INPUT');return}
  const now=this.now();p.budget=Math.min(60,p.budget+(now-p.budgetAt)*.06);p.budgetAt=now;
  if(p.budget<1){this.fail(socket,'RATE_LIMIT');return}p.budget--;p.seq=input.seq;p.last=now;
  if(!p.connected){p.connected=true;this.broadcast()}
  if(!this.host||!this.status.active||this.status.paused||!['countdown','fight'].includes(this.status.phase)||p.seat>=this.status.fighters)return;
  send(this.host,{type:'input',seat:p.seat,...input});this.record('input',{seat:p.seat,...input});
 }
 disconnect(socket){
  const s=this.sockets.get(socket);this.sockets.delete(socket);if(!s)return;
  if(s.role==='host'){if(this.host===socket){this.host=null;this.status={...this.status,active:false,paused:true};this.record('host-disconnected',{})}}
  else if(s.player.socket===socket){const p=s.player;p.socket=null;p.connected=false;p.last=this.now();this.record('disconnected',{seat:p.seat})}
  this.broadcast();
 }
 tick(){
  const now=this.now();if(now>=this.expires){this.shutdown();return}
  if(this.host&&now-this.hostLast>8000){const s=this.host;this.disconnect(s);try{s.close(4000,'Host timeout')}catch{}}
  let changed=false;
  for(const p of this.players)if(p.connected&&now-p.last>2000){p.connected=false;changed=true;this.record('stale',{seat:p.seat})}
  for(const p of this.players)if(p.socket&&now-p.last>30000){const socket=p.socket;this.disconnect(socket);try{socket.close(4000,'Controller idle')}catch{}}
  const retained=this.players.filter(p=>p.socket||now-p.last<120000);if(retained.length!==this.players.length){this.players=retained;changed=true}
  if(changed)this.broadcast();
 }
 shutdown(){this.closed=true;for(const s of this.sockets.keys()){send(s,{type:'closed'});try{s.close(1000,'Room closed')}catch{}}this.sockets.clear();this.host=null}
}
