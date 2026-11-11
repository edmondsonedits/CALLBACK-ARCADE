'use client';
/* Decoded local blob URLs deliberately bypass image transformations. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicSketchWinner } from '../../server/sketch-showcase';
import './WinnersShowcase.css';

type Pair = { entry: PublicSketchWinner; original: string; transformed: string };
type Phase = 'original' | 'fade' | 'transformed';
function dispose(pair: Pair | null) { if(pair){URL.revokeObjectURL(pair.original);URL.revokeObjectURL(pair.transformed);} }
async function loadPair(entry:PublicSketchWinner,signal:AbortSignal):Promise<Pair>{
  const urls:string[]=[];
  try{
    const images=await Promise.allSettled([entry.originalUrl,entry.transformedUrl].map(async url=>{
      const response=await fetch(url,{cache:'no-store',signal});if(!response.ok)throw new Error('Artwork unavailable');
      const blob=await response.blob();if(!['image/png','image/webp','image/jpeg'].includes(blob.type)||blob.size>16*1024*1024)throw new Error('Artwork unavailable');
      const src=URL.createObjectURL(blob);urls.push(src);const image=new Image();image.src=src;await image.decode();if(signal.aborted)throw new Error('Cancelled');return src;
    }));
    if(images.some(v=>v.status==='rejected')||signal.aborted)throw new Error('Artwork unavailable');
    return {entry,original:(images[0] as PromiseFulfilledResult<string>).value,transformed:(images[1] as PromiseFulfilledResult<string>).value};
  }catch(error){for(const url of urls)URL.revokeObjectURL(url);throw error;}
}
function ArtworkPair({pair,paused,reducedMotion,onNext}:{pair:Pair;paused:boolean;reducedMotion:boolean;onNext:()=>void}){
  const [phase,setPhase]=useState<Phase>('original');
  const remaining=useRef(2000);
  useEffect(()=>{
    if(paused||reducedMotion)return;
    const started=performance.now();let completed=false;const timer=window.setTimeout(()=>{
      completed=true;
      if(phase==='original'){remaining.current=2000;setPhase('fade');}
      else if(phase==='fade'){remaining.current=4000;setPhase('transformed');}
      else onNext();
    },remaining.current);
    return ()=>{window.clearTimeout(timer);if(!completed)remaining.current=Math.max(0,remaining.current-(performance.now()-started));};
  },[phase,paused,reducedMotion,onNext]);
  return <>
    <div className={`winners-art ${reducedMotion?'winners-comparison':''}`} data-showcase-phase={reducedMotion?'comparison':phase}>
      <figure><img src={pair.original} alt={`Original winning drawing by ${pair.entry.artistName}`} width="512" height="512"/><figcaption>Original drawing</figcaption></figure>
      <figure className={reducedMotion?'':'winners-transformation'} style={reducedMotion?undefined:{animationPlayState:paused?'paused':'running'}}><img src={pair.transformed} alt={`Transformed artwork from ${pair.entry.artistName}’s drawing`} width="1024" height="1024"/><figcaption>{pair.entry.magicUnavailable?"Original artwork · magic unavailable":"Transformed artwork"}</figcaption></figure>
    </div>
    <div className="winners-attribution"><span>Drawn by <strong>{pair.entry.artistName}</strong></span><span>Round {pair.entry.round} {pair.entry.awardKind==='hall'?'Hall nominee':pair.entry.tiedCount>1?'joint winner':'winner'}</span></div>
    {!reducedMotion&&<p className="winners-state">{phase==='original'?'Original drawing':phase==='fade'?'A little sorcery…':'Transformed artwork'}</p>}
  </>;
}
function validEntry(value:unknown):value is PublicSketchWinner{
  if(!value||typeof value!=='object')return false;const e=value as PublicSketchWinner;
  return /^skw_[a-f0-9]{64}$/u.test(e.id)&&typeof e.artistName==='string'&&e.artistName.length<=100&&Number.isInteger(e.round)&&e.round>=1&&e.round<=3&&e.originalUrl===`/api/showcase/sketch-winners/${e.id}/original`&&e.transformedUrl===`/api/showcase/sketch-winners/${e.id}/transformed`;
}
export function WinnersShowcase({reducedMotion=false,legacy=false,blocked=false}:{reducedMotion?:boolean;legacy?:boolean;blocked?:boolean}){
  const [entries,setEntries]=useState<PublicSketchWinner[]>([]),[target,setTarget]=useState<string|null>(null),[pair,setPair]=useState<Pair|null>(null),[cycle,setCycle]=useState(0),[paused,setPaused]=useState(false),[hidden,setHidden]=useState(false);
  const failed=useRef(new Set<string>()),entriesRef=useRef(entries),targetRef=useRef(target),offsetRef=useRef(0),nextOffsetRef=useRef<number|null>(null),feedRequest=useRef<AbortController|null>(null);
  useEffect(()=>{entriesRef.current=entries;targetRef.current=target;},[entries,target]);
  const fetchFeed=useCallback(async(offset=0,retryFailed=false)=>{
    feedRequest.current?.abort();const abort=new AbortController();feedRequest.current=abort;
    try{const response=await fetch(`/api/showcase/sketch-winners${offset?`?offset=${offset}`:''}`,{cache:'no-store',signal:abort.signal});if(!response.ok)return;const data=await response.json() as {entries?:unknown[];nextOffset?:number|null};if(abort.signal.aborted)return;
      const fresh=(Array.isArray(data.entries)?data.entries:[]).filter(validEntry).slice(0,24);
      // Retry transient image failures only on a successful scheduled/visibility refresh.
      // Pagination keeps its failure set so a broken pool cannot immediately loop.
      if(retryFailed)failed.current.clear();
      offsetRef.current=offset;nextOffsetRef.current=typeof data.nextOffset==='number'?data.nextOffset:null;setEntries(fresh);
      setPair(current=>current&&fresh.some(e=>e.id===current.entry.id)?current:null);
      setTarget(current=>fresh.some(e=>e.id===current&&!failed.current.has(e.id))?current:fresh.find(e=>!failed.current.has(e.id))?.id??null);
    }catch{/* Navigation stays available when the gallery feed is offline. */}
  },[]);
  useEffect(()=>{
    window.queueMicrotask(()=>void fetchFeed(0,true));const refresh=window.setInterval(()=>{if(!document.hidden)void fetchFeed(offsetRef.current,true);},60_000);
    const visibility=()=>{setHidden(document.hidden);if(!document.hidden)void fetchFeed(offsetRef.current,true);};document.addEventListener('visibilitychange',visibility);
    return()=>{window.clearInterval(refresh);document.removeEventListener('visibilitychange',visibility);feedRequest.current?.abort();};
  },[fetchFeed]);
  const move=useCallback((direction:number)=>{
    const list=entriesRef.current.filter(e=>!failed.current.has(e.id));const index=list.findIndex(e=>e.id===targetRef.current);
    if(direction>0&&index===list.length-1&&nextOffsetRef.current!==null){void fetchFeed(nextOffsetRef.current);return;}
    if(direction>0&&index===list.length-1&&offsetRef.current>0){void fetchFeed(0);return;}
    const next=list.length?list[(Math.max(index,0)+direction+list.length)%list.length]:null;
    if(next){const same=next.id===targetRef.current;targetRef.current=next.id;setTarget(next.id);if(same)setCycle(n=>n+1);}else{setTarget(null);setPair(null);}
  },[fetchFeed]);
  const advance=useCallback(()=>move(1),[move]);
  useEffect(()=>{
    const entry=entries.find(e=>e.id===target);if(!entry||pair?.entry.id===entry.id)return;
    const abort=new AbortController();let loaded:Pair|null=null,retained=false;
    const timeout=window.setTimeout(()=>{failed.current.add(entry.id);move(1);abort.abort();},10_000);
    void loadPair(entry,abort.signal).then(value=>{window.clearTimeout(timeout);loaded=value;if(!abort.signal.aborted){retained=true;setPair(value);setCycle(n=>n+1);}}).catch(()=>{window.clearTimeout(timeout);if(!abort.signal.aborted){failed.current.add(entry.id);move(1);}});
    return()=>{window.clearTimeout(timeout);abort.abort();if(!retained)dispose(loaded);};
  },[entries,target,pair?.entry.id,move]);
  useEffect(()=>()=>dispose(pair),[pair]);
  return <section className={`winners-showcase ${legacy?'winners-showcase-legacy':''}`} aria-label="Sketch & Sorcery winning artwork">
    <header><span aria-hidden="true">✦</span><div><h2>Edmondson Hall of Questionable Art</h2><p>Room-nominated favourites and past score winners</p></div></header>
    {pair?<div className="winners-pair" key={`${pair.entry.id}:${cycle}`}><ArtworkPair pair={pair} paused={paused||hidden||blocked} reducedMotion={reducedMotion} onNext={advance}/></div>:<div className="winners-empty"><span aria-hidden="true">✧</span><p>Your next masterpiece could be here.</p><small>Real winning drawings, shared by their artists.</small></div>}
    {pair&&<div className="winners-controls"><button type="button" onClick={()=>move(-1)} aria-label="Previous winning artwork">←</button>{!reducedMotion&&<button type="button" onClick={()=>setPaused(v=>!v)} aria-pressed={paused}>{paused?'Play':'Pause'}</button>}<button type="button" onClick={()=>move(1)} aria-label="Next winning artwork">→</button></div>}
  </section>;
}
