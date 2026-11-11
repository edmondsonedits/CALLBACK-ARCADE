import vm from 'node:vm';
import {readFileSync} from 'node:fs';
export function game(){
 const html=readFileSync(new URL('../../public/arcade-games/royal-sumo/index.html',import.meta.url),'utf8');
 const noop=()=>{},doc={readyState:'loading',addEventListener:noop,getElementById:()=>null,querySelector:()=>null};
 const c=vm.createContext({document:doc,console,location:{search:''},URLSearchParams,performance:{now:()=>1000},localStorage:{getItem:()=>null,setItem:noop,removeItem:noop},navigator:{},matchMedia:()=>({matches:false}),setTimeout:noop,addEventListener:noop});c.window=c;
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],c);
 return {c,sim:()=>c.RoyalSumo.debug.sim(),step:(n=1)=>c.RoyalSumo.debug.advance(n/120)};
}
