/* ============================================================================
   ROYAL SUMO - SEEDS  (every random number in a match descends from one unsigned 32-bit seed)
   Sources, strongest first:  API call (scenario / restart / setSeed)  >  URL ?seed=  >  fresh random.
   A fixed seed plays its first match exactly as given; later matches in the same session derive from it, so a
   rematch is different but the whole sequence is still reproducible.
   ========================================================================== */
const imul=Math.imul;
/** murmur3-style finaliser: scrambles one 32-bit word */
export function mix32(h){h^=h>>>16;h=imul(h,0x85ebca6b);h^=h>>>13;h=imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0}
/** FNV-1a over a string -> uint32 (so a seed may be any word: ?seed=sunrise) */
export function hashStr32(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=imul(h,0x01000193)}return h>>>0}
/** Parse anything a caller might hand us. Returns a uint32, or null for "no seed". */
export function parseSeed(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='number'){if(!isFinite(v))return null;return (Math.trunc(v)>>>0)}
  if(typeof v==='boolean')return null;
  const s=String(v).trim();if(!s)return null;
  if(/^[+-]?\d+$/.test(s)){const n=Number(s);return isFinite(n)?(Math.trunc(n)>>>0):hashStr32(s)}
  if(/^0x[0-9a-f]+$/i.test(s))return (parseInt(s,16)>>>0);
  return hashStr32(s);
}
/** Child seed: deterministic function of (base, indices...). deriveSeed(b,0) !== b on purpose. */
export function deriveSeed(base,...idx){let h=mix32((base>>>0)^0x9e3779b9);for(const i of idx)h=mix32(h^imul((i|0)+0x7f4a7c15,0x85ebca6b));return h>>>0}
/** Fresh random seed from an injectable uniform source (tests pass a stub). */
export function randomSeed(rand=Math.random){return (rand()*4294967296)>>>0}
