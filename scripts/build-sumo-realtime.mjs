import { readFile,writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
// Keep the original renderer intact. Inject a render-only compact stream bridge.
const source=await readFile('public/arcade-games/royal-sumo/online-v65.html','utf8');
const math=await transform(await readFile('lib/party-render.ts','utf8'),{loader:'ts',format:'iife',globalName:'CallbackPartyRender',target:'es2022'});
const bridge=`
${math.code}
let partyRenderFrames=[],partyRenderEvents=-1;
addEventListener('message',e=>{
 if(e.source!==parent||e.origin!==location.origin)return;
 if(e.data?.type==='callback:online-view'){partyRenderFrames=[];partyRenderEvents=-1;return}
 if(e.data?.type!=='callback:party-dynamic')return;
 const packet=e.data.snapshot,d=packet?.view?.dynamic;if(!d||!Array.isArray(d.fighterFields)||!Array.isArray(d.fighters))return;
 d.fighters=d.fighters.map((values,id)=>Object.assign({id},Object.fromEntries(d.fighterFields.map((key,i)=>[key,values[i]]))));
 partyRenderFrames.push({value:packet,at:performance.now()});partyRenderFrames=partyRenderFrames.slice(-4);
});
function paintPartyStream(now){
 if(!onlineView||!sim||!partyRenderFrames.length)return;
 const list=partyRenderFrames,last=list[list.length-1],target=now-33;let left=list[0],right=last;
 for(let i=1;i<list.length;i++){if(list[i].at>=target){left=list[i-1];right=list[i];break}left=list[i]}
 const d=right.value.view.dynamic,t=d.paused?1:Math.min(1,(target-left.at)/Math.max(1,right.at-left.at));
 const fighters=CallbackPartyRender.interpolatePartyFighters(left.value.view.dynamic.fighters,d.fighters,t,d.paused?0:Math.max(0,target-right.at));
 for(let i=0;i<fighters.length;i++)Object.assign(sim.fighters[i],fighters[i]);
 sim.t=d.simTime;sim.round=d.round;sim.phase=d.simPhase;sim.phaseT=d.phaseT;sim.crowns=d.crowns;sim.winner=d.winner;sim.matchWinner=d.matchWinner;
 if(d.arena)mergeOnlineArena(sim.arena,d.arena);
 onlineSnapshot={...onlineSnapshot,finished:right.value.finished,winners:right.value.winners,scores:right.value.scores,view:{...onlineSnapshot.view,hazard:d.hazard,cup:d.cup,ranking:d.ranking}};
 if(right.value.view.tick!==partyRenderEvents){partyRenderEvents=right.value.view.tick;for(const event of d.events||[])route(event)}
 fillView();
}
`;
if(!source.includes('function frame(ts){'))throw new Error('Pinned Sumo renderer frame boundary changed');
const result=source.replace('function frame(ts){',bridge+'\nfunction frame(ts){\n  paintPartyStream(ts);');
await writeFile('public/arcade-games/royal-sumo/realtime-pilot.html',result);
