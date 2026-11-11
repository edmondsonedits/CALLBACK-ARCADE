import { clamp, fishSeed } from "./fish-motion";

export interface FishFragment {
  u:number; v:number; width:number; height:number;
  x:number; y:number; rotation:number; scale:number; opacity:number; bevel:number;
}

/** Cosmetic, seekable paint pieces. Coordinates are in units of original fish width. */
export function sampleFishFragments(seed:string, ageMs:number):FishFragment[] {
  if(!Number.isFinite(ageMs)||ageMs<0||ageMs>=1200)return [];
  let state=fishSeed(seed);const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const age=ageMs/1000;const pieces:FishFragment[]=[];
  for(let i=0;i<36;i++){
    const angle=random()*Math.PI*2,speed=.45+random()*1.15,life=.7+random()*.45;
    const spin=(random()-.5)*9,bevel=.08+random()*.18;
    const fade=clamp(1-age/life);const drag=(1-Math.exp(-age*2.2))/2.2;
    pieces.push({u:(i%6)/6,v:Math.floor(i/6)/6,width:1/6,height:1/6,
      x:((i%6+.5)/6-.5)*.45+Math.cos(angle)*speed*drag,
      y:((Math.floor(i/6)+.5)/6-.5)*.34+Math.sin(angle)*speed*drag*.7+age*age*.32,
      rotation:spin*age,scale:.58*(.35+.65*fade),opacity:clamp(age/.065)*fade*fade,bevel});
  }
  return pieces;
}
