'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
export interface PartyStatus {phase:string;paused:boolean;epoch:number;round?:number;simPhase?:string;alive?:boolean[];connectedSeats?:string[]}
export function usePartySocket(code:string,role:'host'|'player'|'display',receive:(value:Record<string,unknown>)=>void){
 const authenticated=useRef(false);const socket=useRef<WebSocket|null>(null),listener=useRef(receive),epoch=useRef(0),sequence=useRef(0),controlSequence=useRef(0);
 const [connected,setConnected]=useState(false),[error,setError]=useState(''),[rtt,setRtt]=useState<number|null>(null),[status,setStatus]=useState<PartyStatus>({phase:'LOBBY',paused:false,epoch:0});
 useEffect(()=>{listener.current=receive},[receive]);
 useEffect(()=>{let stopped=false,retry:ReturnType<typeof setTimeout>,ping:ReturnType<typeof setInterval>,attempt=0;const samples:number[]=[];
  async function connect(){try{const response=await fetch(`/api/arcade/online/rooms/${code}/realtime`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role}),cache:'no-store'});const data=await response.json() as {ticket:string;socketUrl:string;error?:{message:string}};if(!response.ok)throw new Error(data.error?.message??'Rejoin the party to reconnect.');if(stopped)return;const ws=new WebSocket(data.socketUrl,['callback-party-v1',data.ticket]);socket.current=ws;ws.onopen=()=>ws.send(JSON.stringify({type:'auth',ticket:data.ticket}));ws.onmessage=event=>{let value:Record<string,unknown>;try{value=JSON.parse(event.data)}catch{return;}if(value.type==='ready'){authenticated.current=true;attempt=0;epoch.current=Number(value.epoch);sequence.current=Number(value.nextSeq??0);controlSequence.current=Number(value.nextControlSeq??0);setConnected(true);setError('');ping=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'ping',at:Date.now()}))},500);}
   if(value.type==='status'){const next=value as unknown as PartyStatus;epoch.current=next.epoch;setStatus(next);}
   const dynamic=(value.view as {dynamic?:PartyStatus}|undefined)?.dynamic;if(dynamic){epoch.current=dynamic.epoch;setStatus(old=>old.phase===dynamic.phase&&old.paused===dynamic.paused&&old.epoch===dynamic.epoch&&old.round===dynamic.round?old:{phase:dynamic.phase,paused:dynamic.paused,epoch:dynamic.epoch,round:dynamic.round});}
   if(value.type==='pong'){samples.push(Math.max(0,Date.now()-Number(value.at)));if(samples.length>30)samples.shift();setRtt([...samples].sort((a,b)=>a-b)[Math.floor(samples.length*.95)]);}
   if(value.type==='error')setError(String(value.code??'Connection error'));if(value.type==='control-ack'){epoch.current=Number(value.epoch);if(value.ok===false)setError(String(value.reason??'The action was rejected.'));else setError('');}
   listener.current(value);
  };ws.onclose=event=>{authenticated.current=false;clearInterval(ping);setConnected(false);if(!stopped){setError(event.code===4001?'This controller was opened on another tab.':'Reconnecting to Sumo…');if(event.code!==4001)retry=setTimeout(()=>void connect(),Math.min(5000,500*2**attempt++));}};ws.onerror=()=>setError('Sumo connection interrupted.');
  }catch(e){if(stopped)return;setConnected(false);setError(e instanceof Error?e.message:'Could not connect to Sumo.');retry=setTimeout(()=>void connect(),Math.min(5000,500*2**attempt++));}}
  void connect();return()=>{stopped=true;authenticated.current=false;clearTimeout(retry);clearInterval(ping);socket.current?.close();socket.current=null;};
 },[code,role]);
 const send=useCallback((body:Record<string,unknown>)=>{const ws=socket.current;if(!authenticated.current||!ws||ws.readyState!==WebSocket.OPEN||ws.bufferedAmount>4096)return false;ws.send(JSON.stringify(body));return true},[]);
 const control=useCallback((operation:string,options?:{seatId:string;enabled:boolean})=>send({type:'control',v:1,epoch:epoch.current,seq:++controlSequence.current,operation,...options}),[send]);
 const sendInput=useCallback((input:Record<string,unknown>)=>send({type:'input',v:1,epoch:epoch.current,seq:++sequence.current,...input}),[send]);
 return {connected,error,rtt,status,sendInput,control};
}
