import {emptyWorkshop,type SorceryWorkshop,type WorkshopAction,type WorkshopSnapshot} from '../../lib/sorcery-workshop';
import {SKETCH_PROMPT_CATALOGUE} from '../../lib/content/sketch-prompts';
import {deterministicShuffle,randomUuid} from '../../lib/game/random';
import type {SketchRelayMatch} from '../arcade/sketch_relay';
export function workshop(m:SketchRelayMatch):SorceryWorkshop {return m.showdown!.workshop??=emptyWorkshop();}
export function workshopAvailable(m:SketchRelayMatch,actor:string){return m.showdown?.version===4 && m.players.includes(actor)&&!m.botIds.includes(actor)&&(['transforming'].includes(m.phase)||m.phase==='drawing'&&m.chains.some(c=>c.round===m.round&&c.originalPlayerId===actor&&c.drawing)||m.phase==='round-results'&&workshop(m).intermissionRound===m.round);}
export function workshopPoints(m:SketchRelayMatch,actor:string){return (m.showdown?.workshop?.ballots??[]).filter(b=>b.actor===actor&&b.acceptedAt!==undefined).reduce((n,b)=>n+b.reward,0);}
export function hallWinners(m:SketchRelayMatch,round=m.round){
 const votes=(m.showdown?.workshop?.nominations??[]).filter(v=>v.round===round&&v.entry);const counts=new Map<string,number>();for(const v of votes)counts.set(v.entry!,1+(counts.get(v.entry!)??0));const best=Math.max(0,...counts.values());return [...counts].filter(([,n])=>n===best&&n>0).map(([id])=>id);
}
export function beginWorkshopClose(m:SketchRelayMatch,now:number){
 const w=workshop(m);if(w.closedRound===m.round)return false;w.closedRound=m.round;
 if(w.leases.some(l=>l.until>now)){w.closeUntil=now+10000;m.deadline=now+10000;return true;}w.closeUntil=null;return false;
}
export function applyWorkshop(m:SketchRelayMatch,actor:string,owner:string,a:WorkshopAction,now:number){
 if(now>=m.deadline)throw new Error('WORKSHOP_CLOSED');
 if(m.showdown?.version!==4||a.matchId!==m.matchId||a.round!==m.round||!workshopAvailable(m,actor))throw new Error('WORKSHOP_CLOSED');
 const w=workshop(m);
 if(a.type==='lease'){
  if(m.phase!=='drawing'||w.closedRound===m.round)throw new Error('EDITOR_CLOSED');
  w.leases=w.leases.filter(l=>l.actor!==actor&&l.until>now);w.leases.push({actor,until:now+15000});
 }else if(a.type==='leave'){w.leases=w.leases.filter(l=>l.actor!==actor);if(w.closeUntil&&!w.leases.some(l=>l.until>now))w.closeUntil=now;}
 else if(a.type==='issue'){
  const active=w.ballots.find(b=>b.actor===actor&&b.acceptedAt===undefined&&b.expiresAt>now);if(active)return;
  if(w.ballots.filter(b=>b.actor===actor).length>=6)throw new Error('FEEDBACK_LIMIT');
  if(w.ballots.some(b=>b.owner===owner&&b.actor!==actor))throw new Error('PROFILE_ALREADY_SEATED');
  const seen=new Set(w.ballots.filter(b=>b.owner===owner).flatMap(b=>b.options));
  const current=new Set(m.showdown.selectedPrompts);
  const pool=SKETCH_PROMPT_CATALOGUE.filter(p=>!seen.has(p.id)&&!current.has(p.text));
  const options=deterministicShuffle(pool,`${m.matchId}:${owner}:${w.ballots.length}`).slice(0,3).map(p=>p.id);if(options.length!==3)throw new Error('NO_PROMPTS');
  w.ballots.push({id:randomUuid(),actor,owner,round:m.round,options,optionTexts:options.map(id=>SKETCH_PROMPT_CATALOGUE.find(p=>p.id===id)!.text),issuedAt:now,notBefore:now+10000,expiresAt:now+90000,reward:0});
 }else if(a.type==='choose'){
  const b=w.ballots.find(b=>b.id===a.ballotId&&b.actor===actor&&b.owner===owner);if(!b)throw new Error('INVALID_BALLOT');
  if(b.acceptedAt!==undefined){if(b.choice===a.choice)return;throw new Error('BALLOT_LOCKED');}
  if(now<b.notBefore||now>=b.expiresAt||a.choice===undefined||a.choice!==null&&!b.options.includes(a.choice))throw new Error('BALLOT_NOT_READY');
  b.choice=a.choice;b.acceptedAt=now;b.reward=a.choice!==null&&workshopPoints(m,actor)<50?25:0;
 }else if(a.type==='nominate'){
  if(m.phase!=='round-results'||w.intermissionRound!==m.round)throw new Error('HALL_CLOSED');
  if(w.nominations.some(v=>v.actor===actor&&v.round===m.round))throw new Error('NOMINATION_LOCKED');
  if(a.choice===undefined||a.choice!==null&&!m.chains.some(c=>c.chainId===a.choice&&c.round===m.round&&c.drawing&&!c.drawing.practice&&c.drawing.assetId&&c.drawing.source&&!m.botIds.includes(c.originalPlayerId)&&c.originalPlayerId!==actor))throw new Error('INVALID_NOMINATION');
  w.nominations.push({actor,round:m.round,entry:a.choice});
 }else if(a.type==='reaction'){
  if(!a.reaction||w.reactions.filter(r=>r.actor===actor&&r.round===m.round).length>=2||w.reactions.some(r=>r.actor===actor&&now-r.at<20000)||w.reactions.some(r=>now-r.at<5000))throw new Error('REACTION_COOLDOWN');
  w.reactions.push({actor,round:m.round,at:now,kind:a.reaction,narrate:!w.reactions.some(r=>r.narrate&&now-r.at<20000)});
 }
}
export function workshopSnapshot(m:SketchRelayMatch,actor:string,now:number):WorkshopSnapshot|undefined{
 if(m.showdown?.version!==4)return;const w=workshop(m);const b=w.ballots.find(b=>b.actor===actor&&b.acceptedAt===undefined&&b.expiresAt>now);const r=w.reactions.at(-1);
 return {available:workshopAvailable(m,actor),editingAllowed:m.phase==='drawing'&&workshopAvailable(m,actor)&&(w.closedRound!==m.round||Boolean(w.closeUntil&&now<w.closeUntil)),closeUntil:w.closeUntil,intermission:m.phase==='round-results'&&w.intermissionRound===m.round,earned:workshopPoints(m,actor),...(b?{ballot:{id:b.id,options:b.options.map((id,index)=>({id,text:b.optionTexts?.[index]??SKETCH_PROMPT_CATALOGUE.find(p=>p.id===id)?.text??"An archived prompt"})),notBefore:b.notBefore,expiresAt:b.expiresAt}}:{}),nominated:w.nominations.some(v=>v.round===m.round&&v.actor===actor),hallWinners:['halfway','complete'].includes(m.phase)?hallWinners(m):[],...(r&&now-r.at<3500?{reaction:{kind:r.kind,at:r.at,narrate:r.narrate}}:{})};
}
