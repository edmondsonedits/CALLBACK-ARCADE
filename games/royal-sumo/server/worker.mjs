import {Room,digest} from './room.mjs';
import {attach} from './socket.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const allowed=[url.origin,...(env.ALLOWED_ORIGINS||'').split(',')];
  if(origin&&!allowed.includes(origin))return json({error:'Origin refused'},403);
  const cors=response=>{if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin')}return response};
  if(url.pathname.startsWith('/api/')&&request.method==='OPTIONS')return cors(new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}}));
  if(url.pathname==='/api/health')return cors(json({ok:true,protocol:1}));
  if(url.pathname==='/api/rooms'&&request.method==='POST'){
   const body=await request.text();if(body.length>1024)return cors(json({error:'Too large'},413));
   const reply=await env.SUMO_ROOMS.get(env.SUMO_ROOMS.idFromName('_directory')).fetch(new Request('https://internal/create',{method:'POST',headers:{'X-Client-IP':request.headers.get('CF-Connecting-IP')||'unknown'},body}));
   return cors(new Response(reply.body,reply));
  }
  const m=/^\/api\/rooms\/([A-Z2-9]{6})\/socket$/.exec(url.pathname);
  if(m)return env.SUMO_ROOMS.get(env.SUMO_ROOMS.idFromName(m[1])).fetch(request);
  if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
  return env.ASSETS.fetch(request);
 }
};
export class SumoRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.room=null;this.connections=new Set();this.lastSaved='';ctx.blockConcurrencyWhile(async()=>{const saved=await ctx.storage.get('room');if(saved)this.room=new Room(saved)})}
 async save(){if(!this.room)return;const saved=JSON.stringify(this.room.saved());if(saved!==this.lastSaved){await this.ctx.storage.put('room',JSON.parse(saved));this.lastSaved=saved}}
 async fetch(request){
  const url=new URL(request.url);
  if(url.hostname==='internal'&&url.pathname==='/create'){
   const raw=await request.text();if(raw.length>1024)return json({error:'Too large'},413);
   let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid JSON'},400)}
   if(body.v!==1||!Array.isArray(body.localSeats)||body.localSeats.length>2||body.localSeats.some(x=>![0,1].includes(x))||new Set(body.localSeats).size!==body.localSeats.length)return json({error:'Invalid room options'},400);
   const key='rate:'+await digest(request.headers.get('X-Client-IP')||'unknown'),now=Date.now();const recent=((await this.ctx.storage.get(key))||[]).filter(t=>now-t<60000);
   if(recent.length>=10)return json({error:'Try again shortly'},429);recent.push(now);await this.ctx.storage.put(key,recent);await this.ctx.storage.setAlarm(now+120000);
   for(let attempt=0;attempt<4;attempt++){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>alphabet[v%alphabet.length]).join('');
    const reply=await this.env.SUMO_ROOMS.get(this.env.SUMO_ROOMS.idFromName(code)).fetch(new Request('https://internal/initialize',{method:'POST',body:JSON.stringify({code,localSeats:body.localSeats})}));if(reply.status!==409)return reply;
   }return json({error:'Please retry'},503);
  }
  if(url.hostname==='internal'&&url.pathname==='/initialize'){
   if(this.room&&!this.room.closed&&this.room.expires>Date.now())return json({error:'Collision'},409);
   const options=await request.json();this.room=await Room.create(options);await this.save();await this.ctx.storage.setAlarm(this.room.expires);
   const result=json({code:this.room.code,token:this.room.hostToken});delete this.room.hostToken;return result;
  }
  if(!this.room||this.room.closed||this.room.expires<=Date.now())return json({error:'Room expired'},404);
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
  if(this.connections.size>=24)return json({error:'Too many connections'},429);
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();this.connections.add(server);
  const handlers=attach(this.room,server,()=>this.save());server.addEventListener('message',e=>handlers.message(e.data));
  const close=()=>{handlers.close();this.connections.delete(server);if(!this.connections.size){clearInterval(this.timer);this.timer=null}};
  server.addEventListener('close',close);server.addEventListener('error',close);
  if(!this.timer)this.timer=setInterval(()=>{this.room.tick();if(this.room.closed)this.ctx.storage.deleteAll()},500);
  return new Response(null,{status:101,webSocket:client});
 }
 async alarm(){if(this.room){this.room.shutdown();await this.ctx.storage.deleteAll()}else{const entries=await this.ctx.storage.list({prefix:'rate:'});for(const [key,times]of entries)if(times.every(t=>Date.now()-t>60000))await this.ctx.storage.delete(key)}}
}
