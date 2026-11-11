import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import vm from 'node:vm';
export interface Node {type:unknown;props:Record<string,unknown>}
export function controlComponent(file:string,imports:Record<string,unknown>,expose:string[]=[]){
 const timers=new Map<number,()=>void>();let timerId=0;const hooks:unknown[]=[];let cursor=0;const effects:(()=>void|(()=>void))[]=[],cleanups:(()=>void)[]=[];
 const doc=Object.assign(new EventTarget(),{visibilityState:'visible',hidden:false,querySelector:()=>null}),win=new EventTarget();
 const react={useRef:(value:unknown)=>{const i=cursor++;return hooks[i]??(hooks[i]={current:value});},useState:(value:unknown)=>{const i=cursor++;if(!(i in hooks))hooks[i]=value;return [hooks[i],(next:unknown)=>{hooks[i]=typeof next==='function'?(next as (v:unknown)=>unknown)(hooks[i]):next}]},useCallback:(fn:unknown)=>{cursor++;return fn;},useEffect:(fn:()=>void|(()=>void))=>{const i=cursor++;if(!(i in hooks)){hooks[i]=true;effects.push(fn)}}};
 const jsx=(type:unknown,props:Record<string,unknown>):Node=>({type,props});const compiledModule={exports:{} as Record<string,unknown>};
 const code=transformSync(readFileSync(file,'utf8'),{loader:'tsx',format:'cjs',jsx:'automatic'}).code;
 const context={module:compiledModule,exports:compiledModule.exports,document:doc,window:win,HTMLInputElement:class{},HTMLElement:class{},setInterval:()=>1,clearInterval(){},setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout(id:number){timers.delete(id)},require:(id:string)=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:imports[id]};
 vm.runInNewContext(code+'\n'+expose.map(name=>'module.exports.'+name+'='+name+';').join('\n'),context,{filename:file});
 return {document:doc,window:win,runTimers(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();},element(){return Object.assign(new context.HTMLElement(),{closest:()=>({})});},render(props:unknown,name='default'){cursor=0;const tree=(compiledModule.exports[name] as (p:unknown)=>Node)(props);for(const fn of effects.splice(0)){const cleanup=fn();if(cleanup)cleanups.push(cleanup)}return tree;},dispose(){for(const f of cleanups)f();}};
}
export function nodes(tree:unknown):Node[]{if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(nodes);const n=tree as Node;return n.props?[n,...nodes(n.props.children)]:[];}
export function touchTarget(){const captured=new Set<number>();return {style:{transform:'',setProperty(){}},dataset:{} as Record<string,string>,setPointerCapture(id:number){captured.add(id)},hasPointerCapture:(id:number)=>captured.has(id),releasePointerCapture(id:number){captured.delete(id)},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};}
export function pointer(id:number,target=touchTarget(),x=90,y=50){return {pointerId:id,currentTarget:target,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}};}
