import {Vector3,Quaternion} from './imported-math.mjs';
/** Preserve Sets and math values across D1 JSON. Renderers receive decoded views. */
export function encode(v){
 if(v instanceof Set)return {$set:[...v].map(encode)};
 if(v instanceof Vector3)return {$v3:[v.x,v.y,v.z]};
 if(v instanceof Quaternion)return {$quat:[v.x,v.y,v.z,v.w]};
 if(Array.isArray(v))return v.map(encode);
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]));
 return Number.isFinite(v)||typeof v!=='number'?v:null;
}
export function decode(v){
 if(v&&typeof v==='object'){
  if(v.$set)return new Set(v.$set.map(decode));
  if(v.$v3)return new Vector3(...v.$v3);
  if(v.$quat)return new Quaternion(...v.$quat);
  if(Array.isArray(v))return v.map(decode);
  return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)]));
 }return v;
}
