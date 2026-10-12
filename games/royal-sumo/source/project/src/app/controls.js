/* ============================================================================
   ROYAL SUMO - CONTROLS  (touch stick + BASH/DASH, keyboard, gamepad -> one input)
   ========================================================================== */
import {clamp} from '../core/util.js';
import {Settings} from '../core/settings.js';
export const Controls=(function(){
  const S={visible:false,active:true,root:null,hooks:null,isTouch:false,keys:{},dashPulse:false,pauseEdge:false,
    stick:{id:-1,bx:0,by:0,x:0,y:0,on:false},bashIds:new Set(),bashTouch:false,hud:{charge:0,chargeFull:false,dashCd01:1,dashOn:true,bashReady:true,alive:true,active:true},
    gp:{dash:false,pause:false},last:{mx:0,mz:0}};
  const el={};
  const cfg=(k,d)=>{try{if(typeof Settings!=='undefined'){const v=Settings.get(k);if(v!==undefined)return v}}catch(e){}return d};
  const SVG_FIST='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 22c0-3 2-5 5-5h1c1-2 3-3 5-3s4 1 5 3c3-1 6 1 6 4v6c0 6-4 10-10 10h-3c-5 0-9-4-9-9z" fill="currentColor" stroke="#150a26" stroke-width="2.5" stroke-linejoin="round"/><path d="M19 20v6M25 19v7M31 21v5" stroke="#150a26" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const SVG_BOLT='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M27 5 11 27h9l-3 16 18-24h-10z" fill="currentColor" stroke="#150a26" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  function mk(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html)e.innerHTML=html;return e}

  function build(){
    const c=mk('div','ct');c.setAttribute('aria-hidden','true');
    el.zone=mk('div','ct-zone');
    el.base=mk('div','ct-base');el.knob=mk('div','ct-knob');el.base.appendChild(el.knob);
    el.bash=mk('button','ct-btn ct-bash','<svg class="ct-ring" viewBox="0 0 100 100"><circle class="ct-ring-bg" cx="50" cy="50" r="46"/><circle class="ct-ring-fg" cx="50" cy="50" r="46" transform="rotate(-90 50 50)"/></svg><span class="ct-ico">'+SVG_FIST+'</span><span class="ct-lbl">BASH</span>');
    el.dash=mk('button','ct-btn ct-dash','<span class="ct-cd"></span><span class="ct-ico">'+SVG_BOLT+'</span><span class="ct-lbl">DASH</span>');
    el.bash.setAttribute('aria-label','Bash: hold to charge, release to strike');el.dash.setAttribute('aria-label','Dash');
    el.bash.tabIndex=-1;el.dash.tabIndex=-1;
    el.hint=mk('div','ct-hint','<b>WASD</b> / arrows move &nbsp; <b>Space</b> hold to charge BASH &nbsp; <b>Shift</b> DASH &nbsp; <b>Esc</b> pause');
    el.ring=el.bash.querySelector('.ct-ring-fg');el.cd=el.dash.querySelector('.ct-cd');
    c.appendChild(el.zone);c.appendChild(el.base);c.appendChild(el.bash);c.appendChild(el.dash);c.appendChild(el.hint);
    S.root.insertBefore(c,S.root.firstChild);el.c=c;
    el.ring.style.strokeDasharray='289';el.ring.style.strokeDashoffset='289';
  }
  function pos(e){return {x:e.clientX,y:e.clientY}}
  function stickMove(x,y){
    const s=S.stick,R=stickR();let dx=x-s.bx,dy=y-s.by;const d=Math.hypot(dx,dy);
    if(d>R){dx*=R/d;dy*=R/d}
    s.x=dx/R;s.y=dy/R;
    el.knob.style.transform='translate('+(dx).toFixed(1)+'px,'+(dy).toFixed(1)+'px)';
  }
  function stickR(){return 52*cfg('ctl.stickSize',1)}
  function bindTouch(){
    const z=el.zone;
    z.addEventListener('pointerdown',e=>{
      if(!S.visible||S.stick.id!==-1)return;
      if(e.pointerType==='touch'&&!S.isTouch){S.isTouch=true;Controls.isTouch=true;Controls.layout()}
      const swap=cfg('ctl.swap',false),W=innerWidth,H=innerHeight;
      const inHalf=swap?e.clientX>W*.42:e.clientX<W*.58;
      if(!inHalf||e.clientY<H*.2)return;
      e.preventDefault();z.setPointerCapture&&z.setPointerCapture(e.pointerId);
      const s=S.stick;s.id=e.pointerId;s.on=true;
      if(cfg('ctl.stick','float')==='float'){s.bx=e.clientX;s.by=e.clientY;placeBase(s.bx,s.by)}
      else{const r=el.base.getBoundingClientRect();s.bx=r.left+r.width/2;s.by=r.top+r.height/2}
      el.base.classList.add('on');stickMove(e.clientX,e.clientY);
    });
    z.addEventListener('pointermove',e=>{if(e.pointerId===S.stick.id){e.preventDefault();stickMove(e.clientX,e.clientY)}});
    const end=e=>{
      if(e.pointerId!==S.stick.id)return;
      const s=S.stick;s.id=-1;s.on=false;s.x=0;s.y=0;el.knob.style.transform='translate(0,0)';el.base.classList.remove('on');
      if(cfg('ctl.stick','float')==='float'){el.base.classList.add('idle');el.base.style.left='';el.base.style.top=''}
    };
    z.addEventListener('pointerup',end);z.addEventListener('pointercancel',end);z.addEventListener('lostpointercapture',end);
    // BASH
    const bd=e=>{e.preventDefault();e.stopPropagation();el.bash.setPointerCapture&&el.bash.setPointerCapture(e.pointerId);S.bashIds.add(e.pointerId);el.bash.classList.add('down');if(e.pointerType==='touch'&&!S.isTouch){S.isTouch=true;Controls.isTouch=true;Controls.layout()}};
    const bu=e=>{S.bashIds.delete(e.pointerId);if(!S.bashIds.size)el.bash.classList.remove('down')};
    el.bash.addEventListener('pointerdown',bd);el.bash.addEventListener('pointerup',bu);el.bash.addEventListener('pointercancel',bu);el.bash.addEventListener('lostpointercapture',bu);
    // DASH
    el.dash.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();S.dashPulse=true;el.dash.classList.add('down');el.dash.setPointerCapture&&el.dash.setPointerCapture(e.pointerId)});
    const du=()=>el.dash.classList.remove('down');
    el.dash.addEventListener('pointerup',du);el.dash.addEventListener('pointercancel',du);el.dash.addEventListener('lostpointercapture',du);
    for(const b of[el.bash,el.dash]){b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('touchstart',e=>e.preventDefault(),{passive:false})}
    z.addEventListener('contextmenu',e=>e.preventDefault());
  }
  function placeBase(x,y){el.base.style.left=x+'px';el.base.style.top=y+'px';el.base.classList.remove('idle')}
  function bindKeys(){
    addEventListener('keydown',e=>{
      if(!S.visible)return;
      if(e.target&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ'].includes(e.code))e.preventDefault();
      if(e.repeat)return;
      S.keys[e.code]=true;
      if(e.code==='ShiftLeft'||(e.code==='ShiftRight'&&!S.split)||e.code==='KeyK'||e.code==='KeyL')S.dashPulse=true;
      if(e.code==='Escape'||e.code==='KeyP')S.pauseEdge=true;
    });
    addEventListener('keyup',e=>{S.keys[e.code]=false});
    addEventListener('blur',()=>{S.keys={}});
  }
  function layout(){
    if(!el.c)return;
    const swap=cfg('ctl.swap',false),bs=cfg('ctl.btnSize',1),ss=cfg('ctl.stickSize',1),op=cfg('ctl.opacity',.85),show=cfg('ctl.showButtons','auto');
    const vis=S.visible&&S.active&&(show==='on'||(show==='auto'&&S.isTouch));
    const c=el.c;
    c.classList.toggle('swap',swap);c.classList.toggle('show',vis);c.classList.toggle('fixed',cfg('ctl.stick','float')==='fixed');
    c.classList.toggle('desk',S.visible&&!S.isTouch&&show==='auto');
    c.style.setProperty('--bs',String(bs));c.style.setProperty('--ss',String(ss));c.style.setProperty('--op',String(op));
    el.zone.style.pointerEvents=S.visible&&vis?'auto':'none';
    el.bash.style.pointerEvents=vis?'auto':'none';el.dash.style.pointerEvents=vis?'auto':'none';
    if(cfg('ctl.stick','float')==='float'&&!S.stick.on)el.base.classList.add('idle');else if(cfg('ctl.stick','float')==='fixed')el.base.classList.remove('idle');
  }
  function pollPad(out){
    let pad=null;
    try{const l=navigator.getGamepads?navigator.getGamepads():[];for(const g of l)if(g&&g.connected){pad=g;break}}catch(e){}
    if(!pad)return;
    const dz=Math.max(.15,cfg('ctl.deadzone',.08));
    let x=pad.axes[0]||0,y=pad.axes[1]||0;const m=Math.hypot(x,y);
    if(m>dz){const k=Math.min(1,(m-dz)/(1-dz))/m;out.gx=x*k;out.gz=y*k}
    const B=i=>!!(pad.buttons[i]&&pad.buttons[i].pressed);
    out.gbash=B(0)||B(2);
    const dash=B(1)||B(3)||B(5)||B(7);if(dash&&!S.gp.dash)S.dashPulse=true;S.gp.dash=dash;
    const pa=B(9);if(pa&&!S.gp.pause)S.pauseEdge=true;S.gp.pause=pa;
  }
  const api={
    isTouch:false,
    setSplit(on){S.split=!!on;if(el.hint)el.hint.innerHTML=on?'<b>P1</b> WASD + Space (BASH) + Shift &nbsp; <b>P2</b> arrows + Enter (BASH) + Right Shift &nbsp; <b>Esc</b> pause':'<b>WASD</b> / arrows move &nbsp; <b>Space</b> hold to charge BASH &nbsp; <b>Shift</b> DASH &nbsp; <b>Esc</b> pause'},
    init(root,hooks){
      S.root=root;S.hooks=hooks||{};
      try{S.isTouch=('ontouchstart' in window)||(navigator.maxTouchPoints>0)||(window.matchMedia&&matchMedia('(pointer:coarse)').matches)}catch(e){}
      api.isTouch=S.isTouch;
      build();bindTouch();bindKeys();layout();
      addEventListener('resize',layout);
    },
    update(dt){
      const k=S.keys,out={gx:0,gz:0,gbash:false};
      if(S.visible)pollPad(out);
      const ar=!S.split;let kx=(k.KeyD||(ar&&k.ArrowRight)?1:0)-(k.KeyA||(ar&&k.ArrowLeft)?1:0),kz=(k.KeyS||(ar&&k.ArrowDown)?1:0)-(k.KeyW||(ar&&k.ArrowUp)?1:0);
      const kl=Math.hypot(kx,kz);if(kl>1){kx/=kl;kz/=kl}
      let mx=kx,mz=kz;
      const s=S.stick;
      if(s.on){
        const dz=cfg('ctl.deadzone',.08),m=Math.hypot(s.x,s.y);
        if(m>dz){const kk=Math.min(1,(m-dz)/(1-dz))/m;mx=s.x*kk;mz=s.y*kk}else{mx=0;mz=0}
      }else if(!kx&&!kz){mx=out.gx;mz=out.gz}
      const ml=Math.hypot(mx,mz);if(ml>1){mx/=ml;mz/=ml}
      const bash=!!(k.Space||k.KeyJ)||S.bashIds.size>0||out.gbash;
      const dash=S.dashPulse;S.dashPulse=false;
      if(S.pauseEdge){S.pauseEdge=false;if(S.visible&&S.hooks.pause)S.hooks.pause()}
      S.last.mx=mx;S.last.mz=mz;
      return {mx,mz,bashDown:bash&&S.visible&&S.active,dash:dash&&S.visible&&S.active};
    },
    setHud(h){
      const H=S.hud;
      if(h.charge!==H.charge||h.chargeFull!==H.chargeFull){
        H.charge=h.charge;H.chargeFull=h.chargeFull;
        el.ring.style.strokeDashoffset=String((289*(1-clamp(h.charge,0,1))).toFixed(1));
        el.bash.classList.toggle('full',!!h.chargeFull);el.bash.classList.toggle('charging',h.charge>.02);
      }
      const cd=h.dashOn===false?1:clamp(1-h.dashCd01,0,1);
      if(cd!==H.cdr){H.cdr=cd;el.cd.style.setProperty('--cd',(cd*360).toFixed(0)+'deg');el.dash.classList.toggle('ready',cd<=0.001);}
      if(h.dashOn!==H.dashOn){H.dashOn=h.dashOn;el.dash.classList.toggle('off',h.dashOn===false)}
      if(h.active!==S.active||h.alive!==H.alive){S.active=h.active;H.alive=h.alive;layout()}
    },
    setVisible(v){S.visible=!!v;layout();if(!v){S.stick.on=false;S.stick.id=-1;S.bashIds.clear();S.keys={}}},
    haptic(kind){
      if(!cfg('ctl.haptics',true)||!S.isTouch)return;
      const p={light:[8],medium:[16],heavy:[30],ko:[20,40,70],win:[30,60,30,60,120]}[kind];
      try{if(p&&navigator.vibrate)navigator.vibrate(p)}catch(e){}
    },
    layout
  };
  return api;
})();
