/* ============================================================================
   ROYAL SUMO - CROWN CUP + RANKING  (pure scoring rules, no DOM, fully unit-tested)
   Crown Cup: one match on each arena in turn. An arena win is worth 3 points and every knockout adds 1.
   Final standings sort by  points, then arena wins, then knockouts.  Fighters level on all three SHARE a rank
   (competition ranking 1,1,3) - nobody is silently promoted because of their seat number.
   ========================================================================== */
export const CUP_POINTS=Object.freeze({win:3,ko:1});
const zeros=n=>new Array(n).fill(0);

/** Cup arena order: all arenas, starting from the one the player picked. */
export function cupOrder(start,all){
  const s=Math.max(0,all.indexOf(start));
  return all.map((_,i)=>all[(s+i)%all.length]);
}
export function newCup({order,n,players=1,base=null,seed=null}){
  return {order:order.slice(),stage:0,n,players,base,seed,total:zeros(n),wins:zeros(n),kos:zeros(n),gain:zeros(n),counted:-1,history:[]};
}
export const isFinalStage=cup=>cup.stage>=cup.order.length-1;
/** Add one finished arena to the tally. Safe to call twice for the same stage (it only counts once).
 *  res = {winner:int (-1 draw), stats:[{kos}], n} */
export function scoreStage(cup,res){
  if(cup.counted===cup.stage)return cup.gain.slice();
  const gain=zeros(cup.n);
  for(let i=0;i<cup.n;i++){
    const kos=((res.stats&&res.stats[i]&&res.stats[i].kos)|0);
    gain[i]=(res.winner===i?CUP_POINTS.win:0)+kos*CUP_POINTS.ko;
    cup.total[i]+=gain[i];cup.kos[i]+=kos;if(res.winner===i)cup.wins[i]++;
  }
  cup.gain=gain;cup.counted=cup.stage;
  cup.history.push({stage:cup.stage,map:cup.order[cup.stage],winner:res.winner,gain:gain.slice()});
  return gain.slice();
}
/** Sort ids by key lists (higher is better) and assign shared ranks. keys(i) -> array of numbers. */
export function rankBy(n,keys){
  const rows=[];for(let i=0;i<n;i++)rows.push({id:i,k:keys(i)});
  const cmp=(a,b)=>{for(let j=0;j<a.k.length;j++)if(a.k[j]!==b.k[j])return b.k[j]-a.k[j];return 0};
  rows.sort((a,b)=>cmp(a,b)||a.id-b.id);
  let rank=1;
  rows.forEach((r,idx)=>{if(idx>0&&cmp(rows[idx-1],r)!==0)rank=idx+1;r.rank=rank});
  rows.forEach(r=>{r.tied=rows.some(o=>o!==r&&o.rank===r.rank)});
  return rows;
}
/** Cup table, best first: [{id,points,wins,kos,gain,rank,tied}] */
export function standings(cup){
  return rankBy(cup.n,i=>[cup.total[i],cup.wins[i],cup.kos[i]]).map(r=>({id:r.id,points:cup.total[r.id],wins:cup.wins[r.id],kos:cup.kos[r.id],gain:cup.gain[r.id]|0,rank:r.rank,tied:r.tied}));
}
export const champions=cup=>standings(cup).filter(r=>r.rank===1).map(r=>r.id);

/** Order for a single match (quick match or one cup arena): the winner first, then crowns, then knockouts.
 *  res = {n, winner, crowns:[...], stats:[{kos}]}  ->  [{id,crowns,kos,rank,tied}] */
export function rankMatch(res){
  const n=res.n,cr=i=>(res.crowns&&res.crowns[i])|0,ko=i=>((res.stats&&res.stats[i]&&res.stats[i].kos)|0);
  return rankBy(n,i=>[res.winner===i?1:0,cr(i),ko(i)]).map(r=>({id:r.id,crowns:cr(r.id),kos:ko(r.id),rank:r.rank,tied:r.tied}));
}
