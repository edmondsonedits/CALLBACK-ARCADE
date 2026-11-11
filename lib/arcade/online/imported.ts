import type { OnlineEngine, OnlineInput } from './types';
import { runtime as space } from './imported-space.mjs';
import { runtime as twisted } from './imported-twisted.mjs';
import { runtime as roller } from './imported-roller.mjs';
import { runtime as scratch } from './imported-scratch.mjs';
import { runtime as ball } from './imported-ball.mjs';
type Saved={ids:string[];seed:number;options:Record<string,unknown>};
type Factory=typeof space;
function publicJSON(value:unknown):unknown {
 if(value instanceof Set)return [...value].map(publicJSON);
 if(Array.isArray(value))return value.map(publicJSON);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,publicJSON(item)]));
 return value;
}
function engine(id:string,title:string,run:Factory,controls:OnlineEngine['controls']):OnlineEngine {
 return {id,title,controls,
  create(ids,seed,options,botIds){return run(ids,seed,options,botIds).save();},
  step(saved,inputs:Record<string,OnlineInput>,botIds){const s=saved as Saved;const r=run(s.ids,s.seed,s.options,botIds,saved,inputs as unknown as Record<string,unknown>);if(r.result().finished)return saved;r.tick();return r.save();},
  publicState(saved){const s=saved as Saved;const r=run(s.ids,s.seed,s.options,[],saved).result();const view=publicJSON(r.view);if(id==='scratch-match'&&view&&typeof view==='object'&&!Array.isArray(view)){const safe={...(view as Record<string,unknown>)};delete safe.configuredSeed;delete safe.randomState;return {view:safe,finished:r.finished,winners:r.winnerSlots.map(i=>s.ids[i]),scores:Object.fromEntries(s.ids.map((seat,i)=>[seat,r.slotScores[i]??0]))}}return {view,finished:r.finished,winners:r.winnerSlots.map(i=>s.ids[i]),scores:Object.fromEntries(s.ids.map((seat,i)=>[seat,r.slotScores[i]??0]))};}
 };
}
/** Each adapter completes one native round/race. The room server owns cup progression. */
export const IMPORTED_ONLINE_ENGINES:readonly OnlineEngine[]=[
 engine('space-bash','Space Bash',space,[{action:'move',label:'Move around the deck',hold:true},{action:'grab',label:'Grab / Throw'},{action:'kick',label:'Kick'},{action:'jump',label:'Jump'}]),
 engine('twisted-system','Twisted System',twisted,[{action:'jump',label:'Jump cyan rods'},{action:'duck',label:'Hold duck for coral rods',hold:true}]),
 engine('roller-ruckus','Roller Ruckus',roller,[{action:'move',label:'Roll / steer · reverse to brake',hold:true}]),
 engine('scratch-match','Scratch Match',scratch,[{action:'lane',label:'A · pink rune',lane:0},{action:'lane',label:'B · yellow rune',lane:1},{action:'lane',label:'X · blue rune',lane:2},{action:'lane',label:'Y · orange rune',lane:3}]),
 engine('sky-balls','Sky Balls',ball,[{action:'move',label:'Move along your gate',hold:true},{action:'magnet',label:'Hold Magnet · release to fire',hold:true},{action:'pulse',label:'Pulse counter'}]),
];
