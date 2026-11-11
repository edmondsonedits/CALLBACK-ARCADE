(()=>{
'use strict';
const api=window.RoyalSumo;let socket=null,base='',room=null,roster=[],lastSeq=new Map(),oldSeats=[],retry=null,timer=null,closing=false,ready=false,lastPlayable=null;
const style=document.createElement('style');style.textContent=`.so-launch{position:fixed;right:12px;bottom:12px;z-index:40;border:2px solid #ffe294;border-radius:14px;background:#392058;color:#fff4d6;padding:10px 15px;font:bold 14px system-ui;cursor:pointer}.so-dialog{position:fixed;inset:0;z-index:11000;background:#150a26e8;color:#fff4d6;display:grid;place-items:center;padding:16px;font:16px system-ui}.so-dialog[hidden]{display:none}.so-card{width:min(460px,100%);max-height:90dvh;overflow:auto;background:#2b1844;border:2px solid #ffcf53;border-radius:24px;padding:24px;box-sizing:border-box}.so-card h2{margin:0 0 12px}.so-card button,.so-card a{display:inline-block;background:#ffcf53;color:#251330;border:0;border-radius:12px;padding:12px 16px;margin:5px 3px;font:700 15px system-ui;cursor:pointer}.so-card button:disabled{opacity:.45;cursor:wait}.so-code{font:bold 38px ui-monospace;letter-spacing:5px;margin:12px 0}.so-link{overflow-wrap:anywhere;font-size:13px}.so-roster{padding-left:20px;line-height:1.7}.so-message{line-height:1.45;min-height:24px}.so-row{display:flex;gap:8px;align-items:center;margin:16px 0}.so-small{font-size:13px;opacity:.8}`;document.head.append(style);
const launch=document.createElement('button');launch.className='so-launch';launch.textContent='Phone players';launch.type='button';document.body.append(launch);
const modal=document.createElement('div');modal.className='so-dialog';modal.hidden=true;modal.innerHTML='<section class="so-card" role="dialog" aria-modal="true" aria-label="Phone players"><h2>Phone players</h2><p class="so-message" role="status">Use your phones to join this screen.</p><label class="so-row"><input id="so-tv" type="checkbox"> TV only · everyone uses a phone</label><button id="so-create">Create room</button><div id="so-info" hidden><div class="so-code"></div><p class="so-link"></p><button id="so-copy">Copy join link</button><ul class="so-roster"></ul><p class="so-small">Each phone replaces a bot. Keep this screen open.</p><button id="so-start">Play / Resume</button><button id="so-end">End room</button></div><button id="so-close">Close</button></section>';document.body.append(modal);
const $=s=>modal.querySelector(s),message=t=>$('.so-message').textContent=t;
function pause(){if(api.debug.stats().mode==='game'&&!api.debug.stats().paused)document.querySelector('.hud-pause')?.click();clearRemoteInputs()}
function clearRemoteInputs(){for(const p of roster)if(api.multiplayer.getSlots()[p.seat]?.owner==='remote')api.multiplayer.setOwner(p.seat,'remote')}
function roomKey(){return 'royalSumo.onlineHost:'+base}
function neutral(seat){api.multiplayer.submitInput(seat,{moveX:0,moveY:0,bashDown:false});api.multiplayer.setOwner(seat,'bot')}
function restore(){for(const p of oldSeats)api.multiplayer.setOwner(p.id,p.owner,{device:p.device});oldSeats=[]}
function showRoster(){const ul=$('.so-roster');ul.replaceChildren();for(const p of roster){const li=document.createElement('li');li.textContent=`${p.name} · P${p.seat+1} · ${!p.connected?'bot takeover':p.seat>=api.getState().n?'waiting for a larger match':'connected'}`;ul.append(li)}if(!roster.length){const li=document.createElement('li');li.textContent='Waiting for phones…';ul.append(li)}}
function applyRoster(){if(!room)return;for(const slot of api.multiplayer.getSlots()){const p=roster.find(p=>p.seat===slot.id);if(p&&slot.name!==p.name)api.multiplayer.setPlayerName(slot.id,p.name);const owner=p?(ready&&p.connected?'remote':'bot'):room.localSeats.includes(slot.id)?'local':'bot';if(slot.owner!==owner)api.multiplayer.setOwner(slot.id,owner,{device:slot.id===0?'p1':'p2'})}}
function send(v){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({v:1,...v}))}
function connect(){
 if(!room||closing)return;ready=false;message('Connecting…');
 socket=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+room.code+'/socket');
 socket.onopen=()=>send({type:'auth',role:'host',token:room.token});
 socket.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.v!==1)return;
  if(m.type==='welcome'){ready=true;message('Room open. Share the join link with your players.');launch.textContent=room.code+' · Phones';lastSeq.clear();return}
  if(m.type==='roster'){for(const p of m.players){if(!roster.some(x=>x.seat===p.seat&&x.connected)&&p.connected){lastSeq.delete(p.seat)}if(!p.connected){neutral(p.seat)}}for(const p of roster)if(!m.players.some(x=>x.seat===p.seat)){neutral(p.seat);}roster=m.players;showRoster();applyRoster();return}
  if(m.type==='input'&&Number.isInteger(m.seat)&&m.seq>(lastSeq.get(m.seat)??-1)&&roster.some(p=>p.seat===m.seat&&p.connected)){
   lastSeq.set(m.seat,m.seq);if(api.debug.stats().paused||api.debug.stats().mode!=='game')return;
   if(api.multiplayer.getSlots()[m.seat]?.owner!=='remote')api.multiplayer.setOwner(m.seat,'remote');api.multiplayer.submitInput(m.seat,{moveX:m.x,moveY:m.y,bashDown:m.bash,dashPressed:m.dash,sequence:m.seq});return;
  }
  if(m.type==='closed'||m.type==='error'&&['ROOM_EXPIRED','BAD_HOST'].includes(m.code)){message('Room closed. Create a new room to play again.');end(false);return}
 };
 socket.onclose=e=>{ready=false;pause();for(const p of roster)neutral(p.seat);if(!closing&&room){if(e.code===4001){message('This room was opened on another host tab.');end(false)}else{message('Connection lost. Match paused; reconnecting…');retry=setTimeout(connect,1500)}}};
 socket.onerror=()=>message('Connection interrupted. Reconnecting…');
}
function startLoop(){let beat=0;lastPlayable=null;clearInterval(timer);timer=setInterval(()=>{applyRoster();const s=api.getState(),d=api.debug.stats();const playable=d.mode==='game'&&!d.paused&&['fight','countdown'].includes(s.phase);if(!playable&&lastPlayable!==false)clearRemoteInputs();lastPlayable=playable;if(++beat%2)return;send({type:'status',active:d.mode==='game',paused:d.paused,phase:s.phase,fighters:s.n})},250)}
async function resolveBase(){
 let configured='';try{configured=(await(await fetch(new URL('online/config.json',location.href),{cache:'no-store'})).json()).relay||''}catch{}
 const u=new URL(configured||location.origin);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Online rooms are not available on this link yet.');
 const health=await fetch(u.origin+'/api/health',{signal:AbortSignal.timeout(5000)});if(!health.ok||(await health.json()).protocol!==1)throw Error('Online rooms are not available on this link yet.');return u.origin;
}
function displayRoom(){const join=base+'/online/controller.html?room='+room.code;$('.so-code').textContent=room.code;$('.so-link').textContent=join;$('#so-info').hidden=false;$('#so-create').hidden=true;$('#so-tv').closest('label').hidden=true;$('#so-copy').onclick=async()=>{try{await navigator.clipboard.writeText(join);message('Join link copied.')}catch{message('Copy the link shown above.')}}}
async function create(){
 $('#so-create').disabled=true;message('Opening room…');
 try{
  base=await resolveBase();oldSeats=api.multiplayer.getSlots();const locals=$('#so-tv').checked?[]:oldSeats.filter(p=>p.owner==='local').map(p=>p.id);if(!$('#so-tv').checked&&!locals.length)locals.push(0);
  const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({v:1,localSeats:locals}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Could not create a room. Please try again.');room={...await response.json(),localSeats:locals};
  sessionStorage.setItem(roomKey(),JSON.stringify(room));closing=false;
  api.multiplayer.setFighterCount(10);for(let i=0;i<10;i++)api.multiplayer.setOwner(i,locals.includes(i)?'local':'bot',{device:i===0?'p1':'p2'});
  pause();displayRoom();connect();startLoop();
 }catch(e){message(e.message||'Could not connect.');room=null}finally{$('#so-create').disabled=false}
}
function end(notify=true){closing=true;clearTimeout(retry);clearInterval(timer);if(notify)send({type:'close'});socket?.close();socket=null;ready=false;for(const p of roster)neutral(p.seat);roster=[];restore();room=null;try{sessionStorage.removeItem(roomKey())}catch{};$('#so-info').hidden=true;$('#so-create').hidden=false;$('#so-tv').closest('label').hidden=false;launch.textContent='Phone players'}
launch.onclick=async()=>{modal.hidden=false;pause();$('#so-close').focus();if(!room){try{base=await resolveBase();const saved=JSON.parse(sessionStorage.getItem(roomKey())||'null');if(saved?.code&&saved?.token){room=saved;closing=false;oldSeats=api.multiplayer.getSlots();api.multiplayer.setFighterCount(10);for(let i=0;i<10;i++)api.multiplayer.setOwner(i,(room.localSeats||[0]).includes(i)?'local':'bot',{device:i===0?'p1':'p2'});pause();displayRoom();connect();startLoop()}}catch{}}};$('#so-close').onclick=()=>{modal.hidden=true;launch.focus()};$('#so-create').onclick=create;$('#so-end').onclick=()=>{end();message('Room ended. You can continue playing locally.')};$('#so-start').onclick=()=>{modal.hidden=true;clearRemoteInputs();api.resume()};
modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();modal.hidden=true;launch.focus()}if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button,input')].filter(x=>!x.disabled&&x.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&room){pause();send({type:'status',active:true,paused:true,phase:api.getState().phase,fighters:api.getState().n})}});
window.addEventListener('pagehide',()=>{closing=true;socket?.close()});
window.CallbackSumoOnline={getState:()=>({connected:ready,code:room?.code,players:roster.map(p=>({...p}))}),end};
})();
