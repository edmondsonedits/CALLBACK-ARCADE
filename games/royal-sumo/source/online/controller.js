(()=>{'use strict';const $=s=>document.querySelector(s);let ws,code='',seq=0,credential='',active=false,stopped=false,retry,tick,last=0,moveId=null,bashId=null,origin=null,assigned=null,attempts=0,joinTimer=null;
const input={x:0,y:0,bash:false,dash:false},base=location.origin,storageKey=()=>`royalSumo.phone:${base}:${code}`;
function transmit(){if(ws?.readyState!==WebSocket.OPEN||assigned===null)return;ws.send(JSON.stringify({v:1,type:'input',seq:++seq,...input}));input.dash=false;last=performance.now()}
function reset(){Object.assign(input,{x:0,y:0,bash:false,dash:false});moveId=bashId=null;$('#knob').style.transform='';$('#bash').classList.remove('held');transmit()}
function status(text,on=false){$('#status').textContent=text;active=on;$('#controller').classList.toggle('disabled',!on);if(!on)reset()}
function fail(text){$('#join-status').textContent=text;$('#join').hidden=false;$('#controller').hidden=true;stopped=true;clearTimeout(retry);clearTimeout(joinTimer);clearInterval(tick);ws?.close();$('#join button').disabled=false}
function connect(){
 stopped=false;assigned=null;seq=0;clearTimeout(joinTimer);joinTimer=setTimeout(()=>fail('Room unavailable. Check the code and keep the host open.'),10000);ws=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+code+'/socket');
 ws.onopen=()=>ws.send(JSON.stringify({v:1,type:'auth',role:'player',name:$('#name').value,...(credential?{token:credential}:{})}));
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.v!==1)return;
  if(m.type==='welcome'){clearTimeout(joinTimer);attempts=0;assigned=m.seat;seq=m.nextSeq-1;if(m.token)credential=m.token;try{sessionStorage.setItem(storageKey(),JSON.stringify({token:credential,name:m.name}))}catch{}$('#identity').textContent=`${m.name} · P${m.seat+1} · ${code}`;$('#join').hidden=true;$('#controller').hidden=false;$('#join button').disabled=false;status('Waiting for the host');clearInterval(tick);tick=setInterval(()=>{if(performance.now()-last>45)transmit()},50);return}
  if(m.type==='roster'){if(!m.hostConnected)status('Host disconnected · waiting to reconnect');else if(assigned>=m.status.fighters)status('Your seat is waiting · ask the host to add fighters');else if(m.status.paused)status('Paused · look at the host screen');else if(!m.status.active)status('Waiting for the host');else if(['fight','countdown'].includes(m.status.phase))status('Go! Watch the host screen',true);else status(m.status.phase==='matchend'?'Match finished':'Next round…');return}
  if(m.type==='closed'){fail('The host ended this room.');return}
  if(m.type==='error'){const errors={ROOM_FULL:'This room is full.',HOST_OFFLINE:'The host is offline. Try again shortly.',SEAT_EXPIRED:'Your seat expired. Join again.',BAD_PROTOCOL:'Please refresh your controller.',ROOM_EXPIRED:'This room has expired.'};if(errors[m.code]){if(m.code==='SEAT_EXPIRED'){credential='';sessionStorage.removeItem(storageKey())}fail(errors[m.code])}}
 };
 ws.onclose=e=>{clearInterval(tick);if(stopped)return;if(++attempts>5){fail('Room unavailable. Check the code and keep the host open.');return}if(e.code===4001){fail('Your controller is open in another tab.');return}status('Reconnecting · a bot is covering your seat');retry=setTimeout(connect,1200)};
 ws.onerror=()=>status('Connection interrupted…');
}
$('#code').value=(new URLSearchParams(location.search).get('room')||'').toUpperCase();
code=$('#code').value;try{const saved=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(saved?.token){credential=saved.token;$('#name').value=saved.name;connect()}}catch{}
$('form').onsubmit=e=>{e.preventDefault();code=$('#code').value.trim().toUpperCase();if(!/^[A-Z2-9]{6}$/.test(code))return;credential='';try{const saved=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(saved)credential=saved.token}catch{}$('#join button').disabled=true;$('#join-status').textContent='Joining…';connect()};
$('#leave').onclick=()=>{reset();stopped=true;if(ws?.readyState===1)ws.send(JSON.stringify({v:1,type:'leave'}));sessionStorage.removeItem(storageKey());credential='';fail('You left the room.')};
const pad=$('#pad');pad.onpointerdown=e=>{if(!active||moveId!==null)return;e.preventDefault();moveId=e.pointerId;origin={x:e.clientX,y:e.clientY};pad.setPointerCapture(e.pointerId)};
pad.onpointermove=e=>{if(e.pointerId!==moveId||!active)return;const x=(e.clientX-origin.x)/55,y=(e.clientY-origin.y)/55,l=Math.max(1,Math.hypot(x,y));input.x=x/l;input.y=y/l;$('#knob').style.transform=`translate(${input.x*40}px,${input.y*40}px)`;if(performance.now()-last>30)transmit()};
const stopMove=e=>{if(e.pointerId!==moveId)return;moveId=null;input.x=input.y=0;$('#knob').style.transform='';transmit()};pad.onpointerup=stopMove;pad.onpointercancel=stopMove;pad.onlostpointercapture=stopMove;
$('#bash').onpointerdown=e=>{if(!active||bashId!==null)return;e.preventDefault();bashId=e.pointerId;$('#bash').setPointerCapture(e.pointerId);input.bash=true;$('#bash').classList.add('held');transmit()};
const stopBash=e=>{if(e.pointerId!==bashId)return;bashId=null;input.bash=false;$('#bash').classList.remove('held');transmit()};$('#bash').onpointerup=stopBash;$('#bash').onpointercancel=stopBash;$('#bash').onlostpointercapture=stopBash;
$('#dash').onpointerdown=e=>{if(!active)return;e.preventDefault();input.dash=true;transmit()};
window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden){reset();clearInterval(tick);ws?.close()}else if(!stopped&&code&&ws?.readyState===WebSocket.CLOSED){clearTimeout(retry);connect()}});window.addEventListener('pagehide',()=>{stopped=true;reset();ws?.close()});
})();
