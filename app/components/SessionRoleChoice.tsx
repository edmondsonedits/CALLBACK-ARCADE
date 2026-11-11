'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export function SessionRoleChoice(){
  const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function host(){setBusy(true);setError('');try{
    let saved:string|null=null;try{saved=localStorage.getItem('callback.host-session');}catch{/* Storage is optional. */}
    if(saved){const r=await fetch('/api/sessions/'+saved,{cache:'no-store'});if(r.ok&&(await r.json() as {role:string}).role==='host'){router.push('/session/'+saved+'/host');return;}}
    const response=await fetch('/api/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json() as {code:string;error?:{message:string}};if(!response.ok)throw new Error(data.error?.message??'Could not create your lobby.');
    try{localStorage.setItem('callback.host-session',data.code);}catch{/* Storage is optional. */}
    router.push('/session/'+data.code+'/host');
  }catch(e){setError(e instanceof Error?e.message:'Could not create your lobby.');setBusy(false);}}
  return <section className="callback-role-choice" aria-label="Choose how to play">
    <p className="session-eyebrow">ONE ROOM, EVERY GAME</p><h1>Get everyone together.</h1><p>Host on the big screen. Play on your phones.</p>
    <div className="callback-role-cards">
      <button type="button" aria-label="Host a game" aria-busy={busy} onClick={()=>void host()} disabled={busy}><span className="role-screen-icon" aria-hidden="true"><svg viewBox="0 0 40 32"><rect x="3" y="3" width="34" height="22" rx="3"/><path d="M14 29h12M20 25v4"/></svg></span><strong>{busy?'Opening your lobby…':'Host a game'}</strong><span>Start or return to your party</span></button>
      <Link href="/play" aria-label="Join a game"><span className="role-phone-icon" aria-hidden="true"><svg viewBox="0 0 40 32"><rect x="11" y="1" width="18" height="30" rx="3"/><path d="M17 5h6M18 27h4"/></svg></span><strong>Join a game</strong><span>Enter the code on the big screen</span></Link>
    </div>
    <Link className="session-choice-back" href="/mirror">Connect another display</Link>
    {error&&<p role="alert" className="form-error">{error}</p>}
  </section>;
}
