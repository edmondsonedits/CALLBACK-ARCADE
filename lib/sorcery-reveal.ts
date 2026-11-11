export function sorceryReveal(elapsedMs:number,reducedMotion=false){
 const t=Math.max(0,elapsedMs);
 const opacity=reducedMotion?1:t<600?0:t<1800?(t-600)/2400:t<2500?.5:t<3500?.5+(t-2500)/2000:1;
 const split=reducedMotion?1:Math.max(0,Math.min(1,(t-3500)/1200));
 return {opacity,split};
}
