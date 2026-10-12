export function attach(room,socket,onChange=()=>{}){
 let chain=Promise.resolve();let authenticated=false;
 const timeout=setTimeout(()=>{if(!authenticated)socket.close(1008,'Authentication timeout')},5000);
 const message=raw=>{
  if(typeof raw!=='string'||raw.length>1024){socket.close(1009,'Message too large');return}
  let data;try{data=JSON.parse(raw)}catch{socket.close(1007,'Invalid JSON');return}
  chain=chain.then(async()=>{await room.receive(socket,data);authenticated=room.sockets.has(socket);if(authenticated)clearTimeout(timeout);await onChange()}).catch(()=>{socket.close(1011,'Room error')});
 };
 const close=()=>{clearTimeout(timeout);room.disconnect(socket);Promise.resolve(onChange()).catch(()=>{})};
 return {message,close};
}
