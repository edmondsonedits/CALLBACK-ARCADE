"use client";
import {useEffect,useRef,useState} from 'react';
import type {SnapshotSketchRelay} from '../../../lib/arcade/sketch-relay';
import type {WorkshopSnapshot} from '../../../lib/sorcery-workshop';
import {FishEditor} from '../fish/FishEditor';
import {FullscreenDialog} from '../FullscreenDialog';
import {emptyFishDocument} from '../../../lib/fish-art';
import styles from './Workshop.module.css';
import {SceneryWorkshop} from './SceneryWorkshop';
import {PocketPairs} from './PocketPairs';
import {ShowdownArt} from '../sketch-relay/SketchShowdownStage';
type Props={code:string;game:SnapshotSketchRelay;paused:boolean;serverTime:number};
export function WorkshopMenu({code,game,paused,serverTime}:Props){
 const profileReady=useRef<Promise<Response>|null>(null);
 const remote=game.showdown?.workshop;const [data,setData]=useState<{from:typeof remote;value:WorkshopSnapshot}|null>(null);const [activity,setActivity]=useState('menu');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [selection,setSelection]=useState<string|null>(null);const [now,setNow]=useState(serverTime);
 useEffect(()=>{const start=Date.now();const timer=setInterval(()=>setNow(serverTime+Date.now()-start),250);return()=>clearInterval(timer);},[serverTime]);
 useEffect(()=>{profileReady.current??=fetch('/api/profile',{cache:'no-store'});},[]);
 const ws=data&&data.from===remote?data.value:remote;const enabled=Boolean(remote?.available)&&!paused;
 async function action(type:string,extra:object={}){
  if(busy||!enabled)return;setBusy(true);setError('');
  try{const profile=await(profileReady.current??=fetch('/api/profile',{cache:'no-store'}));if(!profile.ok)throw new Error('Your saved profile could not be loaded. Try again.');const response=await fetch(`/api/rooms/${code}/workshop`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({actionId:crypto.randomUUID(),matchId:game.matchId,round:game.round,type,...extra})});const result=await response.json() as {workshop?:WorkshopSnapshot;error?:{message?:string}};if(!response.ok)throw new Error(result.error?.message??'Please try again.');if(result.workshop)setData({from:remote,value:result.workshop});}
  catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}
 }
 if(!remote?.available)return null;
 const cards=[['scenery','Add to our aquarium','Create, place or edit your saved scenery.'],['prompts','Choose a favourite prompt',`${ws?.earned??0}/50 workshop points earned · 25 per choice`],['practice','Practice drawing','A private canvas to try your tools.'],['pairs','Pocket pairs','Find three pairs. Personal best only.'],['reactions','Cast a reaction','A little magic on the shared screen.']];
 const blank=emptyFishDocument();blank.template='blank';
 return <section className={styles.workshop} aria-label="Sorcery workshop">
 <div className={styles.heading}><h2>{ws?.intermission?'Hall & workshop break':'Your sketch is sealed. Make yourself useful.'}</h2><span>{ws?.earned??0}/50 bonus points</span></div>
 {remote.closeUntil&&now<remote.closeUntil&&<p role="status">Workshop artists: {Math.max(0,Math.ceil((remote.closeUntil-now)/1000))} seconds to finish. Your draft will be saved.</p>}
 {activity!=='menu'&&<button className={styles.back} onClick={()=>{setActivity('menu');void action('leave');}}>← Workshop menu</button>}
 {activity==='menu'&&<div className={styles.cards}>{cards.map(([id,title,detail])=><button key={id} disabled={!enabled||id==='scenery'&&!remote.editingAllowed} onClick={()=>{setActivity(id);if(id==='prompts')void action('issue');}}><strong>{title}</strong><span>{detail}</span></button>)}</div>}
 {activity==='prompts'&&<div className={styles.options}><p>Which would you most like to draw? Pick one, wait ten seconds, then confirm. Two rewarded choices per match; further choices are feedback only.</p>{ws?.ballot?<><div className={styles.cards}>{ws.ballot.options.map(p=><button key={p.id} aria-pressed={selection===p.id} disabled={!enabled} onClick={()=>setSelection(p.id)}>{p.text}</button>)}</div><button disabled={!enabled||busy||!selection||now<ws.ballot.notBefore} onClick={()=>void action('choose',{ballotId:ws.ballot!.id,choice:selection}).then(()=>setSelection(null))}>{now<ws.ballot.notBefore?`Confirm in ${Math.ceil((ws.ballot.notBefore-now)/1000)}s`:'Confirm favourite'}</button><button disabled={!enabled||busy||now<ws.ballot.notBefore} onClick={()=>void action('choose',{ballotId:ws.ballot!.id,choice:null})}>None appeal · skip</button></>:<button disabled={!enabled||busy} onClick={()=>void action('issue')}>Show three more prompts</button>}</div>}
 {activity==='practice'&&<FullscreenDialog open title="Practice drawing" onClose={()=>setActivity('menu')} paginate={false}><div className={styles.editorWorkspace}><FishEditor draftKey={`workshop-practice:${game.matchId}`} deadline={game.deadline} serverTime={serverTime} paused={paused} initialDocument={blank} draftMode title="Practice your magic" onSubmit={async()=>{setActivity('menu');}} /></div></FullscreenDialog>}
 {activity==='scenery'&&<SceneryWorkshop code={code} matchId={game.matchId} deadline={Math.min(game.deadline,remote.closeUntil??Infinity)} serverTime={serverTime} paused={paused||!remote.editingAllowed} onLease={()=>action('lease')} onLeave={()=>action('leave')}/ >}
 {activity==='pairs'&&<PocketPairs paused={!enabled} matchId={game.matchId} round={game.round}/ >}
 {activity==='reactions'&&<div className={styles.cards}>{[['sparkles','✦ Sparkles'],['applause','👏 Tiny applause'],['ink','✒ Wobbling ink']].map(([kind,label])=><button key={kind} disabled={!enabled||busy} onClick={()=>void action('reaction',{reaction:kind})}>{label}</button>)}<p>Two reactions per round, with a cooldown. The room’s instructions always come first.</p></div>}
 {ws?.intermission&&<div className={styles.hall}><h3>Which one made you laugh the most?</h3><p>Nominate one for the Edmondson Hall of Questionable Art. This award does not change scores. Public sharing follows its artist’s permission.</p>{ws.nominated?<p role="status">Your nomination is sealed.</p>:<div className={styles.cards}>{game.showdown!.revealedEntries.filter(e=>e.round===game.round&&!e.practice&&e.originalAssetId&&e.entryId!==game.showdown!.ownEntryId).map(e=><button disabled={!enabled||busy} key={e.entryId} onClick={()=>void action('nominate',{choice:e.entryId})}><ShowdownArt entry={e} code={code}/><span>Nominate drawing {e.letter}</span></button>)}<button disabled={!enabled||busy} onClick={()=>void action('nominate',{choice:null})}>Abstain</button></div>}</div>}
 {error&&<p role="alert">{error}</p>}
 </section>;
}
