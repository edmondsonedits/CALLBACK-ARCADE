'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { OnlineSnapshot } from './online-client';
import { usePartySocket } from './usePartySocket';
import {useHostMusicPhase} from '../HostMusicProvider';
import './realtime-sumo.css';
import BotSwitch from '../BotSwitch';
interface Bootstrap {view:{sim:{mapId:string;data:{seed:unknown;round:unknown}}|null};[key:string]:unknown}
export function RealtimeSumoHost({room,readOnly=false}:{room:OnlineSnapshot;readOnly?:boolean}){
 const frame=useRef<HTMLIFrameElement>(null),bootstrap=useRef<Bootstrap|null>(null),latest=useRef<Record<string,unknown>|null>(null),serial=useRef(0);
 const [botEnabled,setBotEnabled]=useState<Record<string,boolean>>({});
 const [roundKey,setRoundKey]=useState('initial'),[finished,setFinished]=useState(false),[hasSimulation,setHasSimulation]=useState(false);
 const post=useCallback((type:string,snapshot:unknown)=>frame.current?.contentWindow?.postMessage({type,snapshot},location.origin),[]);
 const postBootstrap=useCallback(()=>{const b=bootstrap.current;if(b)post('callback:online-view',{...b,matchId:room.matchId,version:++serial.current});},[post,room.matchId]);
 const receive=useCallback((value:Record<string,unknown>)=>{if(value.botEnabled&&typeof value.botEnabled==='object')setBotEnabled(value.botEnabled as Record<string,boolean>);const snapshot=value.type==='ready'||value.type==='bootstrap'?value.snapshot:value;const b=snapshot as Bootstrap;
  if(b?.view&&'sim' in b.view){bootstrap.current=b;setHasSimulation(Boolean(b.view.sim));if(b.view.sim)setRoundKey(b.view.sim.mapId+':'+b.view.sim.data.seed+':'+b.view.sim.data.round);postBootstrap();}
  const d=snapshot as {view?:{dynamic?:unknown};finished?:boolean};if(d?.view?.dynamic){latest.current=snapshot as Record<string,unknown>;setFinished(Boolean(d.finished));post('callback:party-dynamic',snapshot);}
 },[post,postBootstrap]);
 const party=usePartySocket(room.code,readOnly?'display':'host',receive);
 useHostMusicPhase(party.status.phase!=='LOBBY',room.gameId);
 useEffect(()=>{const ready=(e:MessageEvent)=>{if(e.source!==frame.current?.contentWindow||e.origin!==location.origin||e.data?.type!=='callback:online-ready')return;postBootstrap();if(latest.current)post('callback:party-dynamic',latest.current);};window.addEventListener('message',ready);return()=>window.removeEventListener('message',ready);},[post,postBootstrap]);
 return <main className="sumo-live-host"><header><strong>Royal Sumo</strong><span role="status">{party.connected?'Connected':'Connecting'} · RTT p95 {party.rtt??'—'} ms</span>{!readOnly&&<button disabled={!party.connected} onClick={()=>party.control(party.status.paused?'resume':'pause')}>{party.status.paused?'Resume':'Pause'}</button>}<span data-host-music-control className="session-music-slot"/></header>
 {hasSimulation?<iframe key={roundKey} ref={frame} src="/arcade-games/royal-sumo/realtime-pilot.html?online=1" title="Royal Sumo real-time match" allow="fullscreen; gamepad"/>:<section className="sumo-live-start"><h1>{party.status.phase==='COUNTDOWN'?'Get ready…':'Royal Sumo · Crownfall'}</h1><p>Everyone stays in your shared party. Empty seats use bots.</p><p>{room.players.map(p=>p.name).join(' · ')}</p><div className="online-roster">{Array.from({length:10},(_,i)=>String(i).padStart(2,'0')).filter(id=>!room.players.some(p=>p.id===id)).map(id=><BotSwitch key={id} number={Number(id)+1} enabled={botEnabled[id]!==false} disabled={readOnly||!party.connected||party.status.phase!=='LOBBY'} onChange={enabled=>party.control('bot',{seatId:id,enabled})}/>)}</div>{readOnly?<p>Waiting for the host…</p>:<button disabled={!party.connected||party.status.phase==='COUNTDOWN'||room.players.length+Array.from({length:10},(_,i)=>String(i).padStart(2,'0')).filter(id=>!room.players.some(p=>p.id===id)&&botEnabled[id]!==false).length<2} onClick={()=>party.control('start')}>Start Sumo</button>}</section>}
 {finished&&!readOnly&&<div className="sumo-live-results"><button disabled={!party.connected} onClick={()=>{bootstrap.current=null;latest.current=null;setHasSimulation(false);setFinished(false);party.control('start')}}>Play again</button><p>Use New Game above to take the entire party to another game.</p></div>}
 {party.error&&<p role="alert" className="sumo-live-error">{party.error}</p>}{party.status.paused&&<div className="sumo-live-pause">Paused · {!readOnly&&<button onClick={()=>party.control('resume')}>Resume</button>}</div>}
 </main>;
}
export {default as RealtimeSumoPhone} from './RealtimeSumoPhone';
