"use client";
import {useEffect,useState} from "react";
export function ReturningArtControls({code}:{code:string}){
 const [hidden,setHidden]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;void fetch(`/api/rooms/${code}/creations`,{cache:'no-store'}).then(r=>r.json() as Promise<{hidden?:boolean}>).then(r=>{if(live)setHidden(Boolean(r.hidden));}).catch(()=>{});return()=>{live=false;};},[code]);
 return <><button disabled={busy} aria-pressed={hidden} onClick={async()=>{setBusy(true);setError('');try{const r=await fetch(`/api/rooms/${code}/creations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hideReturningArt:!hidden})});if(!r.ok)throw new Error();setHidden(!hidden);window.dispatchEvent(new Event('callback:creations-changed'));}catch{setError('Could not change returning art visibility.');}finally{setBusy(false);}}}>{hidden?'Show returning artwork':'Hide returning artwork'}</button>{error&&<span role="alert">{error}</span>}</>;
}
export function ReturningFishPermission({code}:{code:string}){
 const [enabled,setEnabled]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;void fetch('/api/profile',{cache:'no-store'}).then(()=>{const saved=localStorage.getItem('fish:allow-history')==='true';if(live)setEnabled(saved);return fetch(`/api/rooms/${code}/creations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({allowHistory:saved})});}).catch(()=>{});return()=>{live=false;};},[code]);
 return <label><input type="checkbox" checked={enabled} onChange={e=>{const value=e.target.checked;setEnabled(value);localStorage.setItem('fish:allow-history',String(value));void fetch(`/api/rooms/${code}/creations`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({allowHistory:value})}).then(r=>{if(!r.ok)throw new Error();setMessage('');}).catch(()=>{setEnabled(!value);localStorage.setItem('fish:allow-history',String(!value));setMessage('Could not update this permission. Try again.');});}}/> Let my previous fish visit while we draw.{message&&<span role="alert">{message}</span>}</label>;
}
