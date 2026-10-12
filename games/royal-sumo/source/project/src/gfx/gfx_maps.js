/* ============================================================================
   ROYAL SUMO - SCENES part 1: themes, mesh library, Scene base, KEEP / FLOE / PLAZA
   Camera looks from +Z toward -Z, so the "back" of the set is z<0.
   ========================================================================== */
import {TAU, angDiff, clamp, lerp, mulberry32, smooth} from '../core/util.js';
import {MAX_PLAYERS} from '../core/tune.js';
import {Batch, M4, MB, PR} from './engine.js';
import {SPR} from './gfx_fx.js';
export const mT=(x,y,z,sx,sy,sz)=>{const o=new Float32Array(16);M4.trs(o,0,x,y,z,0,0,0,sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz);return o};
export const mTR=(x,y,z,yaw,pitch,roll,sx,sy,sz)=>{const o=new Float32Array(16);M4.trs(o,0,x,y,z,yaw,pitch,roll,sx===undefined?1:sx,sy===undefined?1:sy,sz===undefined?1:sz);return o};
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function nrm3(v){const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]}
function recomputeNormals(m){
  m.fixWinding();const P=m.p,N=m.n,I=m.idx;N.fill(0);
  for(let t=0;t<I.length;t+=3){
    const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3;
    const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    for(const k of[a,b,c]){N[k]+=nx;N[k+1]+=ny;N[k+2]+=nz}
  }
  for(let i=0;i<N.length;i+=3){const l=Math.hypot(N[i],N[i+1],N[i+2])||1;N[i]/=l;N[i+1]/=l;N[i+2]/=l}
  return m;
}
function rockMB(seed,segs,rings,col){
  const m=PR.sphere(1,segs||7,rings||5,col||[1,1,1]);m.fixWinding();
  for(let i=0;i<m.p.length;i+=3){
    const h=Math.sin(m.p[i]*12.9898+m.p[i+1]*78.233+m.p[i+2]*37.719+seed)*43758.5453,d=.74+.4*(h-Math.floor(h));
    m.p[i]*=d;m.p[i+1]*=d*.9;m.p[i+2]*=d;
  }
  return recomputeNormals(m);
}

/* ------------------------------------------------------------------ themes -- */
const THEMES={
  keep:{sky:{mode:0,top:[.10,.07,.26],mid:[.50,.20,.40],hor:[1,.52,.28],low:[.2,.07,.07],sun:[-.35,.14,-1],sunc:[1,.6,.3]},
    fog:{color:'#6e2c3c',start:26,end:64,amt:.6},light:{dir:[.35,.85,.4],col:[1,.9,.78],amb:[.44,.37,.5],gnd:[.34,.2,.22],rim:[1,.5,.35]},
    liquid:{mode:0,y:-5,a:[.26,.04,.02],b:[.62,.14,.03],c:[1,.58,.13],d:[1,.4,.05]},outlineW:.03,outlineCol:[.06,.02,.04],dust:[.82,.74,.68]},
  floe:{sky:{mode:1,top:[.03,.06,.2],mid:[.09,.22,.42],hor:[.55,.78,.9],low:[.1,.2,.3],sun:[.4,.25,-1],sunc:[.85,.95,1]},
    fog:{color:'#b4d8ec',start:24,end:70,amt:.55},light:{dir:[.3,.9,.35],col:[.9,.95,1],amb:[.55,.64,.8],gnd:[.34,.46,.6],rim:[.6,.9,1]},
    liquid:{mode:1,y:-.55,a:[.05,.2,.35],b:[.13,.42,.62],c:[.7,.95,1],d:[.92,1,1]},outlineW:.03,outlineCol:[.04,.1,.2],dust:[.95,.98,1]},
  plaza:{sky:{mode:2,top:[.06,.02,.15],mid:[.22,.05,.38],hor:[.75,.16,.62],low:[.05,.02,.12],sun:[0,.1,-1],sunc:[1,.3,.8]},
    fog:{color:'#2f1252',start:26,end:70,amt:.65},light:{dir:[.2,.9,.4],col:[1,.88,1],amb:[.52,.4,.72],gnd:[.27,.17,.42],rim:[1,.4,.9]},
    liquid:{mode:2,y:-4,a:[.02,.01,.08],b:[.1,.03,.22],c:[1,.2,.7],d:[.2,.9,1]},outlineW:.03,outlineCol:[.03,.0,.08],dust:[.85,.8,.95]},
  wharf:{sky:{mode:3,top:[.22,.27,.58],mid:[.88,.5,.5],hor:[1,.72,.42],low:[.4,.3,.35],sun:[-.5,.1,-1],sunc:[1,.85,.5]},
    fog:{color:'#e89a70',start:26,end:70,amt:.5},light:{dir:[-.4,.75,.5],col:[1,.88,.68],amb:[.58,.5,.58],gnd:[.38,.3,.32],rim:[1,.7,.4]},
    liquid:{mode:3,y:-.9,a:[.1,.26,.42],b:[.22,.48,.62],c:[1,.85,.6],d:[1,.95,.85]},outlineW:.03,outlineCol:[.1,.04,.03],dust:[.9,.8,.65]},
  teeter:{sky:{mode:4,top:[.08,.14,.2],mid:[.22,.38,.3],hor:[.78,.68,.4],low:[.05,.1,.08],sun:[.3,.15,-1],sunc:[1,.8,.4]},
    fog:{color:'#3d5538',start:24,end:64,amt:.55},light:{dir:[.35,.85,.4],col:[1,.93,.72],amb:[.42,.52,.42],gnd:[.22,.3,.22],rim:[.9,.9,.4]},
    liquid:{mode:4,y:-5,a:[.03,.1,.06],b:[.1,.26,.12],c:[.5,1,.5],d:[.4,.8,.3]},outlineW:.03,outlineCol:[.03,.07,.03],dust:[.75,.8,.6]},
  mesa:{sky:{mode:5,top:[.02,.03,.12],mid:[.16,.1,.3],hor:[.88,.42,.3],low:[.15,.07,.07],sun:[-.4,.15,-1],sunc:[.9,.9,1]},
    fog:{color:'#7a4040',start:26,end:70,amt:.55},light:{dir:[-.3,.8,.5],col:[.98,.86,.78],amb:[.47,.42,.57],gnd:[.32,.22,.22],rim:[1,.6,.4]},
    liquid:{mode:5,y:-6.5,a:[.12,.05,.05],b:[.3,.14,.1],c:[1,.45,.15],d:[1,.5,.2]},outlineW:.03,outlineCol:[.09,.03,.03],dust:[.9,.72,.55]}
};
for(const k in THEMES){const t=THEMES[k];t.light.dir=nrm3(t.light.dir)}

/* ------------------------------------------------------- shared mesh lib -- */
function makeSceneLib(gl){
  const W=[1,1,1],L={};
  L.box=PR.box(1,1,1,W).build(gl);
  L.cyl=PR.cyl(1,1,1,20,W).build(gl);
  L.cyl8=PR.cyl(1,1,1,8,W).build(gl);
  L.cone=PR.cone(1,1,16,W).build(gl);
  L.cone6=PR.cone(1,1,6,W).build(gl);
  L.sph=PR.sphere(1,16,12,W).build(gl);
  L.sph6=PR.sphere(1,8,6,W).build(gl);
  L.torus=PR.torus(1,.12,36,8,W).build(gl);
  L.torusThin=PR.torus(1,.03,48,6,W).build(gl);
  L.dome=(()=>{const p=[{r:1,y:0,hard:true}];for(let k=1;k<=7;k++){const a=k/7*Math.PI/2;p.push({r:Math.cos(a),y:Math.sin(a)})}return PR.lathe(p,20,W).build(gl)})();
  L.disc=PR.lathe([{r:0,y:-1},{r:1,y:-1,hard:true},{r:1,y:-.08,hard:true},{r:.965,y:0,hard:true},{r:0,y:0}],48,W).build(gl);   // unit-radius chamfered slab, top at 0, 1 thick
  L.rock=rockMB(3.1,8,6).build(gl);L.rock2=rockMB(9.7,7,5).build(gl);
  L.spec=(()=>{const m=new MB();m.add(PR.ellipsoid(.3,.4,.24,10,8,W),mT(0,.42,0));return m.build(gl)})();
  L.specHead=PR.sphere(.22,10,8,W).build(gl);
  L.specHeadUp=(()=>{const m=new MB();m.add(PR.sphere(.22,10,8,W),mT(0,.88,0));return m.build(gl)})();
  L.quad=PR.floorQuad(W).build(gl);
  return L;
}
function sceneLibEnsure(R){if(!R.sceneLib)R.sceneLib=makeSceneLib(R.gl);return R.sceneLib}

/* ------------------------------------------------------------- Scene base -- */
export const SCENES={};
class Scene{
  constructor(R,sim){
    this.R=R;this.gl=R.gl;this.L=sceneLibEnsure(R);this.sim=sim;this.id=sim.map.id;this.theme=THEMES[this.id];
    this.tl=[];this.pl=[];this.statB=[];this.dynB=[];this.meshes=[];this.glows=[];this.crowds=[];this.holes=[];
    this.stage=null;this.floorY=null;this.excite=0;this.time=0;this.crossed=new Uint8Array(MAX_PLAYERS);this.ambient=null;this.extra=null;
    this.rng=mulberry32(hashStr(this.id)^(sim.round*7919));
  }
  S(mesh,cap,outline){const b=new Batch(this.gl,mesh,cap);this.pl.push({batch:b,outline:outline?1:0});this.statB.push(b);return b}
  D(mesh,cap,outline,terrain){const b=new Batch(this.gl,mesh,cap);(terrain?this.tl:this.pl).push({batch:b,outline:outline?1:0});this.dynB.push(b);return b}
  mesh(mb){const m=mb.build(this.gl);this.meshes.push(m);return m}
  finish(){for(const b of this.statB)b.upload()}
  dispose(){for(const e of this.tl.concat(this.pl))e.batch.dispose();for(const m of this.meshes)m.dispose()}
  viewR(sim){return sim.arena.R0+.5}
  glow(x,y,z,s,col,flick){this.glows.push({x,y,z,s,r:col[0],g:col[1],b:col[2],f:flick||0,ph:Math.random()*6})}
  /* spectators standing at spots [{x,y,z,yaw,s,ci}] */
  addCrowd(spots,pal,headPal,mesh){
    if(!spots.length)return;
    const bb=this.D(mesh||this.L.spec,spots.length,false),hb=this.D(this.L.specHead,spots.length,false);
    this.crowds.push({spots,bb,hb,pal,headPal:headPal||[[.96,.78,.62],[.82,.6,.44],[.6,.4,.28],[1,.86,.74]]});
  }
  update(sim,alpha,dt,fx){
    this.time+=dt;this.excite=Math.max(0,this.excite-dt*.5);
    for(const b of this.dynB)b.clear();
    this.frame(sim,alpha,dt,fx);
    this.updateCrowds(dt);
    for(const b of this.dynB)b.upload();
    const t=this.time;
    for(const g of this.glows){const k=1+g.f*Math.sin(t*9+g.ph)*.5+g.f*Math.sin(t*23+g.ph*2)*.3;fx.imm(true,g.x,g.y,g.z,g.s*k,0,0,SPR.glow,g.r,g.g,g.b,.85)}
    this.watchFalls(sim,fx);
    if(this.ambient)this.ambient(sim,dt,fx);
  }
  updateCrowds(dt){
    const t=this.time,ex=this.excite;
    for(const c of this.crowds){
      for(let i=0;i<c.spots.length;i++){
        const s=c.spots[i],sp=5+s.ph*3+ex*8,bob=Math.abs(Math.sin(t*sp+s.ph*6))*(.05+.32*ex*(.5+s.ph));
        const col=c.pal[s.ci%c.pal.length],hc=c.headPal[(s.ci*7+3)%c.headPal.length],sc=s.s||1;
        c.bb.add(s.x,s.y+bob,s.z,s.yaw||0,0,Math.sin(t*3+s.ph*9)*.05*(1+ex*2),sc,sc*(1+bob*.4),sc,col[0],col[1],col[2],0,0,-1,0,0);
        c.hb.add(s.x,s.y+bob,s.z,s.yaw||0,0,0,sc,sc*(1+bob*.4),sc,hc[0],hc[1],hc[2],0,0,-1,0,0);
      }
    }
  }
  watchFalls(sim,fx){
    const L=this.theme.liquid;
    for(let i=0;i<sim.fighters.length;i++){
      const f=sim.fighters[i];
      if(sim.phase==='intro'||(sim.t<.2&&!f.falling))this.crossed[i]=0;
      if((f.falling||!f.alive)&&!this.crossed[i]&&f.y<L.y){this.crossed[i]=1;fx.splash(f.x,L.y,f.z,L.mode);this.excite=Math.min(1,this.excite+.5)}
      if(!f.falling&&f.alive)this.crossed[i]=0;
    }
  }
  onEvent(e,sim,fx){
    if(e.type==='hit')this.excite=Math.min(1,this.excite+.12+(e.tier==='heavy'?.15:0)+(e.tier==='critical'?.3:0));
    else if(e.type==='roundEnd'||e.type==='matchEnd')this.excite=1;
    else if(e.type==='knockdown')this.excite=Math.min(1,this.excite+.2);
    this.ev(e,sim,fx);
  }
  ev(){}
  draw(){const R=this.R;R.setHoles(this.holes);R.drawToon(this.tl,{holes:true});R.drawToon(this.pl)}
}
export function buildScene(R,sim){
  const S=new Scene(R,sim);const fn=SCENES[S.id];fn(S,sim);S.finish();return S;
}
/* back-arc helper: angle phi measured from -Z */
export function arcPos(phi,r){return [Math.sin(phi)*r,-Math.cos(phi)*r]}
function stoneBlock(mb,x,y,z,w,h,d,col){mb.add(PR.box(w,h,d,col),mT(x,y,z))}

/* ================================================================= KEEP ==== */
SCENES.keep=function(S,sim){
  const A=sim.arena,L=S.L,rng=S.rng,R0=A.R0,W=[1,1,1];
  S.floorY=null;
  // ---- ring tiles
  for(const r of A.rings){
    const rm=(r.outer+r.inner)/2,g=.035,ang=TAU/r.S-g/rm;
    const mb=PR.sector(r.inner+g,r.outer-g,ang,.9,.07,[.66,.64,.78],[.42,.4,.52]);mb.xf(mT(-rm,0,0));
    r.mesh=S.mesh(mb);r.batch=S.D(r.mesh,r.S,true,true);r.fxd=new Uint8Array(r.S);
  }
  S.coreB=S.D(L.disc,1,true,true);
  S.coreRim=S.D(L.torusThin,1,false,true);
  // ---- pillar + rocks under the arena
  const pil=S.S(L.cyl,2,false);pil.add(0,-5.4,0,0,0,0,A.core*.6,8.4,A.core*.6,.32,.27,.3,0,0,-1,6,1.1);
  pil.add(0,-8.6,0,0,0,0,A.core*.95,2,A.core*.95,.24,.2,.22,0,0,-1,6,1.1);
  // ---- back wall + towers
  const wl=2*(R0+16),wz=-(R0+8.2),wb=new MB();
  wb.add(PR.box(wl,3.0,1.8,[.62,.58,.58]),mT(0,1.5,0));
  for(let x=-wl/2+.6;x<wl/2;x+=1.15){wb.add(PR.box(.62,.7,.5,[.7,.66,.65]),mT(x,3.35,.62));wb.add(PR.box(.62,.7,.5,[.7,.66,.65]),mT(x,3.35,-.62))}
  wb.add(PR.box(3.6,3.9,2.1,[.5,.46,.48]),mT(0,1.95,.1));wb.add(PR.box(2.0,2.4,2.3,[.12,.08,.1]),mT(0,1.2,.12));      // gate
  const wall=S.S(S.mesh(wb),1,false);wall.add(0,-.6,wz,0,0,0,1,1,1,1,1,1,0,0,-1,6,.9);
  // tower mesh
  const tb=new MB();
  tb.add(PR.cyl(1,1.08,4.6,16,[.78,.74,.72]),mT(0,2.3,0));tb.add(PR.cyl(1.22,1.22,.5,16,[.6,.56,.58]),mT(0,4.75,0));
  for(let k=0;k<8;k++){const a=k/8*TAU;tb.add(PR.box(.42,.5,.42,[.66,.62,.62]),mT(Math.cos(a)*1.15,5.25,Math.sin(a)*1.15))}
  tb.add(PR.cone(1.35,1.9,16,[.86,.2,.26]),mT(0,5.0,0));tb.add(PR.box(.34,.7,.2,[.1,.07,.1]),mT(0,3.2,.98));tb.add(PR.box(.34,.7,.2,[.1,.07,.1]),mT(0,1.6,.98));
  tb.add(PR.cyl(.03,.03,1.0,6,[.4,.3,.2]),mT(0,7.3,0));tb.add(PR.box(.7,.4,.04,[1,.82,.2]),mT(.37,7.5,0));
  const towerM=S.mesh(tb);
  const tw=[[-R0-5,-R0-2.5,1.1],[R0+5,-R0-2.5,1.1],[-R0-12,-R0-4,1.3],[R0+12,-R0-4,1.3],[-R0-6.5,R0*.1,.9],[R0+6.5,R0*.1,.9],[-R0*.45,wz+.3,1.25],[R0*.45,wz+.3,1.25]];
  const towers=S.S(towerM,tw.length,true);
  for(const t of tw)towers.add(t[0],-.6,t[1],0,0,0,t[2],t[2],t[2],1,1,1,0,0,-1,6,1.1);
  for(const t of tw)S.glow(t[0],-.6+7.6*t[2],t[1],1.0,[1,.8,.3],.25);
  // banners hanging on the wall
  const ban=S.S(L.box,12,false);
  for(let i=0;i<10;i++){const x=-wl/2+4+i*(wl-8)/9;if(Math.abs(x)<2.4)continue;ban.add(x,1.8,wz+1.0,0,0,0,.95,2.0,.05,i%2?.85:.95,i%2?.2:.7,i%2?.25:.15,0,0,-1,0,0);ban.add(x,2.5,wz+1.0,0,0,0,.6,.5,.06,1,.82,.2,0,0,-1,0,0)}
  // spectators on the wall
  const spots=[];
  for(let i=0;i<46;i++){const x=(-wl/2+3)+(wl-6)*(i/45)+(rng()-.5)*.5;if(Math.abs(x)<2.3)continue;spots.push({x,y:3.0,z:wz+(rng()<.5?.25:-.25),yaw:(rng()-.5)*.7,s:.9+rng()*.35,ci:(rng()*6)|0,ph:rng()})}
  S.addCrowd(spots,[[.9,.25,.25],[.25,.45,.9],[.95,.8,.2],[.3,.75,.4],[.7,.35,.85],[.95,.55,.2]]);
  // basalt spires + rocks in the lava
  const sp=S.S(L.cone6,22,false),rk=S.S(L.rock,16,false);
  for(let i=0;i<16;i++){const phi=(rng()*2-1)*2.3,r=R0+4.2+rng()*13,[x,z]=arcPos(phi,r);if(z>R0*.6)continue;const h=1.4+rng()*3.2;sp.add(x,-5.3,z,rng()*6,0,0,.6+rng()*.8,h,.6+rng()*.8,.3,.2,.2,0,0,-1,0,0)}
  for(let i=0;i<16;i++){const phi=(rng()*2-1)*2.9,r=R0+2+rng()*12,[x,z]=arcPos(phi,r);if(z>R0*.9)continue;const s=.6+rng()*1.3;rk.add(x,-5.1+s*.2,z,rng()*6,0,0,s,s*.8,s,.24,.2,.22,0,0,-1,0,0)}
  // braziers on posts
  const post=S.S(L.cyl8,10,false),bowl=S.S(L.cyl,10,false);let pn=0;
  for(const [x,z] of[[-R0-3,-R0*.55],[R0+3,-R0*.55],[-R0-2.6,R0*.55],[R0+2.6,R0*.55],[-R0*.8,wz+1.4],[R0*.8,wz+1.4]]){
    post.add(x,-1.0,z,0,0,0,.09,4,.09,.4,.3,.25,0,0,-1,0,0);bowl.add(x,1.1,z,0,0,0,.34,.3,.34,.28,.25,.28,0,0,-1,0,0);S.glow(x,1.55,z,1.5,[1,.62,.2],.35);pn++;
  }
  // embers drifting up from the lava
  S.ambient=(sim,dt,fx)=>{
    if(Math.random()<dt*14*fx.q){const a=Math.random()*TAU,r=R0+Math.random()*9;fx.p({x:Math.cos(a)*r,y:-4.5,z:Math.sin(a)*r-3,vx:(Math.random()-.5)*.6,vy:1.2+Math.random()*1.8,vz:(Math.random()-.5)*.6,life:3+Math.random()*2,s0:.1+Math.random()*.12,s1:.02,spr:SPR.glow,r:1,g:.55,b:.15,a:.9,add:true})}
  };
  S.viewR=(sim)=>{const a=sim.arena;let r=a.core*a.coreScale;for(const ri of a.rings){if(sim.t<ri.lastDrop-.2){r=Math.max(r,ri.outer);break}}return r+.6};
  S.frame=(sim,alpha,dt,fx)=>{
    const t=sim.t;
    for(const r of A.rings){
      if(r.gone&&t>r.lastDrop+2)continue;
      const rm=(r.outer+r.inner)/2,warn=t>=r.warnT?t-r.warnT:-1,b=r.batch;
      for(let j=0;j<r.S;j++){
        const am=(j+.5)/r.S*TAU,tau=t-r.dropAt[j];
        if(tau>1.9)continue;
        const sh=((j&1)?1:.92)*((r.i&1)?.97:1);let cr=sh*.98,cg=sh,cb=1.02*sh,emi=0,y=0,pitch=0,roll=0,sc=1,jx=0,jz=0;
        if(tau<0){
          if(warn>=0){
            const k=smooth(warn/.3),pul=.5+.5*Math.sin(warn*14),f=k*(.4+.6*pul),near=Math.max(0,1-(-tau)/.45);
            cr=lerp(cr,1,f*.7);cg=lerp(cg,.2,f*.82);cb=lerp(cb,.12,f*.85);emi=f*.55;
            const sk=.018+near*.05;jx=Math.sin(warn*71+j*3.1)*sk;jz=Math.cos(warn*63+j*1.7)*sk;y=Math.sin(warn*55+j)*sk*.6;
          }
        }else{
          if(!r.fxd[j]){r.fxd[j]=1;const x=Math.cos(am)*rm,z=Math.sin(am)*rm;fx.chips(x,.3,z,3,[.8,.74,.7],3);if(j%2===0)fx.puff(x,.1,z,2,1.2,fx.dust,.9)}
          y=-(1.4*tau+6.5*tau*tau);pitch=tau*(1.6+Math.sin(j*7.3+r.i*2.1)*2);roll=tau*(1.4+Math.cos(j*5.1+r.i)*2);sc=1-smooth((tau-.9)/.9);
          cr*=.9;cg*=.85;cb*=.8;emi=Math.max(0,.3-tau);
        }
        if(sc<=.01)continue;
        b.add(Math.cos(am)*rm+jx,y,Math.sin(am)*rm+jz,-am,pitch,roll,sc,sc,sc,cr,cg,cb,emi,0,-1,6,1.3);
      }
    }
    const cR=A.core*A.coreScale;
    S.coreB.add(0,0,0,0,0,0,cR,1,cR,.86,.8,.7,0,0,-1,2,.8);
    S.coreRim.add(0,.01,0,0,0,0,cR*.97,cR*.97,cR*.97,1,.82,.3,.5,0,-1,0,0);
    if(A.sudden)fx.imm(true,0,.05,0,cR*2.6,0,2,SPR.tele,1,.25,.12,.5+.4*Math.sin(S.time*9));
  };
};

/* ================================================================== FLOE ==== */
SCENES.floe=function(S,sim){
  const A=sim.arena,L=S.L,rng=S.rng,R0=A.R0,core=A.core;
  const rm=(core+R0)/2,gap=.05;
  const mb=PR.sector(core+.04,R0,TAU/A.S-gap,1.0,.1,[.88,.96,1],[.55,.72,.85]);mb.xf(mT(-rm,0,0));
  const shardM=S.mesh(mb);
  S.shards=S.D(shardM,A.S,true,true);S.coreB=S.D(L.disc,1,true,true);
  S.crack=null;
  // icebergs and cliffs
  const cone=S.S(L.cone6,26,false),box=S.S(L.box,18,false),rk=S.S(L.rock,18,false);
  for(let i=0;i<22;i++){const phi=(rng()*2-1)*2.4,r=R0+3+rng()*14,[x,z]=arcPos(phi,r);if(z>R0*.5)continue;const h=2+rng()*7;cone.add(x,-1.5,z,rng()*6,0,0,1+rng()*2.1,h,1+rng()*2.1,.86+rng()*.1,.94+rng()*.05,1,0,0,-1,5,.8)}
  for(let i=0;i<16;i++){const phi=(rng()*2-1)*2.8,r=R0+2+rng()*12,[x,z]=arcPos(phi,r);if(z>R0*.9)continue;const s=.5+rng()*1.4;rk.add(x,-.4+s*.2,z,rng()*6,0,0,s,s*.7,s,.82,.93,1,0,0,-1,5,.9)}
  // back ice shelf + penguin crowd
  const sz=-(R0+7.5);box.add(0,.4,sz,0,0,0,2*(R0+15),2.8,3.6,.8,.92,.98,0,0,-1,5,.8);
  for(let i=0;i<10;i++){const x=-R0-12+i*(2*R0+24)/9;box.add(x,2.3,sz-.2,rng()*.3,0,rng()*.2-.1,1.3+rng()*1.2,1.3+rng()*.9,1.4,.9,.97,1,0,0,-1,5,.8)}
  const spots=[];for(let i=0;i<44;i++){const x=(-R0-12)+(2*R0+24)*(i/43)+(rng()-.5)*.6;spots.push({x,y:1.8,z:sz+(rng()<.5?.4:-.5),yaw:(rng()-.5)*.6,s:.85+rng()*.4,ci:i,ph:rng()})}
  S.addCrowd(spots,[[.1,.14,.22],[.14,.18,.28],[.08,.1,.18]],[[.95,.95,1],[.1,.14,.22],[.96,.9,.85]]);
  // side ice pillars
  for(const sx of[-1,1])for(let k=0;k<3;k++){const x=sx*(R0+4+k*3.2),z=-R0*.2-k*3.5,h=2.5+k*1.3;cone.add(x,-1.4,z,k,0,0,1.1+k*.3,h,1.1+k*.3,.8,.93,1,0,0,-1,5,.8)}
  S.ambient=(sim,dt,fx)=>{
    if(Math.random()<dt*34*fx.q)fx.p({x:(Math.random()-.5)*34,y:11,z:-16+Math.random()*28,vx:.35,vy:-1.6-Math.random(),vz:0,life:7,s0:.07+Math.random()*.09,spr:SPR.disc,r:1,g:1,b:1,a:.85,fade:.3});
    if(Math.random()<dt*3.5*fx.q){const a=Math.random()*TAU,r=Math.random()*(R0+8);fx.p({x:Math.cos(a)*r,y:-.35,z:Math.sin(a)*r-3,life:.9,s0:.5,s1:.05,spr:SPR.star,r:.9,g:1,b:1,a:.9,add:true,rot:Math.random()*3})}
  };
  S.viewR=()=>R0+.5;
  S.floorY=null;
  S.frame=(sim,alpha,dt,fx)=>{
    const t=sim.t,liq=S.theme.liquid.y;
    for(const w of A.wedges){
      const am=(w.a0+w.a1)/2,tau=t-w.dropT;
      if(tau>1.6)continue;
      let y=0,pitch=0,roll=0,sc=1,cr=.96,cg=.98,cb=1,emi=0,jx=0,jz=0;
      const sh=(w.i&1)?1:.95;cr*=sh;cg*=sh;
      if(tau<0){
        if(w.warned){
          const warn=t-w.warnT,k=smooth(warn/.4),pul=.5+.5*Math.sin(warn*11),f=k*(.35+.65*pul),near=Math.max(0,1-(-tau)/.5);
          cr=lerp(cr,.55,f*.5);cg=lerp(cg,.9,f*.35);cb=lerp(cb,1,f*.2);emi=f*.5;
          const sk=.012+near*.04;jx=Math.sin(warn*83+w.i*3.1)*sk;jz=Math.cos(warn*71+w.i*1.7)*sk;
          const cx=Math.cos(am)*rm,cz=Math.sin(am)*rm;
          for(let c=0;c<3;c++){const ca=am+(c-1)*.17,cr0=core+1.0+c*1.2;fx.imm(false,Math.cos(ca)*cr0,.045,Math.sin(ca)*cr0,2.3,-ca+Math.PI/2+(c-1)*.5,2,SPR.streak,.55,.9,1,.55+.4*pul,0)}
        }
      }else{
        if(!w.fxd){w.fxd=true;fx.chips(Math.cos(am)*rm,.3,Math.sin(am)*rm,12,[.88,.96,1],4)}
        y=-(1.0*tau+4.5*tau*tau);pitch=tau*.9*Math.cos(am);roll=-tau*.9*Math.sin(am);
        if(!w.spl&&y<liq-.2){w.spl=true;fx.splash(Math.cos(am)*rm,liq,Math.sin(am)*rm,1);fx.splash(Math.cos(am)*(rm+1.4),liq,Math.sin(am)*(rm+1.4),1)}
        sc=1-smooth((tau-.9)/.7);
      }
      if(sc<=.01)continue;
      S.shards.add(Math.cos(am)*rm+jx,y,Math.sin(am)*rm+jz,-am,pitch,roll,sc,sc,sc,cr,cg,cb,emi,0,-1,5,.9);
    }
    const cR=core*A.coreScale;
    S.coreB.add(0,0,0,0,0,0,cR,1,cR,.95,.98,1,0,0,-1,5,.9);
    if(A.sudden)fx.imm(true,0,.05,0,cR*2.6,0,2,SPR.tele,.5,.9,1,.5+.4*Math.sin(S.time*9));
  };
};

/* ================================================================= PLAZA ==== */
SCENES.plaza=function(S,sim){
  const A=sim.arena,L=S.L,rng=S.rng,R0=A.R0,W=[1,1,1];
  const NEON=[[1,.25,.7],[.2,.9,1],[1,.9,.3],[.62,.38,1]];
  S.floor=S.D(L.disc,1,true,true);
  S.rim=S.D(L.torusThin,1,false,true);
  // rail segments
  const NR=Math.max(40,Math.round(TAU*R0/.62)),segLen=TAU*R0/NR;
  const railM=S.mesh(new MB().add(PR.box(.26,.36,segLen*1.02,W),mT(0,.2,0)).add(PR.box(.14,.14,segLen*1.02,[1,1,1]),mT(0,.42,0)));
  S.rail=S.D(railM,NR,true,false);S.NR=NR;
  const post=S.D(L.cyl,12,true,false),ball=S.D(L.sph,12,false,false);
  // bumpers: base + cap
  const bb=S.D(L.cyl,Math.max(1,A.bumpers.length),true,false),bc=S.D(L.dome,Math.max(1,A.bumpers.length),true,false),bg=S.D(L.torus,Math.max(1,A.bumpers.length),false,false);
  S.post=post;S.ball=ball;S.bb=bb;S.bc=bc;S.bg=bg;S.railAmt=1;
  // pylons + ferris wheel + arches in the background
  const py=S.S(L.cyl8,12,false),pb=S.S(L.sph,12,false);
  for(let i=0;i<10;i++){const phi=-1.9+i*(3.8/9),[x,z]=arcPos(phi,R0+3.4+(i&1)*1.2),c=NEON[i%4];py.add(x,1.1,z,0,0,0,.18,4.6,.18,.25,.2,.4,0,0,-1,0,0);pb.add(x,3.5,z,0,0,0,.42,.42,.42,c[0],c[1],c[2],1,0,-1,0,0);S.glow(x,3.5,z,2.1,c,.2)}
  const wz=-(R0+13),wr=8.5,wy=wr+.8;
  S.wheelRim=S.S(L.torusThin,2,false);S.wheelRim.add(0,wy,wz,0,Math.PI/2,0,wr,wr,wr,.95,.35,.8,.7,0,-1,0,0);S.wheelRim.add(0,wy,wz,0,Math.PI/2,0,wr*.6,wr*.6,wr*.6,.35,.85,1,.7,0,-1,0,0);
  S.spoke=S.D(L.box,16,false,false);S.gond=S.D(L.box,16,false,false);S.wheel={x:0,y:wy,z:wz,r:wr};
  const leg=S.S(L.box,2,false);leg.add(-3,wy*.5,wz,0,0,.28,.35,wy*1.05,.35,.4,.25,.55,0,0,-1,0,0);leg.add(3,wy*.5,wz,0,0,-.28,.35,wy*1.05,.35,.4,.25,.55,0,0,-1,0,0);
  S.glow(0,wy,wz,8,[1,.35,.9],.1);
  // back platform + crowd
  const plat=S.S(L.box,3,false);plat.add(0,.1,-(R0+6.2),0,0,0,2*(R0+16),1.4,3.2,.2,.14,.36,0,0,-1,0,0);
  for(let i=0;i<3;i++){plat.add((i-1)*(R0+7),.9,-(R0+6.2),0,0,0,2.2,.2,2.4,NEON[i][0],NEON[i][1],NEON[i][2],.9,0,-1,0,0)}
  const spots=[];for(let i=0;i<42;i++){const x=(-R0-13)+(2*R0+26)*(i/41)+(rng()-.5)*.6;spots.push({x,y:.8,z:-(R0+6.2)+(rng()<.5?.3:-.3),yaw:(rng()-.5)*.6,s:.9+rng()*.3,ci:(rng()*8)|0,ph:rng()})}
  S.addCrowd(spots,[[1,.3,.7],[.3,.85,1],[1,.85,.3],[.65,.4,1],[.4,1,.6],[1,.5,.3]]);
  // balloons
  const bl=S.S(L.sph,14,false);for(let i=0;i<14;i++){const phi=(rng()*2-1)*2,[x,z]=arcPos(phi,R0+4+rng()*8),c=NEON[i%4];bl.add(x,2+rng()*5,z,0,0,0,.5,.62,.5,c[0],c[1],c[2],.6,0,-1,0,0)}
  S.ambient=(sim,dt,fx)=>{
    if(Math.random()<dt*9*fx.q){const c=NEON[(Math.random()*4)|0],a=Math.random()*TAU,r=R0+2+Math.random()*10;fx.p({x:Math.cos(a)*r,y:-3,z:Math.sin(a)*r-3,vy:1.5+Math.random()*2,life:3,s0:.18,s1:.03,spr:SPR.glow,r:c[0],g:c[1],b:c[2],a:.9,add:true})}
  };
  S.viewR=()=>R0+.6;S.floorY=null;
  const gx=new Float32Array(2);
  S.frame=(sim,alpha,dt,fx)=>{
    const t=sim.t,cR=A.core*A.coreScale,T=S.time;
    S.floor.add(0,0,0,0,0,0,cR,1,cR,.78,.62,1,0,0,-1,1,.72);
    S.rim.add(0,.02,0,0,0,0,cR*.99,cR*.99,cR*.99,.2,.92,1,.9,0,-1,0,0);
    fx.imm(true,0,.04,0,cR*2.06,0,2,SPR.tele,.2,.9,1,.28+.1*Math.sin(T*3));
    // rail + gates
    S.railAmt=A.railOn?Math.min(1,S.railAmt+dt*4):Math.max(0,S.railAmt-dt*2.2);
    const gaps=A.nGaps;
    if(S.railAmt>.01){
      for(let k=0;k<S.NR;k++){
        const a=(k+.5)/S.NR*TAU;let d=9;
        for(let g=0;g<gaps;g++)d=Math.min(d,Math.abs(angDiff(A.gapAng+g*TAU/gaps,a)));
        const v=clamp((d-A.gapHalf)/.1,0,1)*S.railAmt;if(v<.02)continue;
        const c=NEON[k&3];
        S.rail.add(Math.cos(a)*(R0+.1),-.4*(1-v),Math.sin(a)*(R0+.1),-a,0,0,1,v,1,c[0]*.55+.45,c[1]*.55+.45,c[2]*.55+.45,.35,0,-1,0,0);
      }
      for(let g=0;g<gaps;g++){
        const ga=A.gapAng+g*TAU/gaps;
        for(const s of[-1,1]){
          const pa=ga+s*(A.gapHalf+.03),px=Math.cos(pa)*(R0+.1),pz=Math.sin(pa)*(R0+.1),c=NEON[(g+(s>0?1:0))&3];
          S.post.add(px,.9*S.railAmt,pz,0,0,0,.17,1.9*S.railAmt,.17,.3,.24,.5,0,0,-1,0,0);
          S.ball.add(px,1.9*S.railAmt+.1,pz,0,0,0,.3,.3,.3,c[0],c[1],c[2],1,0,-1,0,0);
          fx.imm(true,px,1.95*S.railAmt,pz,1.4,0,0,SPR.glow,c[0],c[1],c[2],.7);
        }
        // arrow showing the exit
        const ax=Math.cos(ga)*(R0-1.2),az=Math.sin(ga)*(R0-1.2),pu=.5+.5*Math.sin(T*5+g);
        fx.imm(true,ax,.045,az,.95,ga-Math.PI/2,2,SPR.tri,1,.9,.3,.35+.35*pu);
        fx.imm(true,Math.cos(ga)*(R0-.5),.045,Math.sin(ga)*(R0-.5),.95,ga-Math.PI/2,2,SPR.tri,1,.9,.3,.3+.3*(1-pu));
      }
    }
    // bumpers
    for(let i=0;i<A.bumpers.length;i++){
      const b=A.bumpers[i],c=NEON[i&3],pu=b.pulse,sc=1+.22*pu;
      S.bb.add(b.x,.25,b.z,0,0,0,b.r*.78*sc,.5,b.r*.78*sc,.28,.2,.45,0,0,-1,0,0);
      S.bc.add(b.x,.5,b.z,T*(.3+pu*4),0,0,b.r*sc,.52*sc,b.r*sc,c[0],c[1],c[2],.35+.6*pu,0,-1,0,0);
      S.bg.add(b.x,.52,b.z,0,0,0,b.r*.98*sc,1,b.r*.98*sc,1,1,1,.8,0,-1,0,0);
      fx.imm(true,b.x,.05,b.z,b.r*3.2+pu*1.4,0,2,SPR.glow,c[0],c[1],c[2],.35+.5*pu);
    }
    // ferris wheel
    const w=S.wheel,rot=T*.18;
    for(let k=0;k<8;k++){const a=rot+k/8*Math.PI;S.spoke.add(w.x,w.y,w.z,0,0,a,w.r*2,.06,.06,.7,.5,.9,.6,0,-1,0,0)}
    for(let k=0;k<12;k++){const a=rot+k/12*TAU,c=NEON[k&3];const gx2=w.x+Math.cos(a)*w.r,gy=w.y+Math.sin(a)*w.r;S.gond.add(gx2,gy-.45,w.z,0,0,0,.7,.6,.7,c[0],c[1],c[2],.8,0,-1,0,0)}
  };
};
