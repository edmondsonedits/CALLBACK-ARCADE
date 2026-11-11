'use client';
import { useEffect, useState } from 'react';
import './WinnersShowcase.css';
type Preference={enabled:boolean;scope?:'hall'|'winners';entries:Array<{id:string;round:number;status:string}>};
export function SketchShowcasePreference({code,matchId}:{code:string;matchId?:string}){
  const [value,setValue]=useState<Preference|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();void fetch(`/api/rooms/${encodeURIComponent(code)}/showcase`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.ok)setValue(await r.json() as Preference);}).catch(()=>{});return()=>controller.abort();},[code,matchId]);
  async function save(body:{enabled:boolean}|{withdrawId:string}){setBusy(true);setError('');try{const r=await fetch(`/api/rooms/${encodeURIComponent(code)}/showcase`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error('Could not save. Please retry while your player seat is active.');setValue(await r.json() as Preference);}catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}
  if(!value)return null;
  return <aside className="sketch-showcase-preference" aria-label="Public artwork preference"><label><input type="checkbox" checked={value.enabled} disabled={busy} onChange={e=>void save({enabled:e.target.checked})}/><span>{value.scope==='hall'?'Feature my Hall-nominated artwork':'Feature my winning artwork'} on the main menu</span></label><p>Your {value.scope==='hall'?'Hall-nominated':'winning'} drawing, transformed image and display name will be public. Optional, off by default. Turning this off withdraws your featured artwork from this room.</p>{value.entries.length>0&&<ul>{value.entries.map(entry=><li key={entry.id}><span>Round {entry.round} · {entry.status==='pending'?'saving artwork':'featured'}</span><button type="button" disabled={busy} onClick={()=>void save({withdrawId:entry.id})}>Withdraw</button></li>)}</ul>}<p>You can withdraw here while this player seat is valid. Already downloaded public images cannot be recalled.</p>{error&&<p role="alert">{error}</p>}</aside>;
}
