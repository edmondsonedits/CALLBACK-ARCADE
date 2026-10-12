/* ===== util: tiny math helpers shared by every module ===== */
export const TAU=Math.PI*2;
export const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
export const lerp=(a,b,t)=>a+(b-a)*t;
export const sat=v=>v<0?0:(v>1?1:v);
export const damp=(a,b,l,dt)=>a+(b-a)*(1-Math.exp(-l*dt));
export const smooth=t=>{t=sat(t);return t*t*(3-2*t)};
export const easeOutCubic=t=>1-Math.pow(1-sat(t),3);
const easeOutBack=t=>{t=sat(t);const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const easeInQuad=t=>{t=sat(t);return t*t};
export function angDiff(a,b){let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d}
export function dampAngle(a,b,l,dt){return a+angDiff(a,b)*(1-Math.exp(-l*dt))}
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/** own-property test that is safe for keys like 'constructor' / '__proto__' */
export const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
