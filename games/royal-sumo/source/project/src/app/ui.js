/* ============================================================================
   ROYAL SUMO - UI  (title, setup, HUD, pause, settings, help, results)
   All DOM is built with textContent or static SVG strings; per-frame writes are diffed.
   ========================================================================== */
import {smooth} from '../core/util.js';
import {DIFF_LABEL} from '../core/tune.js';
import {MAPS, MAP_ORDER} from '../core/maps.js';
import {STYLES} from '../gfx/gfx_fighter.js';
import {Settings} from '../core/settings.js';
import {Controls} from './controls.js';
import {VERSIONS} from '../core/versions.js';
export const UI=(function(){
  const INK='#150a26',CREAM='#fff4d6',GOLD='#ffc93c';
  const S={root:null,hooks:{},screen:'',els:{},syncsSetup:[],syncsSet:[],tab:'match',mapIdx:0,bd:{key:'',out:[],cr:[]},lb:{},lbPool:[],
    banT:0,fps:0,last:{},helpFirst:false,helpOpen:false,setOpen:false,pauseOpen:false,busy:false,scrT:0,lockScroll:0,helpFromPause:false,kfN:0,ppN:0};
  const cfg=(k,d)=>{try{if(typeof Settings!=='undefined'){const v=Settings.get(k);if(v!==undefined)return v}}catch(e){}return d};
  const sfx=n=>{try{S.hooks.sfx&&S.hooks.sfx(n)}catch(e){}};
  const hook=(n,a)=>{try{S.hooks[n]&&S.hooks[n](a)}catch(e){console.error(e)}};
  function h(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined&&txt!==null)e.textContent=txt;return e}
  function sv(str){const t=document.createElement('template');t.innerHTML=str.trim();return t.content.firstChild}
  function btn(cls,txt,fn,o){const b=h('button','btn '+(cls||''),txt);b.type='button';if(o&&o.sfx)b.dataset.sfx=o.sfx;if(o&&o.label)b.setAttribute('aria-label',o.label);if(fn)b.addEventListener('click',fn);return b}
  const rm=()=>!!cfg('acc.reduceMotion',false);

  /* ------------------------------------------------------------------ icons */
  const P=(d,extra)=>`<path d="${d}" ${extra||''}/>`;
  const IC={
    crown:`<svg viewBox="0 0 64 48"><path d="M6 42 L2 10 L18 25 L32 3 L46 25 L62 10 L58 42 Z" fill="${GOLD}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="32" cy="29" r="4.5" fill="#e8384f" stroke="${INK}" stroke-width="2.5"/><circle cx="14" cy="32" r="3" fill="#35d0e8" stroke="${INK}" stroke-width="2"/><circle cx="50" cy="32" r="3" fill="#35d0e8" stroke="${INK}" stroke-width="2"/></svg>`,
    pause:`<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1.5" fill="${CREAM}"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="${CREAM}"/></svg>`,
    left:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4 L7 12 L15 20"/></svg>`,
    right:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 L17 12 L9 20"/></svg>`,
    gear:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>`,
    help:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 9a3.5 3.5 0 1 1 5.2 3c-1.2.8-1.7 1.4-1.7 2.6"/><circle cx="12" cy="19" r=".6" fill="currentColor"/></svg>`,
    pad:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11.5" r=".8" fill="currentColor"/><circle cx="18.2" cy="13.5" r=".8" fill="currentColor"/></svg>`,
    note:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/></svg>`,
    spark:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.2 6.3L21 10l-6.3 2.2L12 22l-2.7-9.8L2 10l7.3-1.7z"/></svg>`,
    eye:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    move:`<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="rgba(255,255,255,.18)" stroke="${CREAM}" stroke-width="3"/><circle cx="25" cy="15" r="7" fill="#ffd45e" stroke="${INK}" stroke-width="3"/><path d="M5 20h6M29 20h6M20 5v6M20 29v6" stroke="${CREAM}" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>`,
    fist:`<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#e8384f" stroke="${INK}" stroke-width="3"/><path d="M11 19q0-4 4-4h9q4 0 4 4v4q0 6-6 6h-3q-8 0-8-6z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M16 15v6M20 15v6M24 15v6" stroke="${INK}" stroke-width="2"/></svg>`,
    bolt:`<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#35d0e8" stroke="${INK}" stroke-width="3"/><path d="M23 6L11 22h8l-3 12 13-17h-8z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
    trophy:`<svg viewBox="0 0 40 40"><path d="M11 6h18v8q0 8-9 10-9-2-9-10z" fill="${GOLD}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M11 9H5q0 8 7 9M29 9h6q0 8-7 9" fill="none" stroke="${INK}" stroke-width="3"/><path d="M20 24v7M13 34h14" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></svg>`,
    star:`<svg viewBox="0 0 24 24"><path d="M12 2l3 7 7 .8-5.3 4.8 1.6 7.2L12 18l-6.3 3.8 1.6-7.2L2 9.8 9 9z" fill="${GOLD}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`
  };
  // colour-blind shape glyphs (fill = currentColor)
  const GLY=[
    '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><rect x="1.2" y="1.2" width="7.6" height="7.6" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M5 .8L9.4 9H.6z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M5 .5L9.5 5 5 9.5.5 5z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M5 .4l1.4 3.1 3.4.3-2.6 2.2.8 3.3L5 7.6 2.0 9.3l.8-3.3L.2 3.8l3.4-.3z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M2.8 1.2h4.4L9.4 5 7.2 8.8H2.8L.6 5z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M3.6.8h2.8v2.8h2.8v2.8H6.4v2.8H3.6V6.4H.8V3.6h2.8z" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 10 10"><path d="M5 9L1 5.2C-.2 3.6.8 1 3 1c1 0 1.6.5 2 1.2C5.4 1.5 6 1 7 1c2.2 0 3.2 2.6 2 4.2z" fill="currentColor"/></svg>'
  ];
  const MAPICON={
    keep:`<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#ff6a2b"/><circle cx="12" cy="52" r="7" fill="#ffd23c" opacity=".7"/><circle cx="55" cy="12" r="6" fill="#ffd23c" opacity=".6"/><circle cx="32" cy="32" r="26" fill="#8c86a8" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="32" r="18" fill="#a9a3c4" stroke="${INK}" stroke-width="3" stroke-dasharray="22 7"/><circle cx="32" cy="32" r="9" fill="#e6d8b6" stroke="${INK}" stroke-width="3"/><path d="M26 34l-2-7 5 3 3-5 3 5 5-3-2 7z" fill="${GOLD}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    floe:`<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#2e86c1"/><path d="M0 50q16-6 32 0t32 0v14H0z" fill="#1f6aa0"/><path d="M32 6l20 8 8 20-8 18-20 8-20-8-8-18 8-20z" fill="#e8f9ff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M32 6v22L12 14M32 28l22 8M32 28L16 52" fill="none" stroke="#7fc7e8" stroke-width="3" stroke-linecap="round"/><path d="M45 22l3 3M48 22l-3 3" stroke="#fff" stroke-width="2"/></svg>`,
    plaza:`<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#35206b"/><circle cx="32" cy="32" r="27" fill="#4a2f86" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="32" r="23" fill="none" stroke="#ff6fa8" stroke-width="5" stroke-dasharray="30 8"/><circle cx="24" cy="26" r="6" fill="#e8384f" stroke="${INK}" stroke-width="3"/><circle cx="40" cy="26" r="6" fill="#e8384f" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="41" r="6" fill="#ffc93c" stroke="${INK}" stroke-width="3"/><circle cx="22" cy="24" r="1.8" fill="#fff"/><circle cx="38" cy="24" r="1.8" fill="#fff"/><circle cx="30" cy="39" r="1.8" fill="#fff"/></svg>`,
    wharf:`<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#2fa4d8"/><path d="M0 12q8-4 16 0t16 0 16 0 16 0M0 52q8-4 16 0t16 0 16 0 16 0" fill="none" stroke="#9fe0f7" stroke-width="2.5" stroke-linecap="round"/><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="28" y="3" width="8" height="26" rx="2" fill="#ff7a3c"/><rect x="28" y="35" width="8" height="26" rx="2" fill="#ff7a3c"/><rect x="3" y="28" width="26" height="8" rx="2" fill="#fff4d6"/><rect x="35" y="28" width="26" height="8" rx="2" fill="#fff4d6"/><circle cx="32" cy="32" r="9" fill="#e6c27a"/></g><circle cx="32" cy="32" r="3" fill="${INK}"/></svg>`,
    teeter:`<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#e9c47c"/><path d="M0 54h64v10H0z" fill="#c79a4d"/><path d="M26 56l6-18 6 18z" fill="#7a4a2a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><g transform="rotate(-14 32 36)"><ellipse cx="32" cy="34" rx="27" ry="8" fill="#b9a27a" stroke="${INK}" stroke-width="3"/><ellipse cx="32" cy="31" rx="27" ry="8" fill="#d8c294" stroke="${INK}" stroke-width="3"/></g><circle cx="15" cy="22" r="6" fill="#e8384f" stroke="${INK}" stroke-width="3"/></svg>`,
    mesa:`<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#e47b43"/><circle cx="50" cy="14" r="6" fill="#ffd23c" opacity=".85"/><path d="M0 56l10-18h16l8-6h16l14 24z" fill="#a8482a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><ellipse cx="32" cy="46" rx="18" ry="6" fill="#d9733c" stroke="${INK}" stroke-width="3"/><ellipse cx="32" cy="46" rx="11" ry="3.6" fill="none" stroke="#ff3b3b" stroke-width="3"/><path d="M18 6l8 18" stroke="#ffd23c" stroke-width="4" stroke-linecap="round"/><circle cx="27" cy="26" r="5" fill="#fff4d6" stroke="${INK}" stroke-width="3"/></svg>`
  };
  const MAPCOL={keep:['#5a2a3a','#2a1428','#ff6a2b'],floe:['#2a5a8a','#16284f','#2e86c1'],plaza:['#4a2f86','#241447','#35206b'],wharf:['#1e6f9a','#12304f','#2fa4d8'],teeter:['#8a6a3a','#3b2a1a','#e9c47c'],mesa:['#9a4a2a','#3a1a14','#e47b43']};
  const DIFF_DESC={rookie:'Bots wander, swing late and rarely dodge. Perfect for learning.',easy:'Bots chase you but make plenty of mistakes.',normal:'A fair fight. Bots use hazards and dodge sometimes.',hard:'Quick, dashing bots that dodge hazards and punish mistakes.',legend:'Rarely slip. Watches every hazard. Good luck.',mixed:'Every bot gets a different skill, from Page to Legend.'};

  /* ---------------------------------------------------------------- widgets */
  function pctOf(d,v){return ((v-d.min)/(d.max-d.min)*100).toFixed(1)+'%'}
  function setVal(d,v){S.busy=true;try{Settings.set(d.key,v)}finally{S.busy=false}}
  function mkSeg(d,list){
    const wrap=h('div','seg');wrap.setAttribute('role','group');wrap.setAttribute('aria-label',d.label);
    const bs=d.options.map(o=>{const b=h('button','seg-b',o.label);b.type='button';b.dataset.sfx='select';
      b.addEventListener('click',()=>{setVal(d,o.v);sync();if(d.onPick)d.onPick(o.v)});wrap.appendChild(b);return b});
    function sync(){const cur=Settings.get(d.key);bs.forEach((b,i)=>{const on=d.options[i].v===cur;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false')})}
    sync();list&&list.push(sync);return wrap;
  }
  function mkToggle(d,list,labelId){
    const b=h('button','tog');b.type='button';b.setAttribute('role','switch');b.dataset.sfx='toggle';b.setAttribute('aria-label',d.label);
    b.addEventListener('click',()=>{setVal(d,!Settings.get(d.key));sync()});
    function sync(){const on=!!Settings.get(d.key);b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false')}
    sync();list&&list.push(sync);return b;
  }
  function mkRange(d,list,valEl){
    const r=document.createElement('input');r.type='range';r.min=d.min;r.max=d.max;r.step=d.step;r.setAttribute('aria-label',d.label);
    const fmt=d.fmt||(v=>String(v));
    function paint(v){r.style.setProperty('--pc',pctOf(d,v));if(valEl)valEl.textContent=fmt(v);r.setAttribute('aria-valuetext',fmt(v))}
    r.addEventListener('input',()=>{setVal(d,+r.value);paint(Settings.get(d.key))});
    r.addEventListener('change',()=>sfx('select'));
    function sync(){const v=Settings.get(d.key);if(document.activeElement!==r||!S.busy)r.value=v;paint(v)}
    sync();list&&list.push(sync);return r;
  }
  function mkRow(d,list){
    const row=h('div','row'+(d.type==='toggle'?' tg':''));if(d.adv)row.dataset.adv='1';
    const head=h('div','row-h');head.appendChild(h('span','row-l',d.label));
    if(d.type==='toggle'){head.appendChild(mkToggle(d,list));row.appendChild(head);if(d.desc)row.appendChild(h('div','desc',d.desc));return row}
    const val=h('span','row-v');
    if(d.type==='range'){head.appendChild(val);row.appendChild(head);if(d.desc)row.appendChild(h('div','desc',d.desc));const c=h('div','row-c');c.appendChild(mkRange(d,list,val));row.appendChild(c)}
    else{row.appendChild(head);if(d.desc)row.appendChild(h('div','desc',d.desc));const c=h('div','row-c');c.appendChild(mkSeg(d,list));row.appendChild(c)}
    return row;
  }
  const defOf=k=>Settings.byKey[k];

  /* -------------------------------------------------------------------- title */
  function buildTitle(){
    const scr=h('div','scr');scr.dataset.scr='title';
    const wrap=h('div','ti-wrap');
    const logo=h('div','logo');
    const cr=sv(IC.crown);cr.setAttribute('class','logo-crown');cr.setAttribute('aria-hidden','true');logo.appendChild(cr);
    logo.appendChild(h('span','logo-a otl','ROYAL'));
    logo.appendChild(h('span','logo-b','SUMO'));
    logo.appendChild(h('span','logo-c','CROWNFALL'));
    wrap.appendChild(logo);
    const bt=h('div','ti-btns');
    S.els.career=h('div','ti-stats otl-s');bt.appendChild(S.els.career);
    const play=btn('big red shine','Play',()=>{show('setup')},{sfx:'start'});play.dataset.primary='1';
    bt.appendChild(play);
    const row=h('div','ti-row');
    const bs=btn('ghost sm','Settings',()=>openSettings());bs.insertBefore(sv(IC.gear),bs.firstChild);
    const bh=btn('ghost sm','How to play',()=>showHelp());bh.insertBefore(sv(IC.help),bh.firstChild);
    row.appendChild(bs);row.appendChild(bh);bt.appendChild(row);wrap.appendChild(bt);
    scr.appendChild(wrap);
    const pos=[[6,24,0],[86,20,1.1],[10,60,2.2],[88,56,.6]];
    pos.forEach((p,i)=>{const s=sv(IC[i%2?'star':'crown']);s.setAttribute('class','float-ic');s.setAttribute('aria-hidden','true');s.style.left=p[0]+'%';s.style.top=p[1]+'%';s.style.animationDelay=p[2]+'s';scr.appendChild(s)});
    scr.appendChild(h('div','ti-ver otl-s','v'+VERSIONS.build));
    S.root.appendChild(scr);S.els.title=scr;
  }

  function careerText(c){return c&&c.matches>0?('WINS '+c.wins+'  \u00b7  MATCHES '+c.matches+'  \u00b7  KOS '+c.kos+(c.cups?'  \u00b7  CUPS '+c.cups:'')):''}
  function setCareer(c){S.career=c;if(S.els.career){const t=careerText(c);S.els.career.textContent=t;S.els.career.style.display=t?'':'none'}}
  /* -------------------------------------------------------------------- setup */
  function carStep(){const c=S.els.car;const m=c.firstChild;return m?m.offsetWidth+10:1}
  function goMap(i,smooth){
    const n=MAP_ORDER.length;i=(i+n)%n;
    S.mapIdx=i;const c=S.els.car;
    S.lockScroll=performance.now()+(smooth?500:200);
    try{c.scrollTo({left:i*carStep(),behavior:smooth&&!rm()?'smooth':'auto'})}catch(e){c.scrollLeft=i*carStep()}
    pickMap(i);
  }
  function pickMap(i){
    S.mapIdx=i;const id=MAP_ORDER[i];
    S.els.dots.forEach((d,k)=>{d.classList.toggle('on',k===i);d.setAttribute('aria-current',k===i?'true':'false')});
    if(Settings.get('match.map')!==id){setVal(defOf('match.map'),id);hook('previewMap',id)}
  }
  /* ------------------------------------------------- your sumo: name + look (stored in the SlotTable) */
  function lookSvg(i){
    const k=STYLES[((i%STYLES.length)+STYLES.length)%STYLES.length];
    return sv('<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="'+k.belt+'" stroke="#150a26" stroke-width="3"/><circle cx="20" cy="22" r="11.2" fill="'+k.skin+'"/><path d="M8.8 19.4a11.2 11.2 0 0 1 22.4 0c-5-3.8-17.4-3.8-22.4 0z" fill="'+k.hair+'"/><circle cx="20" cy="9.4" r="3.5" fill="'+k.hair+'"/><circle cx="15.7" cy="23" r="1.7" fill="#241a18"/><circle cx="24.3" cy="23" r="1.7" fill="#241a18"/><path d="M16.6 27.4q3.4 2.5 6.8 0" fill="none" stroke="#7a3b2e" stroke-width="1.5" stroke-linecap="round"/></svg>');
  }
  function buildPicker(){
    const box=h('div','pk-box');
    const mk=seat=>{
      const row=h('div','pk');row.dataset.seat=String(seat);
      const head=h('div','pk-h'),av=h('div','pk-av'),col=h('div','pk-col'),lab=h('div','pk-lab');
      const inp=document.createElement('input');
      inp.type='text';inp.className='pk-name';inp.maxLength=12;inp.autocomplete='off';inp.spellcheck=false;
      inp.setAttribute('autocapitalize','characters');inp.setAttribute('enterkeyhint','done');
      col.appendChild(lab);col.appendChild(inp);head.appendChild(av);head.appendChild(col);row.appendChild(head);
      const grid=h('div','pk-grid');grid.setAttribute('role','group');
      const sw=[];
      const pick=i=>{S.slots.setStyle(seat,i);syncSetup();hook('previewLook')};
      for(let i=0;i<STYLES.length;i++){const b=h('button','pk-s');b.type='button';b.dataset.sfx='select';b.appendChild(lookSvg(i));b.addEventListener('click',()=>pick(i));grid.appendChild(b);sw.push(b)}
      const au=h('button','pk-s pk-auto','Auto');au.type='button';au.dataset.sfx='select';au.addEventListener('click',()=>pick(-1));grid.appendChild(au);
      row.appendChild(grid);
      inp.addEventListener('input',()=>{S.slots.setName(seat,inp.value)});
      inp.addEventListener('change',()=>{inp.value=S.slots.get(seat).name});
      inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();inp.blur()}});
      const other=seat===0?1:0;
      S.syncsSetup.push(()=>{
        const two=Settings.get('match.players')===2,s=S.slots.get(seat),o=S.slots.get(other);
        row.style.display=(seat===0||two)?'':'none';
        lab.textContent=two?('Player '+(seat+1)):'You';
        inp.placeholder=two?('P'+(seat+1)):'YOU';
        inp.setAttribute('aria-label',(two?'Player '+(seat+1):'Your')+' name');
        if(document.activeElement!==inp)inp.value=s.name;
        const eff=S.slots.resolve(Math.max(2,Settings.get('match.fighters')))[seat];
        clearEl(av);av.appendChild(lookSvg(eff.style));
        const otherShown=seat===1||two;
        sw.forEach((b,i)=>{
          const taken=otherShown&&o.style===i&&s.style!==i;
          b.classList.toggle('on',eff.style===i);b.classList.toggle('taken',taken);b.disabled=taken;
          b.setAttribute('aria-label','Look '+(i+1)+(taken?' (taken)':''));b.setAttribute('aria-pressed',eff.style===i?'true':'false');
        });
        au.classList.toggle('on',s.style<0);au.setAttribute('aria-pressed',s.style<0?'true':'false');
        au.setAttribute('aria-label','Automatic look');
      });
      return row;
    };
    box.appendChild(mk(0));box.appendChild(mk(1));
    return box;
  }
  function buildSetup(){
    const scr=h('div','scr');scr.dataset.scr='setup';
    const wrap=h('div','su-wrap');
    const head=h('div','su-head');
    const back=btn('ghost sm','Back',()=>show('title'),{sfx:'back',label:'Back to title'});back.insertBefore(sv(IC.left),back.firstChild);
    head.appendChild(back);head.appendChild(h('div','su-title otl','Pick your arena'));
    wrap.appendChild(head);
    const panel=h('div','su-panel panel');
    const sc=h('div','su-scroll');
    S.syncsSetup=[];
    const lf=h('div','su-l'),rt=h('div','su-r');
    // map carousel
    const car=h('div','car');car.setAttribute('role','listbox');car.setAttribute('aria-label','Maps');car.tabIndex=0;
    MAP_ORDER.forEach((id,i)=>{
      const M=MAPS[id],col=MAPCOL[id]||['#3a2670','#241447','#555'];
      const c=h('div','mc');c.setAttribute('role','option');c.style.setProperty('--mc1',col[0]);c.style.setProperty('--mc2',col[1]);c.style.setProperty('--mcb',col[2]);
      const ic=h('div','mc-ico');ic.appendChild(sv(MAPICON[id]||MAPICON.keep));c.appendChild(ic);
      c.appendChild(h('div','mc-name otl-s',M.name));
      const tg=h('div','mc-tags');tg.appendChild(h('span','chip gold',M.style));tg.appendChild(h('span','chip cyan',M.tag));c.appendChild(tg);
      c.appendChild(h('div','mc-blurb',M.blurb));
      const ul=h('ul','mc-tips');(M.tips||[]).forEach(t=>ul.appendChild(h('li','',t)));c.appendChild(ul);
      car.appendChild(c);
    });
    car.addEventListener('scroll',()=>{
      if(performance.now()<S.lockScroll)return;
      clearTimeout(S.scrT);S.scrT=setTimeout(()=>{const i=Math.max(0,Math.min(MAP_ORDER.length-1,Math.round(car.scrollLeft/carStep())));if(i!==S.mapIdx){pickMap(i);sfx('select')}},90);
    },{passive:true});
    car.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){goMap(S.mapIdx-1,true);sfx('select');e.preventDefault()}else if(e.key==='ArrowRight'){goMap(S.mapIdx+1,true);sfx('select');e.preventDefault()}});
    S.els.car=car;lf.appendChild(car);
    const bar=h('div','car-bar');
    const pv=h('button','car-nav');pv.type='button';pv.setAttribute('aria-label','Previous map');pv.appendChild(sv(IC.left));pv.addEventListener('click',()=>{goMap(S.mapIdx-1,true);sfx('select')});
    const nx=h('button','car-nav');nx.type='button';nx.setAttribute('aria-label','Next map');nx.appendChild(sv(IC.right));nx.addEventListener('click',()=>{goMap(S.mapIdx+1,true);sfx('select')});
    const dots=h('div','dots');S.els.dots=MAP_ORDER.map((id,i)=>{const d=h('button','dot');d.type='button';d.setAttribute('aria-label',MAPS[id].name);d.addEventListener('click',()=>{goMap(i,true);sfx('select')});dots.appendChild(d);return d});
    bar.appendChild(pv);bar.appendChild(dots);bar.appendChild(nx);lf.appendChild(bar);
    // difficulty
    const dd=defOf('match.difficulty');
    const sec1=h('div','sec');sec1.appendChild(h('span','','Bot skill'));rt.appendChild(sec1);
    const dsc=h('div','desc');
    const dseg=mkSeg(Object.assign({},dd,{onPick:()=>updDesc()}),S.syncsSetup);rt.appendChild(dseg);rt.appendChild(dsc);
    function updDesc(){dsc.textContent=DIFF_DESC[Settings.get('match.difficulty')]||''}
    S.syncsSetup.push(updDesc);updDesc();
    // grouped basics
    const g=h('div','group');
    const gi=(title,node)=>{const w=h('div');const s=h('div','sec');s.appendChild(h('span','',title));w.appendChild(s);w.appendChild(node);g.appendChild(w)};
    // fighters stepper
    const fd=defOf('match.fighters');
    const st=h('div','stepper');
    const minus=h('button','step-b','−');minus.type='button';minus.setAttribute('aria-label','Fewer fighters');minus.dataset.sfx='select';
    const val=h('div','step-v');val.setAttribute('aria-live','polite');
    const plus=h('button','step-b','+');plus.type='button';plus.setAttribute('aria-label','More fighters');plus.dataset.sfx='select';
    const dotsF=h('div','step-fighters');
    const dotEls=[];for(let i=0;i<10;i++){const d=document.createElement('i');d.style.background=(typeof STYLES!=='undefined'&&STYLES[i%STYLES.length])?STYLES[i%STYLES.length].belt:'#888';dotsF.appendChild(d);dotEls.push(d)}
    const stepF=dv=>{setVal(fd,Math.max(fd.min,Math.min(fd.max,Settings.get('match.fighters')+dv)));syncF()};
    minus.addEventListener('click',()=>stepF(-1));plus.addEventListener('click',()=>stepF(1));
    function syncF(){const n=Settings.get('match.fighters');val.textContent=String(n);dotEls.forEach((d,i)=>{d.style.display=i<n?'block':'none'});minus.disabled=n<=fd.min;plus.disabled=n>=fd.max;minus.style.opacity=minus.disabled?.4:1;plus.style.opacity=plus.disabled?.4:1}
    S.syncsSetup.push(syncF);syncF();
    st.appendChild(minus);st.appendChild(val);st.appendChild(plus);
    const fw=h('div');fw.appendChild(st);fw.appendChild(dotsF);
    gi('Game mode',mkSeg(Object.assign({},defOf('match.mode'),{onPick:()=>syncSetup()}),S.syncsSetup));
    gi('Players',mkSeg(Object.assign({},defOf('match.players'),{onPick:()=>syncSetup()}),S.syncsSetup));
    gi('Fighters',fw);
    gi('Rounds to win',mkSeg(defOf('match.winTarget'),S.syncsSetup));
    gi('Hazards',mkSeg(defOf('match.hazard'),S.syncsSetup));
    gi('Round length',mkSeg(defOf('match.length'),S.syncsSetup));
    rt.appendChild(g);
    const mdesc=h('div','desc');rt.appendChild(mdesc);
    if(S.slots){const sec3=h('div','sec');sec3.appendChild(h('span','','Your sumo'));rt.appendChild(sec3);rt.appendChild(buildPicker())}
    function syncMode(){const m=Settings.get('match.mode'),p=Settings.get('match.players');const t=[];if(m==='cup')t.push(defOf('match.mode').desc);if(p===2)t.push(defOf('match.players').desc);mdesc.textContent=t.join(' ');mdesc.style.display=t.length?'':'none';if(S.els.goBtn)S.els.goBtn.firstChild.textContent=m==='cup'?'Start cup':'Start match'}
    S.syncsSetup.push(syncMode);
    // presets
    const sec2=h('div','sec');sec2.appendChild(h('span','','Game style'));rt.appendChild(sec2);
    const pr=h('div','seg');const pdesc=h('div','desc');
    const pbs=Settings.presets.map(p=>{const b=h('button','chip',p.label);b.type='button';b.style.fontSize='.85em';b.dataset.sfx='select';b.addEventListener('click',()=>{Settings.apply(p);syncSetup()});pr.appendChild(b);return b});
    const rb=h('button','chip','Randomize');rb.type='button';rb.dataset.sfx='select';rb.addEventListener('click',()=>{Settings.randomize();syncSetup();const i=MAP_ORDER.indexOf(Settings.get('match.map'));if(i>=0)goMap(i,true)});rb.style.fontSize='.85em';pr.appendChild(rb);
    rt.appendChild(pr);rt.appendChild(pdesc);
    function syncPresets(){
      let found=null;
      Settings.presets.forEach((p,i)=>{let ok=true;for(const d of Settings.def){if(d.section!=='match'||d.key==='match.map'||d.key==='match.fighters'||d.key==='match.mode'||d.key==='match.players')continue;const k=d.key.slice(6);const want=k in p.values?p.values[k]:d.def;if(Settings.get(d.key)!==want){ok=false;break}}
        pbs[i].classList.toggle('sel',ok);pbs[i].setAttribute('aria-pressed',ok?'true':'false');if(ok)found=p});
      pdesc.textContent=found?found.desc:'Custom rules. Tweak anything under More rules.';
    }
    S.syncsSetup.push(syncPresets);syncPresets();
    // more rules
    const more=h('div','more');
    const mb=btn('ghost sm','More rules',()=>{const o=more.classList.toggle('open');mb.setAttribute('aria-expanded',o?'true':'false');if(o)setTimeout(()=>{try{more.scrollIntoView({block:'nearest',behavior:rm()?'auto':'smooth'})}catch(e){}},30)});mb.setAttribute('aria-expanded','false');
    more.appendChild(mb);
    const mbody=h('div','more-body');
    const skip={'match.map':1,'match.fighters':1,'match.mode':1,'match.players':1,'match.difficulty':1,'match.winTarget':1,'match.hazard':1,'match.length':1};
    Settings.def.filter(d=>d.section==='match'&&!skip[d.key]).forEach(d=>mbody.appendChild(mkRow(d,S.syncsSetup)));
    const rr=btn('ghost sm','Reset rules',()=>{Settings.reset('match');syncSetup();goMap(Math.max(0,MAP_ORDER.indexOf(Settings.get('match.map'))),false)},{sfx:'back'});rr.style.marginTop='10px';rr.style.width='100%';mbody.appendChild(rr);
    more.appendChild(mbody);rt.appendChild(more);
    sc.appendChild(lf);sc.appendChild(rt);
    panel.appendChild(sc);
    const foot=h('div','su-foot');
    const go=btn('red big shine','Start match',()=>{hook('startMatch',Settings.matchOptions())},{sfx:'start'});go.dataset.primary='1';S.els.goBtn=go;syncSetup();
    const gs=btn('ghost','',()=>openSettings(),{label:'Settings'});gs.appendChild(sv(IC.gear));gs.style.padding='.6em .9em';
    foot.appendChild(gs);foot.appendChild(go);panel.appendChild(foot);
    wrap.appendChild(panel);scr.appendChild(wrap);S.root.appendChild(scr);S.els.setup=scr;
  }
  function syncSetup(){for(const f of S.syncsSetup)try{f()}catch(e){}}

  /* ---------------------------------------------------------------------- HUD */
  function buildHud(){
    const scr=h('div','scr');scr.dataset.scr='game';
    const lb=h('div','labels');scr.appendChild(lb);S.els.labels=lb;
    const top=h('div','hud-top');
    const pb=h('button','hud-pause');pb.type='button';pb.setAttribute('aria-label','Pause');pb.dataset.sfx='click';pb.appendChild(sv(IC.pause));pb.addEventListener('click',()=>hook('pause'));
    const mid=h('div','hud-mid');
    const round=h('div','hud-round otl-s');S.els.roundA=h('span','','ROUND ');S.els.roundB=document.createElement('b');S.els.roundC=h('span','','');round.appendChild(S.els.roundA);round.appendChild(S.els.roundB);round.appendChild(S.els.roundC);
    const haz=h('div','hud-haz otl-s');haz.setAttribute('role','status');
    const bds=h('div','badges');
    mid.appendChild(round);mid.appendChild(haz);mid.appendChild(bds);
    top.appendChild(pb);top.appendChild(mid);top.appendChild(h('div','hud-spacer'));
    scr.appendChild(top);
    S.els.round=round;S.els.haz=haz;S.els.bds=bds;S.els.pause=pb;
    const ban=h('div','banner');ban.setAttribute('aria-live','assertive');scr.appendChild(ban);S.els.banner=ban;
    const kf=h('div','kf');scr.appendChild(kf);S.els.kf=kf;
    const edge=h('div','edge');scr.appendChild(edge);S.els.edge=edge;
    const pops=h('div','pops');pops.style.cssText='position:absolute;inset:0;pointer-events:none;overflow:hidden';scr.appendChild(pops);S.els.pops=pops;
    const fps=h('div','fps');scr.appendChild(fps);S.els.fps=fps;
    S.root.appendChild(scr);S.els.game=scr;
  }
  function buildBadges(view){
    const own=view.owners||[],loc=view.locals||[],solo=loc.length<2;
    const key=view.n+'|'+view.winTarget+'|'+view.names.join(',')+'|'+own.join('.')+'|'+view.colors.join('');
    if(S.bd.key===key)return;S.bd.key=key;S.bd.out=[];S.bd.cr=[];S.bd.el=[];
    const bds=S.els.bds;while(bds.firstChild)bds.removeChild(bds.firstChild);
    const wt=Math.max(1,view.winTarget|0);
    for(let i=0;i<view.n;i++){
      const isMe=loc.indexOf(i)>=0,isNet=own[i]==='remote';const b=h('div','bd'+(isMe?' you':'')+(isNet?' net':''));b.title=view.names[i];b.setAttribute('role','img');b.setAttribute('aria-label',view.names[i]+(isMe?' (player)':isNet?' (online player)':''));
      const c=h('div','bd-c',isMe?(solo?'YOU':'P'+(i+1)):(isNet?'P'+(i+1):String(i+1)));if(isMe&&solo)c.style.fontSize='.58em';c.style.background=view.colors[i];b.appendChild(c);
      const g=h('div','bd-g');g.appendChild(sv(GLY[i%8]));g.style.color=CREAM;b.appendChild(g);
      const p=h('div','bd-p');for(let k=0;k<wt;k++)p.appendChild(document.createElement('i'));b.appendChild(p);
      bds.appendChild(b);S.bd.el.push(b);
    }
  }
  function frame(view,dt){
    if(S.screen!=='game'||!view)return;
    // first run help (only when a human is playing)
    if(!S.helpOpen&&!S.helpFirst&&!S.pauseOpen&&view.humanId>=0&&(view.phase==='intro'||view.phase==='countdown')&&!Settings.flag('seenHelp')){
      S.helpFirst=true;hook('pause');
      if(S.helpFirst){S.helpFirst=false;S.firstHelpShown=true;showHelp()}
    }
    const L=S.last;
    buildBadges(view);
    const rt=view.round+'|'+view.winTarget;
    if(L.rt!==rt){L.rt=rt;S.els.roundB.textContent=String(view.round);S.els.roundC.textContent='  ·  FIRST TO '+view.winTarget}
    // hazard pill
    let ht='',cls='';
    if(view.hazard){ht=view.hazard.tag+(view.hazard.noTime?'':'  '+view.hazard.t.toFixed(1)+'s');cls=view.hazard.urgent?'urgent':''}
    else if(view.sudden){ht='SUDDEN DEATH';cls='sudden'}
    if(view.sudden&&view.hazard&&!view.hazard.urgent)cls='sudden';
    if(view.phase==='roundend'||view.phase==='matchend'||view.phase==='intro'&&!view.hazard)ht='';
    if(L.ht!==ht){L.ht=ht;S.els.haz.textContent=ht;S.els.haz.classList.toggle('on',!!ht)}
    if(L.hc!==cls){L.hc=cls;S.els.haz.classList.toggle('urgent',cls==='urgent');S.els.haz.classList.toggle('sudden',cls==='sudden')}
    // badges
    for(let i=0;i<view.n;i++){
      const out=!view.alive[i];
      if(S.bd.out[i]!==out){S.bd.out[i]=out;S.bd.el[i].classList.toggle('out',out)}
      const cr=view.crowns[i]|0;
      if(S.bd.cr[i]!==cr){S.bd.cr[i]=cr;const ps=S.bd.el[i].lastChild.children;for(let k=0;k<ps.length;k++)ps[k].classList.toggle('f',k<cr)}
    }
    // danger vignette
    const m=view.me,dang=!!(m&&view.humanId>=0&&m.alive&&m.stab<22&&view.phase==='fight');
    if(L.edge!==dang){L.edge=dang;S.els.edge.classList.toggle('on',dang&&!cfg('acc.reduceFlash',false))}
  }

  /* ---------------------------------------------------------- HUD transients */
  function clearEl(e){while(e.firstChild)e.removeChild(e.firstChild)}
  function banner(text,sub,ms,kind){
    if(!S.els.banner)return;
    clearEl(S.els.banner);clearTimeout(S.banT);
    const b=h('div','bn'+(kind?' '+kind:''));
    b.appendChild(h('div','bn-t otl',text));if(sub)b.appendChild(h('div','bn-s otl-s',sub));
    S.els.banner.appendChild(b);
    const life=ms||1200;
    S.banT=setTimeout(()=>{b.classList.add('out');setTimeout(()=>{if(b.parentNode)b.parentNode.removeChild(b)},320)},life);
  }
  function toast(text,ms){
    if(!S.els.game)return;
    if(S.els.toast&&S.els.toast.parentNode)S.els.toast.parentNode.removeChild(S.els.toast);
    clearTimeout(S.toastT);
    const t=h('div','ts otl-s',text);S.els.game.appendChild(t);S.els.toast=t;
    S.toastT=setTimeout(()=>{t.classList.add('out');setTimeout(()=>{if(t.parentNode)t.parentNode.removeChild(t)},420)},ms||3200);
  }
  function pop(text,x,y,kind){
    if(!S.els.pops||x===undefined||y===undefined||x!==x||y!==y)return;
    if(S.els.pops.children.length>9)S.els.pops.removeChild(S.els.pops.firstChild);
    const p=h('div','pp otl '+(kind||'hit'),text);p.style.left=(Math.max(.06,Math.min(.94,x))*100).toFixed(1)+'%';p.style.top=(Math.max(.1,Math.min(.9,y))*100).toFixed(1)+'%';
    S.els.pops.appendChild(p);setTimeout(()=>{if(p.parentNode)p.parentNode.removeChild(p)},1000);
  }
  function feed(nodes){
    const kf=S.els.kf;if(!kf)return;
    while(kf.children.length>=4)kf.removeChild(kf.firstChild);
    const it=h('div','kf-i');nodes.forEach(n=>it.appendChild(n));kf.appendChild(it);
    setTimeout(()=>{it.classList.add('out');setTimeout(()=>{if(it.parentNode)it.parentNode.removeChild(it)},420)},3400);
  }
  function nm(view,i,bold){const b=h('b','',(view.names[i]||('P'+(i+1))).toUpperCase());if(view.colors[i])b.style.color=view.colors[i];return b}
  const HITW={heavy:['BAM!','WHAM!','SMACK!'],critical:['KAPOW!','BOOM!','CRUSH!']};
  function onEvent(e,view,proj){
    if(S.screen!=='game'||!e)return;
    const loc=view.locals||[],solo=loc.length<2,me=solo&&loc.length?loc[0]:-9;
    switch(e.type){
      case 'roundStart':{
        clearEl(S.els.kf);
        banner('ROUND '+e.round,'First to '+view.winTarget+' round'+(view.winTarget>1?'s':'')+' wins',1500);
        const M=MAPS[view.map];if(M&&M.tips)toast(M.tips[(e.round-1)%M.tips.length],3800);
        break}
      case 'count':banner(String(e.n),'',820,'count');break;
      case 'go':banner('GO!','',800,'count white');break;
      case 'sudden':banner('SUDDEN DEATH!','The arena is closing in',2000,'red');break;
      case 'roundEnd':{
        if(e.winner>=0){const nmw=(view.names[e.winner]||'').toUpperCase();
          banner(e.winner===me?'YOU WIN THE ROUND!':nmw+' WINS THE ROUND',(e.crowns&&view.winTarget?(e.crowns[e.winner]|0)+' / '+view.winTarget+' crowns':''),2200,e.winner===me?'':'cyan')}
        else banner('DRAW!','Nobody left standing',2000,'red');
        break}
      case 'matchEnd':{
        if(e.winner>=0)banner(e.winner===me?'VICTORY!':(view.names[e.winner]||'').toUpperCase()+' IS CHAMPION',e.winner===me?'You are the champion!':'',3000);
        break}
      case 'hit':{
        if((e.tier==='critical'||(e.tier==='heavy'&&(e.src===me||e.dst===me||Math.random()<.4)))&&proj){const p=proj(e.x,1.6,e.z);if(p){const w=HITW[e.tier];pop(w[(Math.random()*w.length)|0],p.x,p.y-.04,e.tier==='critical'?'crit':'hit')}}
        break}
      case 'duck':if(e.id===me&&proj){const p=proj(e.x,1.6,e.z);if(p)pop('DUCKED!',p.x,p.y-.05,'good')}break;
      case 'fall':{
        const v=e.id,b=e.by;
        if(b!==undefined&&b>=0&&b!==v)feed([nm(view,b),h('span','',' knocked out '),nm(view,v)]);
        else feed([nm(view,v),h('span','',e.cause==='collapse'?' went down with the tiles':e.cause==='hole'?' fell in a crater':' fell off!')]);
        if(proj&&(solo?(b===me||v===me):false)){const p=proj(e.x,1.4,e.z);if(p)pop(v===me?'OUT!':'KO!',p.x,p.y,'ko')}
        break}
    }
  }
  /* -------------------------------------------------------------- name tags */
  function labels(list){
    const host=S.els.labels;if(!host)return;
    for(let k=0;k<list.length;k++){
      const d=list[k];let o=S.lb[d.id];
      if(!o){
        const el=h('div','lb');const n=h('div','lb-n');const gs=h('span');gs.style.display='contents';const nt=h('span');n.appendChild(gs);n.appendChild(nt);
        const bar=h('div','lb-bar');const f=h('span','lb-f');bar.appendChild(f);const ar=h('div','lb-arrow');
        el.appendChild(n);el.appendChild(bar);el.appendChild(ar);host.appendChild(el);
        gs.appendChild(sv(GLY[(d.glyph|0)%8]));
        o=S.lb[d.id]={el,n,nt,f,show:true,name:'',color:'',you:false,net:false,fill:-1,cls:'',tx:-1e9,ty:-1e9};
      }
      const show=!!d.show;
      if(o.show!==show){o.show=show;o.el.style.display=show?'':'none'}
      if(!show)continue;
      if(o.name!==d.name){o.name=d.name;o.nt.textContent=d.name}
      if(o.color!==d.color){o.color=d.color;o.el.style.setProperty('--lc',d.color);o.n.style.color=''}
      if(o.you!==!!d.you){o.you=!!d.you;o.el.classList.toggle('you',o.you)}
      if(o.net!==!!d.net){o.net=!!d.net;o.el.classList.toggle('net',o.net)}
      const x=Math.round(d.x),y=Math.round(d.y);
      if(x!==o.tx||y!==o.ty){o.tx=x;o.ty=y;o.el.style.transform='translate('+x+'px,'+y+'px) translate(-50%,-100%)'}
      const fill=Math.max(0,Math.min(100,d.stab===undefined?100:d.stab));
      const q=Math.round(fill/2);
      if(q!==o.fill){o.fill=q;o.f.style.transform='scaleX('+(q/50).toFixed(2)+')';const c=fill<30?'low':fill<60?'mid':'';if(c!==o.cls){o.cls=c;o.f.className='lb-f'+(c?' '+c:'')}}
    }
  }
  function setFps(n,auto){
    const e=S.els.fps;if(!e)return;const on=!!cfg('gfx.fps',false);
    if(!on){if(S.last.fpsOn!==false){S.last.fpsOn=false;e.style.display='none'}return}
    S.last.fpsOn=true;e.style.display='block';
    const t=n+' FPS'+(auto!==undefined&&auto<.995?'  \u00b7  AUTO '+Math.round(auto*100)+'%':'');
    if(S.last.fpsText!==t){S.last.fpsText=t;e.textContent=t}
  }

  /* -------------------------------------------------------- overlays: pause */
  function ovl(id,z){const o=h('div','ovl');o.dataset.ovl=id;if(z)o.style.zIndex=z;o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');S.root.appendChild(o);return o}
  function buildPause(){
    const o=ovl('pause',5);o.setAttribute('aria-label','Paused');
    const c=h('div','card panel');c.appendChild(h('h2','otl','Paused'));
    const st=h('div','stack');
    const rs=btn('big','Resume',()=>hook('resume'),{sfx:'start'});rs.dataset.primary='1';
    const rt=btn('blue','Restart match',()=>hook('restartMatch'));
    const se=btn('ghost','Settings',()=>openSettings());se.insertBefore(sv(IC.gear),se.firstChild);
    const hp=btn('ghost','How to play',()=>showHelp());hp.insertBefore(sv(IC.help),hp.firstChild);
    const qt=btn('red','Quit to title',()=>hook('quitToTitle'),{sfx:'back'});
    [rs,rt,se,hp,qt].forEach(b=>st.appendChild(b));c.appendChild(st);o.appendChild(c);S.els.pauseO=o;
  }
  function showPause(on){
    on=!!on;
    if(on&&S.helpFirst){S.helpFirst=false;S.firstHelpShown=true;S.pauseOpen=false;S.els.pauseO.classList.remove('on');showHelp();return}
    S.pauseOpen=on;S.els.pauseO.classList.toggle('on',on);
    if(on)focusPrimary(S.els.pauseO);
    if(!on){closeSettings(true);closeHelp(true)}
  }

  /* ------------------------------------------------------- overlays: settings */
  function buildSettings(){
    const o=ovl('settings',6);o.setAttribute('aria-label','Settings');
    const card=h('div','st-card panel');card.appendChild(h('h2','otl','Settings'));
    const tabs=h('div','tabs');tabs.setAttribute('role','tablist');S.els.tabs=[];
    Settings.sections.forEach(s=>{const t=h('button','tab');t.type='button';t.setAttribute('role','tab');t.dataset.sfx='select';
      if(IC[s.icon])t.appendChild(sv(IC[s.icon]));t.appendChild(h('span','',s.label));t.addEventListener('click',()=>{S.tab=s.id;renderSettings()});tabs.appendChild(t);S.els.tabs.push({el:t,id:s.id})});
    card.appendChild(tabs);
    S.els.stBody=h('div','st-body');card.appendChild(S.els.stBody);
    const foot=h('div','st-foot');
    const rs=btn('ghost sm','Reset section',()=>{Settings.reset(S.tab);renderSettings();syncSetup()},{sfx:'back'});
    const dn=btn('sm','Done',()=>closeSettings(),{sfx:'back'});dn.dataset.primary='1';
    foot.appendChild(rs);foot.appendChild(dn);card.appendChild(foot);
    o.appendChild(card);S.els.setO=o;
  }
  function renderSettings(){
    const body=S.els.stBody;clearEl(body);S.syncsSet=[];
    S.els.tabs.forEach(t=>{const on=t.id===S.tab;t.el.classList.toggle('on',on);t.el.setAttribute('aria-selected',on?'true':'false')});
    const defs=Settings.def.filter(d=>d.section===S.tab&&d.key!=='match.map');
    const hasAdv=defs.some(d=>d.adv);
    if(hasAdv){
      const adv=Settings.flag('showAdv');
      const r=h('div','row tg');const hd=h('div','row-h');hd.appendChild(h('span','row-l','Show advanced options'));
      const tg=h('button','tog'+(adv?' on':''));tg.type='button';tg.setAttribute('role','switch');tg.setAttribute('aria-checked',adv?'true':'false');tg.setAttribute('aria-label','Show advanced options');tg.dataset.sfx='toggle';
      tg.addEventListener('click',()=>{Settings.flag('showAdv',!Settings.flag('showAdv'));renderSettings()});
      hd.appendChild(tg);r.appendChild(hd);body.appendChild(r);
    }
    const showAdv=Settings.flag('showAdv');
    defs.forEach(d=>{if(d.adv&&!showAdv)return;body.appendChild(mkRow(d,S.syncsSet))});
    body.scrollTop=0;
  }
  function under(on){for(const o of [S.els.pauseO,S.els.setO])if(o)o.style.visibility='';if(on){if(S.helpOpen&&S.els.setO)S.els.setO.style.visibility='hidden';if((S.helpOpen||S.setOpen)&&S.els.pauseO)S.els.pauseO.style.visibility='hidden'}}
  function openSettings(sec){
    if(sec&&Settings.sections.some(s=>s.id===sec))S.tab=sec;
    renderSettings();S.setOpen=true;S.els.setO.classList.add('on');under(true);focusPrimary(S.els.setO,'.tab.on');
  }
  function closeSettings(quiet){
    if(!S.setOpen)return;S.setOpen=false;S.els.setO.classList.remove('on');under(true);
    if(!quiet){syncSetup();if(S.pauseOpen)focusPrimary(S.els.pauseO)}
  }

  /* ------------------------------------------------------------ overlays: help */
  function buildHelp(){
    const o=ovl('help',7);o.setAttribute('aria-label','How to play');
    const c=h('div','card panel');c.appendChild(h('h2','otl','How to play'));
    const steps=[['move','Drag to move','Touch and drag on the left of the screen. The stick appears under your thumb.'],
      ['fist','Hold BASH, then release','Hold to charge the ring, let go to strike. A full charge sends rivals flying.'],
      ['bolt','DASH to rush in','A quick shoulder charge. It recharges fast and ducks under spinning arms.'],
      ['trophy','Be the last sumo standing','Knock rivals off the arena. Watch the hazard timer at the top: every map fights back in its own way.']];
    steps.forEach(s=>{const r=h('div','help-step');const ic=h('div','help-ic');ic.appendChild(sv(IC[s[0]]));const tx=h('div');tx.appendChild(h('div','help-t',s[1]));tx.appendChild(h('div','help-d',s[2]));r.appendChild(ic);r.appendChild(tx);c.appendChild(r)});
    c.appendChild(h('div','desc','Keyboard: WASD or arrows to move, Space = BASH, Shift = DASH, Esc = pause. Gamepad: left stick, A = BASH, B = DASH, Start = pause.'));
    const ok=btn('big','Got it',()=>closeHelp(),{sfx:'start'});ok.dataset.primary='1';ok.style.width='100%';ok.style.marginTop='12px';c.appendChild(ok);
    o.appendChild(c);S.els.helpO=o;
  }
  function showHelp(){S.helpOpen=true;S.els.helpO.classList.add('on');under(true);focusPrimary(S.els.helpO)}
  function closeHelp(quiet){
    if(!S.helpOpen)return;S.helpOpen=false;S.els.helpO.classList.remove('on');under(true);
    try{Settings.flag('seenHelp',true)}catch(e){}
    if(S.firstHelpShown&&!quiet){S.firstHelpShown=false;hook('resume')}
    else if(S.pauseOpen&&!quiet)focusPrimary(S.els.pauseO);
  }

  /* ----------------------------------------------------------------- results */
  function buildResults(){
    const scr=h('div','scr');scr.dataset.scr='results';
    const w=h('div','rs-wrap');S.els.rsWrap=w;
    const card=h('div','rs-card panel');S.els.rsCard=card;w.appendChild(card);scr.appendChild(w);S.root.appendChild(scr);S.els.results=scr;
  }
  /* The results screen shows what core/cup.js decided: res.ranking (one match) or res.cup.standings (Crown Cup).
     Order, shared places and champions are never worked out here, so the podium cannot disagree with the rules. */
  function rankFallback(res){
    const idx=[];for(let i=0;i<res.n;i++)idx.push(i);
    idx.sort((a,b)=>((b===res.winner)-(a===res.winner))||((res.crowns[b]|0)-(res.crowns[a]|0))||a-b);
    return idx.map((id,k)=>({id,rank:k+1,tied:false,crowns:res.crowns[id]|0}));
  }
  function showResults(res){
    show('results',true);
    const card=S.els.rsCard;clearEl(card);
    const old=S.els.rsWrap.querySelectorAll('.cf');old.forEach(e=>e.parentNode.removeChild(e));
    const C=res.cup||null,n=res.n,names=res.names,colors=res.colors,st=res.stats||[];
    const loc=res.locals||[],own=res.owners||[];
    const solo=loc.length===1,me=solo?loc[0]:-9;                     // exactly one person here: talk to them as "you"
    const nm=i=>(names[i]||('P'+(i+1))).toUpperCase();
    const isLoc=i=>loc.indexOf(i)>=0;
    const rows=C?C.standings.map(r=>({id:r.id,rank:r.rank,tied:r.tied,score:r.points,wins:r.wins,kos:r.kos})):(res.ranking||rankFallback(res)).map(r=>({id:r.id,rank:r.rank,tied:r.tied,score:r.crowns}));
    const champs=C&&C.last?(C.champs||[]):[];
    const decided=C?!!C.last:res.winner>=0;
    let title;
    if(C&&C.last){
      if(champs.length===1)title=champs[0]===me?'Cup champion!':nm(champs[0])+' wins the cup!';
      else if(champs.length===2)title=(champs.indexOf(me)>=0?'You':nm(champs[0]))+' & '+(champs.indexOf(me)>=0?nm(champs[champs[0]===me?1:0]):nm(champs[1]))+' share the cup!';
      else title=champs.length+' fighters share the cup!';
    }else if(C)title='Arena '+C.stage+' of '+C.stages;
    else if(res.winner<0)title='Draw!';
    else title=res.winner===me?'Victory!':nm(res.winner)+' wins!';
    card.appendChild(h('div','rs-h otl',title));
    const M=MAPS[res.map];
    const arenaWinner=res.winner>=0?(res.winner===me?'You won this arena':nm(res.winner)+' won this arena'):'Draw';
    card.appendChild(h('div','rs-sub',C&&!C.last?((M?M.name:'')+'  ·  '+arenaWinner+'  ·  next: '+(MAPS[C.next]?MAPS[C.next].name:'')):((M?M.name:'')+'  ·  '+(DIFF_LABEL[res.difficulty]||res.difficulty)+(C?'  ·  Crown Cup':'  ·  '+res.round+' round'+(res.round===1?'':'s')))));
    // podium: the first three rows; equal ranks stand level
    const top=rows.slice(0,Math.min(3,n));
    const pod=h('div','pod');
    const disp=top.length>=3?[1,0,2]:top.length===2?[1,0]:[0];
    disp.forEach(pos=>{
      const r=top[pos],i=r.id,c=h('div','pod-c p'+Math.min(3,r.rank));
      const f=h('div','pod-f',isLoc(i)?(solo?'YOU':'P'+(i+1)):(own[i]==='remote'?'P'+(i+1):String(i+1)));if(isLoc(i)&&solo)f.style.fontSize='.8em';f.style.background=colors[i];
      if(r.rank===1&&decided){const cw=sv(IC.crown);cw.setAttribute('class','pod-crown');f.appendChild(cw)}
      c.appendChild(f);c.appendChild(h('div','pod-n otl-s',nm(i)));
      const s=h('div','pod-s',String(r.score|0));s.appendChild(h('small','',C?'points':'crowns'));c.appendChild(s);pod.appendChild(c);
    });
    card.appendChild(pod);
    // awards
    const aw=h('div','awards');
    const best=(key,label,min)=>{let bi=-1,bv=min||0;for(let i=0;i<n;i++){const v=+(st[i]&&st[i][key])||0;if(v>bv){bv=v;bi=i}}if(bi>=0){const c=h('span','chip gold',label+': '+nm(bi)+(key==='best'?'':' ('+Math.round(bv)+')'));aw.appendChild(c)}};
    best('kos','Most KOs',0);best('best','Hardest hit',0);best('falls','Most falls',0);best('dmg','Most damage',0);
    if(aw.children.length)card.appendChild(aw);
    // table, in rank order
    const tb=document.createElement('table');tb.className='stats';
    const th=document.createElement('tr');(C?['#','Fighter','Total','+Arena','Wins','KOs']:['#','Fighter','Crowns','KOs','Hits','Falls']).forEach(t=>{const e=document.createElement('th');e.textContent=t;th.appendChild(e)});tb.appendChild(th);
    rows.forEach(r=>{
      const i=r.id,tr=document.createElement('tr');if(isLoc(i))tr.className='me';
      const t0=document.createElement('td');t0.className='rk';t0.textContent=r.rank+(r.tied?'=':'');tr.appendChild(t0);
      const t1=document.createElement('td');const dc=h('span','dotc');dc.style.background=colors[i];t1.appendChild(dc);t1.appendChild(document.createTextNode(nm(i)));tr.appendChild(t1);
      const s=st[i]||{};(C?[r.score|0,'+'+((C.gain&&C.gain[i])|0),r.wins|0,r.kos|0]:[r.score|0,s.kos|0,s.hits|0,s.falls|0]).forEach(v=>{const e=document.createElement('td');e.textContent=String(v);tr.appendChild(e)});
      tb.appendChild(tr);
    });
    card.appendChild(tb);
    const bt=h('div','rs-btns');
    if(C&&!C.last){
      const nx=btn('','Next arena',()=>hook('nextStage'),{sfx:'start'});nx.dataset.primary='1';
      const ti=btn('ghost','Quit cup',()=>hook('quitToTitle'),{sfx:'back'});bt.appendChild(nx);bt.appendChild(ti);
    }else if(C){
      const ag=btn('','New cup',()=>{hook('quitToTitle');show('setup')},{sfx:'start'});ag.dataset.primary='1';
      const ti=btn('ghost','Title',()=>hook('quitToTitle'),{sfx:'back'});bt.appendChild(ag);bt.appendChild(ti);
    }else{
      const rm1=btn('','Rematch',()=>hook('rematch'),{sfx:'start'});rm1.dataset.primary='1';
      const ch=btn('blue','Change map',()=>{hook('quitToTitle');show('setup')});
      const ti=btn('ghost','Title',()=>hook('quitToTitle'),{sfx:'back'});
      bt.appendChild(rm1);bt.appendChild(ch);bt.appendChild(ti);
    }
    card.appendChild(bt);
    if(res.career&&solo){const t=careerText(res.career);if(t){const cl=h('div','rs-career',t);card.appendChild(cl)}}
    if(res.seed!==undefined&&res.seed!==null)card.appendChild(h('div','rs-seed','SEED '+(res.seed>>>0)+'  ·  v'+VERSIONS.build));
    if(!rm()&&decided){
      const cols=[GOLD,'#e8384f','#35d0e8','#fff4d6'].concat(colors.slice(0,4));
      for(let i=0;i<36;i++){const c=h('div','cf');c.style.left=(Math.random()*100).toFixed(1)+'%';c.style.background=cols[i%cols.length];c.style.animationDuration=(2.6+Math.random()*2.4).toFixed(2)+'s';c.style.animationDelay=(-Math.random()*4).toFixed(2)+'s';c.style.width=(6+Math.random()*7|0)+'px';c.style.height=(8+Math.random()*9|0)+'px';S.els.rsWrap.appendChild(c)}
    }
    focusPrimary(S.els.results);
  }

  /* ------------------------------------------------------------- flow control */
  function focusPrimary(root,sel){
    try{if(typeof Controls!=='undefined'&&Controls.isTouch)return;const t=root.querySelector(sel||'[data-primary]')||root.querySelector('button');if(t)setTimeout(()=>{try{t.focus({preventScroll:true})}catch(e){t.focus()}},30)}catch(e){}
  }
  function show(name,keep){
    S.screen=name;hook('screen',name);
    for(const k of['title','setup','game','results'])if(S.els[k])S.els[k].classList.toggle('on',k===name);
    if(typeof Controls!=='undefined')try{Controls.setVisible(name==='game')}catch(e){}
    if(!keep){S.pauseOpen=false;if(S.els.pauseO)S.els.pauseO.classList.remove('on');closeSettings(true);S.helpOpen=false;if(S.els.helpO)S.els.helpO.classList.remove('on')}
    if(name==='game'){
      clearEl(S.els.banner);clearEl(S.els.kf);clearEl(S.els.pops);if(S.els.toast&&S.els.toast.parentNode)S.els.toast.parentNode.removeChild(S.els.toast);
      S.bd.key='';S.last={fpsOn:S.last.fpsOn};
      S.els.edge.classList.remove('on');
      for(const k in S.lb){S.lb[k].el.parentNode&&S.lb[k].el.parentNode.removeChild(S.lb[k].el)}S.lb={};
    }
    if(name==='setup'){
      syncSetup();const i=Math.max(0,MAP_ORDER.indexOf(Settings.get('match.map')));
      setTimeout(()=>{goMap(i,false);hook('previewMap',MAP_ORDER[i])},0);
      focusPrimary(S.els.setup);
    }
    if(name==='title')focusPrimary(S.els.title);
  }
  function isOpen(){return S.screen!=='game'||S.pauseOpen||S.setOpen||S.helpOpen}
  function applyAcc(){
    const r=S.root;if(!r)return;
    r.classList.toggle('rm',!!cfg('acc.reduceMotion',false));
    r.classList.toggle('hc',!!cfg('acc.highContrast',false));
    r.classList.toggle('cb',!!cfg('acc.colorblind',false));
    r.classList.toggle('xl',cfg('acc.textSize','normal')==='large');
    r.classList.toggle('nobars',!cfg('gfx.stabbars',true));
    r.classList.toggle('nonames',!cfg('gfx.names',true));
    if(S.els.fps&&!cfg('gfx.fps',false)){S.els.fps.style.display='none';S.last.fpsOn=false}
  }
  function onKey(e){
    if(e.key!=='Escape'&&!(e.key==='p'&&S.pauseOpen&&!S.setOpen&&!S.helpOpen))return;
    if(S.helpOpen){e.stopImmediatePropagation();e.preventDefault();closeHelp();sfx('back');return}
    if(S.setOpen){e.stopImmediatePropagation();e.preventDefault();closeSettings();sfx('back');return}
    if(S.pauseOpen&&S.screen==='game'){e.stopImmediatePropagation();e.preventDefault();hook('resume');return}
    if(S.screen==='setup'){e.stopImmediatePropagation();e.preventDefault();show('title');sfx('back');return}
    if(S.screen==='results'){e.stopImmediatePropagation();e.preventDefault();hook('quitToTitle');sfx('back');return}
    if(S.screen==='title'){e.stopImmediatePropagation()}
  }
  function init(o){
    S.root=o.root;S.hooks=o.hooks||{};S.slots=o.slots||null;S.session=1;
    S.root.classList.add('ui-root');
    buildTitle();buildSetup();buildHud();buildResults();buildPause();buildSettings();buildHelp();
    // click sounds by delegation
    S.root.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(!b)return;if(b.dataset.sfx)sfx(b.dataset.sfx);else if(!b.classList.contains('hud-pause'))sfx('click')},true);
    addEventListener('keydown',onKey,true);
    try{Settings.on((k,v)=>{applyAcc();if(!S.busy){syncSetup();for(const f of S.syncsSet)try{f()}catch(e){}}})}catch(e){}
    applyAcc();
    // pre-set carousel to saved map
    S.mapIdx=Math.max(0,MAP_ORDER.indexOf(Settings.get('match.map')));
    if(S.els.dots)S.els.dots.forEach((d,k)=>d.classList.toggle('on',k===S.mapIdx));
  }
  function startSession(){S.session++}

  return {init,setCareer,show,showPause,openSettings,showHelp,frame,onEvent,showResults,pop,banner,toast,labels,setFps,isOpen,startSession,
    get screen(){return S.screen}};
})();
