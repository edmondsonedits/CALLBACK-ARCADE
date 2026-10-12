import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {WebSocketServer} from 'ws';
import {Room} from './room.mjs';
import {attach} from './socket.mjs';
const root=fileURLToPath(new URL('../source/',import.meta.url));
export async function startServer({port=8787,host='127.0.0.1'}={}){
 const rooms=new Map(),rates=new Map();
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   const url=new URL(req.url,'http://local');if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return}
   if(url.pathname==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,protocol:1}));return}
   if(url.pathname==='/api/rooms'&&req.method==='POST'){
    if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){res.writeHead(403);res.end('Origin refused');return}
    const key=req.socket.remoteAddress,now=Date.now(),recent=(rates.get(key)||[]).filter(t=>now-t<60000);if(recent.length>=10){res.writeHead(429);res.end('Try again shortly');return}recent.push(now);rates.set(key,recent);
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024){res.writeHead(413);res.end();return}}
    const body=JSON.parse(raw);if(body.v!==1||!Array.isArray(body.localSeats)||body.localSeats.some(x=>![0,1].includes(x))||new Set(body.localSeats).size!==body.localSeats.length){res.writeHead(400);res.end('Invalid room options');return}
    let code;do{code=Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%31]).join('')}while(rooms.has(code));
    const room=await Room.create({code,localSeats:body.localSeats});rooms.set(code,room);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({code,token:room.hostToken}));delete room.hostToken;return;
   }
   const files={'/':'index.html','/index.html':'index.html','/online/controller.html':'online/controller.html','/online/controller.js':'online/controller.js','/online/config.json':'online/config.json'};
   const path=files[url.pathname];if(!path){res.writeHead(404);res.end('Not found');return}
   res.setHeader('Content-Type',path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.json')?'application/json':'text/javascript');res.end(await readFile(join(root,path)));
  }catch{res.writeHead(400);res.end('Invalid request')}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:1024});
 server.on('upgrade',(req,socket,head)=>{
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){socket.destroy();return}
  const m=/^\/api\/rooms\/([A-Z2-9]{6})\/socket$/.exec(req.url);const room=m&&rooms.get(m[1]);
  if(!room||room.closed||wss.clients.size>160){socket.destroy();return}
  wss.handleUpgrade(req,socket,head,ws=>{const handlers=attach(room,ws);ws.on('message',(data,binary)=>handlers.message(binary?data:data.toString()));ws.on('close',handlers.close);ws.on('error',handlers.close)});
 });
 const timer=setInterval(()=>{for(const [code,room]of rooms){room.tick();if(room.closed)rooms.delete(code)}},500);timer.unref();
 await new Promise(resolve=>server.listen(port,host,resolve));
 return {url:`http://127.0.0.1:${server.address().port}`,rooms,close:async()=>{clearInterval(timer);for(const room of rooms.values())room.shutdown();for(const s of wss.clients)s.terminate();await new Promise(resolve=>server.close(resolve));wss.close()}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const s=await startServer({port:Number(process.env.PORT)||8787,host:process.env.HOST||'127.0.0.1'});console.log(`Royal Sumo server: ${s.url}`)}
