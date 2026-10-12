// Zero-dependency ES-module bundler: src/**/*.js (import/export) -> one self-contained script.
//   * every module becomes a function scope, so names never collide and the sources are real ES modules
//   * imports are static and named only; `export default`, `export *`, `export let` and dynamic import() are rejected
//   * import graph must be acyclic and respect the layers:  core -> (nothing)   gfx -> core   app -> core, gfx
//   * lint: no network APIs, no eval, no external URLs, no undeclared identifiers, no missing imports
import fs from 'node:fs';import path from 'node:path';
import {scan,topLevelDecls,declaratorNames,boundAnywhere,matchClose} from './jsscan.mjs';

const LAYER_RULES={core:['core'],gfx:['core','gfx'],app:['core','gfx','app']};
const BANNED_WORDS=new Set(['eval','fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','sendBeacon','Worker','SharedWorker']);
const BROWSER_GLOBALS=new Set(('Math Object Array String Number Boolean JSON Date Map Set WeakMap WeakSet Promise Symbol Error TypeError RangeError Infinity NaN isFinite isNaN parseInt parseFloat '+
 'Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array Uint8ClampedArray ArrayBuffer DataView window document navigator location localStorage '+
 'console performance requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout setInterval clearInterval addEventListener removeEventListener innerWidth innerHeight devicePixelRatio '+
 'matchMedia getComputedStyle URLSearchParams AudioContext OfflineAudioContext webkitAudioContext HTMLElement Event KeyboardEvent Intl Reflect undefined globalThis queueMicrotask structuredClone '+
 'Uint8Array WebGL2RenderingContext Image Blob URL encodeURIComponent decodeURIComponent Int32Array BigInt Proxy arguments require module').split(' '));

export function parseModule(file,rel){
  const src=fs.readFileSync(file,'utf8');const toks=scan(src);
  const M={rel,file,src,toks,imports:[],exportNames:new Map(),edits:[],decls:topLevelDecls(toks),errors:[]};
  const err=(t,msg)=>M.errors.push(rel+':'+(t?t.line:0)+': '+msg);
  let depth=0;
  for(let k=0;k<toks.length;k++){
    const t=toks[k];
    if(t.t==='punct'){if(t.v==='('||t.v==='['||t.v==='{')depth++;else if(t.v===')'||t.v===']'||t.v==='}')depth--}
    else if(t.t==='tpl'&&t.v==='`${')depth++;
    if(t.t!=='word')continue;
    const prev=toks[k-1];if(prev&&prev.t==='punct'&&prev.v==='.')continue;
    if(t.v==='import'){
      const nx=toks[k+1];
      if(nx&&nx.t==='punct'&&(nx.v==='('||nx.v==='.')){err(t,'dynamic import()/import.meta is not allowed');continue}
      if(depth!==0){err(t,'import must be at top level');continue}
      let j=k+1;const spec={from:null,named:[],ns:null,line:t.line};
      if(toks[j].t==='str'){spec.from=toks[j].v;j++}
      else{
        if(toks[j].t==='punct'&&toks[j].v==='*'){ // import * as ns from
          if(!(toks[j+1].v==='as'&&toks[j+2].t==='word'&&toks[j+3].v==='from'&&toks[j+4].t==='str')){err(t,'bad namespace import');continue}
          spec.ns=toks[j+2].v;spec.from=toks[j+4].v;j+=5;
        }else if(toks[j].t==='punct'&&toks[j].v==='{'){
          const e=matchClose(toks,j);let q=j+1;
          while(q<e){
            const a=toks[q];if(a.t!=='word'){err(a,'bad import list');break}
            let local=a.v;if(toks[q+1].t==='word'&&toks[q+1].v==='as'){local=toks[q+2].v;spec.named.push({imported:a.v,local});q+=3}else{spec.named.push({imported:a.v,local});q+=1}
            if(toks[q]&&toks[q].v===',')q++;
          }
          if(!(toks[e+1]&&toks[e+1].v==='from'&&toks[e+2]&&toks[e+2].t==='str')){err(t,'import list must be followed by from "..."');continue}
          spec.from=toks[e+2].v;j=e+3;
        }else{err(t,'unsupported import form (default imports are not allowed)');continue}
      }
      if(toks[j]&&toks[j].t==='punct'&&toks[j].v===';')j++;
      M.imports.push(spec);M.edits.push({s:t.s,e:toks[j-1].e,text:''});
      k=j-1;continue;
    }
    if(t.v==='export'&&depth===0){
      const nx=toks[k+1];
      if(!nx){err(t,'dangling export');continue}
      if(nx.t==='word'&&nx.v==='default'){err(t,'export default is not allowed; use a named export');continue}
      if(nx.t==='punct'&&nx.v==='*'){err(t,'export * is not allowed');continue}
      if(nx.t==='punct'&&nx.v==='{'){
        const e=matchClose(toks,k+1);let q=k+2;
        while(q<e){const a=toks[q];let local=a.v,out=a.v;if(toks[q+1].v==='as'){out=toks[q+2].v;q+=3}else q++;M.exportNames.set(out,local);if(toks[q]&&toks[q].v===',')q++}
        let end=e;if(toks[e+1]&&toks[e+1].v===';')end=e+1;
        if(toks[e+1]&&toks[e+1].v==='from'){err(t,'re-exports (export {..} from) are not allowed');continue}
        M.edits.push({s:t.s,e:toks[end].e,text:''});k=end;continue;
      }
      if(nx.t==='word'&&(nx.v==='const'||nx.v==='function'||nx.v==='class'||nx.v==='let'||nx.v==='var'||nx.v==='async')){
        if(nx.v==='let'||nx.v==='var'){err(t,'export '+nx.v+' is not allowed (no live bindings); use const or an object');continue}
        const kw=nx.v==='async'?k+2:k+1;
        if(nx.v==='const'){for(const n of declaratorNames(toks,k+1))M.exportNames.set(n,n)}
        else M.exportNames.set(toks[kw+1].v,toks[kw+1].v);
        M.edits.push({s:t.s,e:nx.s,text:''});continue;
      }
      err(t,'unsupported export form');
    }
  }
  return M;
}
export function bundle(opts={}){
  const root=opts.root||path.resolve(new URL('..',import.meta.url).pathname),SRC=path.join(root,'src'),entry=opts.entry||'app/main.js';
  const mods=new Map(),order=[],errors=[],warns=[];
  const visiting=[];
  function visit(rel){
    if(mods.has(rel)){if(mods.get(rel).state==='visiting'){errors.push('import cycle: '+visiting.concat(rel).join(' -> '))}return mods.get(rel)}
    const file=path.join(SRC,rel);
    if(!fs.existsSync(file)){errors.push('missing module '+rel);return null}
    const M=parseModule(file,rel);M.state='visiting';mods.set(rel,M);visiting.push(rel);
    errors.push(...M.errors);
    M.layer=rel.split('/')[0];
    for(const spec of M.imports){
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(rel),spec.from));
      spec.target=target;
      const tl=target.split('/')[0];
      if(!LAYER_RULES[M.layer])errors.push(rel+': unknown layer "'+M.layer+'"');
      else if(!LAYER_RULES[M.layer].includes(tl))errors.push(rel+':'+spec.line+': layer violation, '+M.layer+' may not import '+target);
      visit(target);
    }
    visiting.pop();M.state='done';order.push(M);return M;
  }
  visit(entry);
  const byRel=new Map(order.map(m=>[m.rel,m]));
  const id=m=>'M_'+m.rel.replace(/\.js$/,'').replace(/[^A-Za-z0-9]/g,'_');
  // import resolution + lint
  const allExports=new Map();                          // exported name -> modules exporting it
  for(const M of order)for(const n of M.exportNames.keys()){(allExports.get(n)||allExports.set(n,[]).get(n)).push(M.rel)}
  for(const M of order){
    const top=new Set(M.decls.map(d=>d.name)),imported=new Set(),lines=[];
    for(const spec of M.imports){
      const T=byRel.get(spec.target);if(!T)continue;
      if(spec.ns){lines.push('const '+spec.ns+'='+id(T)+';');imported.add(spec.ns)}
      const parts=[];
      for(const n of spec.named){
        if(!T.exportNames.has(n.imported)){errors.push(M.rel+':'+spec.line+': '+spec.target+' does not export "'+n.imported+'"');continue}
        if(top.has(n.local)||imported.has(n.local))errors.push(M.rel+':'+spec.line+': import "'+n.local+'" collides with another top-level name');
        imported.add(n.local);parts.push(n.imported===n.local?n.local:n.imported+':'+n.local);
      }
      if(parts.length)lines.push('const {'+parts.join(', ')+'}='+id(T)+';');
    }
    M.importLines=lines;M.importedNames=imported;
    // lint: banned words / urls
    for(let k=0;k<M.toks.length;k++){
      const t=M.toks[k],p=M.toks[k-1];
      if(t.t==='word'&&BANNED_WORDS.has(t.v)&&!(p&&p.t==='punct'&&(p.v==='.'||p.v==='?.'))&&!(M.toks[k+1]&&M.toks[k+1].v===':'))errors.push(M.rel+':'+t.line+': banned API "'+t.v+'" (the game must stay offline and eval-free)');
      if(t.t==='word'&&t.v==='Function'&&M.toks[k+1]&&M.toks[k+1].v==='('&&!(p&&p.v==='.'))errors.push(M.rel+':'+t.line+': banned Function() constructor');
      if(t.t==='str'&&/(^|[^A-Za-z])(https?:)?\/\/[A-Za-z0-9-]+\.[A-Za-z]/.test(t.v)&&!/www\.w3\.org/.test(t.v))errors.push(M.rel+':'+t.line+': external URL in string "'+t.v.slice(0,50)+'"');
    }
    // lint: undeclared identifiers + missing imports
    const bound=boundAnywhere(M.toks);
    const seen=new Set();
    for(let k=0;k<M.toks.length;k++){
      const t=M.toks[k];if(t.t!=='word')continue;
      const p=M.toks[k-1],nx=M.toks[k+1];
      if(p&&p.t==='punct'&&(p.v==='.'||p.v==='?.'))continue;
      if(nx&&nx.t==='punct'&&nx.v===':'&&p&&((p.t==='punct'&&(p.v==='{'||p.v===','))||p.t==='word'&&['get','set','static','async'].includes(p.v)))continue;   // object key
      if(nx&&nx.t==='punct'&&nx.v===':'&&(!p||(p.t==='punct'&&(p.v===';'||p.v==='}'||p.v==='{')))){continue}                                                // label
      if(/^(break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|let|static|async|await|of|null|true|false|get|set|as|from)$/.test(t.v))continue;
      if(top.has(t.v)||imported.has(t.v)||bound.has(t.v)||BROWSER_GLOBALS.has(t.v)||seen.has(t.v))continue;
      seen.add(t.v);
      const ex=allExports.get(t.v);
      if(ex)errors.push(M.rel+':'+t.line+': "'+t.v+'" is exported by '+ex.join(', ')+' but not imported here');
      else errors.push(M.rel+':'+t.line+': undeclared identifier "'+t.v+'"');
    }
  }
  // emit
  const parts=[];
  for(const M of order){
    let s=M.src;
    const edits=M.edits.slice().sort((a,b)=>b.s-a.s);
    for(const e of edits)s=s.slice(0,e.s)+e.text+s.slice(e.e);
    const exp=[...M.exportNames.entries()].map(([out,loc])=>out===loc?out:out+':'+loc);
    parts.push('/* ---- '+M.rel+' ---- */\nconst '+id(M)+'=(()=>{\n'+(M.importLines.length?M.importLines.join('\n')+'\n':'')+s.replace(/^\n+/,'').replace(/\s+$/,'')+'\n'+(exp.length?'return {'+exp.join(', ')+'};\n':'')+'})();');
  }
  const code="'use strict';\n(()=>{\n"+parts.join('\n\n')+'\n})();\n';
  return {code,order:order.map(m=>m.rel),errors,warns,modules:order.map(m=>({rel:m.rel,layer:m.layer,bytes:m.src.length,imports:m.imports.map(i=>i.target),exports:[...m.exportNames.keys()]}))};
}
