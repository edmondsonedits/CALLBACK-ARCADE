// Tiny JavaScript scanner used by the bundler + analysis tools (zero dependencies).
// Produces a flat token list (comments/whitespace dropped) and understands strings, templates, regex literals.
const KEYWORDS=new Set(['break','case','catch','class','const','continue','debugger','default','delete','do','else','export','extends','finally','for','function','if','import','in','instanceof','new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield','let','static','async','await','of','null','true','false','undefined','get','set']);
const REGEX_PREV_PUNCT=new Set(['(',',','=',':','[','!','&','|','?','{','}',';','+','-','*','%','<','>','~','^','=>','&&','||','??','==','===','!=','!==','<=','>=','+=','-=','*=','/=','%=','&=','|=','^=','<<','>>','>>>','...']);
const REGEX_PREV_WORD=new Set(['return','typeof','case','do','else','in','of','void','delete','new','throw','yield','await','instanceof']);
function scan(src){
  const toks=[];let i=0,n=src.length,line=1;
  const push=(t,v,s,e)=>toks.push({t,v,s,e,line});
  const tplStack=[];       // for nested template ${ } handling: stores brace depth at which template resumes
  let braceDepth=0;
  function prevSig(){return toks.length?toks[toks.length-1]:null}
  function regexAllowed(){
    const p=prevSig();if(!p)return true;
    if(p.t==='punct')return REGEX_PREV_PUNCT.has(p.v)&&!(p.v==='}'&&false);
    if(p.t==='word')return REGEX_PREV_WORD.has(p.v);
    return false;
  }
  function readTemplate(start){      // i points just after the opening backtick or after a closing '}' of ${}
    let j=i;
    while(j<n){
      const c=src[j];
      if(c==='\\'){j+=2;continue}
      if(c==='`'){j++;push('tpl','`',start,j);i=j;return}
      if(c==='$'&&src[j+1]==='{'){j+=2;push('tpl','`${',start,j);i=j;tplStack.push(braceDepth);braceDepth++;return}
      if(c==='\n')line++;
      j++;
    }
    i=j;
  }
  while(i<n){
    const c=src[i],s=i;
    if(c==='\n'){line++;i++;continue}
    if(c===' '||c==='\t'||c==='\r'){i++;continue}
    if(c==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n')i++;continue}
    if(c==='/'&&src[i+1]==='*'){const e=src.indexOf('*/',i+2);const seg=src.slice(i,e<0?n:e+2);line+=(seg.match(/\n/g)||[]).length;i=e<0?n:e+2;continue}
    if(c==='"'||c==="'"){let j=i+1;while(j<n&&src[j]!==c){if(src[j]==='\\')j++;if(src[j]==='\n')line++;j++}j++;push('str',src.slice(i+1,j-1),s,j);i=j;continue}
    if(c==='`'){i++;readTemplate(s);continue}
    if(c==='/'&&regexAllowed()){
      let j=i+1,cls=false;
      while(j<n){const d=src[j];if(d==='\\'){j+=2;continue}if(d==='[')cls=true;else if(d===']')cls=false;else if(d==='/'&&!cls)break;else if(d==='\n')break;j++}
      j++;while(j<n&&/[a-z]/i.test(src[j]))j++;
      push('regex',src.slice(i,j),s,j);i=j;continue;
    }
    if(/[0-9]/.test(c)||(c==='.'&&/[0-9]/.test(src[i+1]||''))){
      let j=i;while(j<n&&/[0-9a-zA-Z_.]/.test(src[j])){if((src[j]==='e'||src[j]==='E')&&(src[j+1]==='+'||src[j+1]==='-'))j++;j++}
      push('num',src.slice(i,j),s,j);i=j;continue;
    }
    if(/[A-Za-z_$\u00A0-\uFFFF]/.test(c)){let j=i+1;while(j<n&&/[A-Za-z0-9_$\u00A0-\uFFFF]/.test(src[j]))j++;push('word',src.slice(i,j),s,j);i=j;continue}
    // punctuation (longest match first)
    const three=src.substr(i,4);
    const P=['>>>=','...','===','!==','**=','<<=','>>=','>>>','&&=','||=','??=','=>','==','!=','<=','>=','&&','||','??','?.','++','--','+=','-=','*=','/=','%=','&=','|=','^=','<<','>>','**'];
    let m=null;for(const p of P){if(three.startsWith(p)){m=p;break}}
    if(!m)m=c;
    if(m==='{'){braceDepth++}
    if(m==='}'){
      braceDepth--;
      if(tplStack.length&&tplStack[tplStack.length-1]===braceDepth){tplStack.pop();push('punct','}',s,i+1);i++;readTemplate(s);continue}
    }
    push('punct',m,s,i+m.length);i+=m.length;
  }
  return toks;
}
export {scan,KEYWORDS};

/* ---- declaration helpers --------------------------------------------------------------------------------- */
const closeOf={'(':')','[':']','{':'}'};
/** index of the token that closes the bracket at toks[k] (handles template ${ } pairs) */
export function matchClose(toks,k){
  let d=0;
  for(let j=k;j<toks.length;j++){
    const t=toks[j];
    if(t.t==='punct'){if(t.v==='('||t.v==='['||t.v==='{')d++;else if(t.v===')'||t.v==='}'||t.v===']'){d--;if(d===0)return j}}
    else if(t.t==='tpl'&&t.v==='`${')d++;
  }
  return -1;
}
/** Names introduced by a var/let/const statement starting at keyword token k (supports chained declarators and destructuring). */
export function declaratorNames(toks,k){
  const names=[];let j=k+1;
  for(;;){
    const a=toks[j];if(!a)break;
    if(a.t==='word'){names.push(a.v);j++}
    else if(a.t==='punct'&&(a.v==='['||a.v==='{')){const e=matchClose(toks,j);for(let q=j+1;q<e;q++)if(toks[q].t==='word'&&!(toks[q+1]&&toks[q+1].v===':'&&toks[q+1].t==='punct'))names.push(toks[q].v);j=e+1}
    else break;
    let d=0;
    while(j<toks.length){
      const x=toks[j];
      if(x.t==='punct'){
        if(x.v==='('||x.v==='['||x.v==='{')d++;
        else if(x.v===')'||x.v===']'||x.v==='}'){d--;if(d<0)break}
        else if((x.v===';'||x.v===',')&&d===0)break;
        else if(d===0&&(x.v==='of'||x.v==='in'))break;
      }else if(x.t==='tpl'&&x.v==='`${')d++;
      else if(x.t==='word'&&d===0&&(x.v==='of'||x.v==='in'))break;
      j++;
    }
    if(toks[j]&&toks[j].t==='punct'&&toks[j].v===','){j++;continue}
    break;
  }
  return names;
}
/** top-level (depth 0) declarations: [{name, kw}] where kw = index of the declaring keyword token */
export function topLevelDecls(toks){
  let depth=0;const decl=[];
  for(let k=0;k<toks.length;k++){
    const t=toks[k];
    if(t.t==='punct'){if(t.v==='('||t.v==='['||t.v==='{')depth++;else if(t.v===')'||t.v===']'||t.v==='}')depth--}
    else if(t.t==='tpl'&&t.v==='`${')depth++;
    if(depth!==0||t.t!=='word')continue;
    const prev=toks[k-1];
    if((t.v==='const'||t.v==='let'||t.v==='var')&&!(prev&&prev.t==='punct'&&prev.v==='.')){
      for(const name of declaratorNames(toks,k))decl.push({name,kw:k,kind:t.v});
    }else if((t.v==='function'||t.v==='class')&&toks[k+1]&&toks[k+1].t==='word'&&!(prev&&prev.t==='punct'&&['.','=','(',',',':','?','&&','||'].includes(prev.v))){
      decl.push({name:toks[k+1].v,kw:k,kind:t.v});
    }
  }
  return decl;
}
/** Every identifier that is *bound* somewhere in the file (declarations, parameters, catch vars, method names...). Superset on purpose. */
export function boundAnywhere(toks){
  const bound=new Set();
  for(let k=0;k<toks.length;k++){
    const t=toks[k],prev=toks[k-1],nx=toks[k+1];
    if(t.t==='word'&&(t.v==='const'||t.v==='let'||t.v==='var')&&!(prev&&prev.v==='.'))for(const n of declaratorNames(toks,k))bound.add(n);
    else if(t.t==='word'&&(t.v==='function'||t.v==='class')&&nx&&nx.t==='word')bound.add(nx.v);
    else if(t.t==='word'&&nx&&nx.t==='punct'&&nx.v==='=>')bound.add(t.v);
    else if(t.t==='punct'&&t.v==='('){
      const e=matchClose(toks,k),after=toks[e+1];
      const isParams=after&&after.t==='punct'&&(after.v==='=>'||(after.v==='{'&&prev&&((prev.t==='word'&&!['if','for','while','switch','with','return','typeof','in','of','else','do','case','new','await','yield','void','delete','throw'].includes(prev.v))||(prev.t==='punct'&&['{',',','}',';'].includes(prev.v))||prev.t==='str'||prev.t==='num'))||false);
      const isFn=prev&&prev.t==='word'&&(prev.v==='function'||(toks[k-2]&&toks[k-2].v==='function')||prev.v==='catch');
      if(isParams||isFn){for(let q=k+1;q<e;q++)if(toks[q].t==='word'&&!(toks[q-1]&&toks[q-1].v==='.'))bound.add(toks[q].v)}
      // method definition  name(...){  -> the name is bound (class/object method), not a reference
      if(after&&after.v==='{'&&prev&&prev.t==='word'&&prev.v!=='function'&&toks[k-2]&&((toks[k-2].t==='punct'&&['{',',','}',';'].includes(toks[k-2].v))||(toks[k-2].t==='word'&&['static','get','set','async'].includes(toks[k-2].v))))bound.add(prev.v);
    }
  }
  return bound;
}
