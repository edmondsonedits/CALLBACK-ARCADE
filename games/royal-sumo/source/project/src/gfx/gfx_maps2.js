/* ============================================================================
   ROYAL SUMO - SCENES part 2: WHARF / TEETER / MESA
   ========================================================================== */
import {TAU, clamp} from '../core/util.js';
import {FIXED_DT} from '../core/tune.js';
import {M4, MB, PR} from './engine.js';
import {SPR} from './gfx_fx.js';
import {SCENES, arcPos, mT, mTR} from './gfx_maps.js';
const _stTmp=new Float32Array(16),_stOut=new Float32Array(16);
function stageMatrix(out,tx,tz,theta){
  M4.ident(out);const m=Math.hypot(tx,tz);if(m<1e-4||Math.abs(theta)<1e-5)return out;
  const dx=tx/m,dz=tz/m,ux=dz,uz=-dx,c=Math.cos(theta),s=Math.sin(theta),k=1-c;
  out[0]=c+k*ux*ux;out[1]=s*uz;out[2]=k*ux*uz;
  out[4]=-s*uz;out[5]=c;out[6]=s*ux;
  out[8]=k*ux*uz;out[9]=-s*ux;out[10]=c+k*uz*uz;
  return out;
}
function addStaged(b,st,x,y,z,yaw,sx,sy,sz,r,g,bl,emi,pat,sc){
  M4.trs(_stTmp,0,x,y,z,yaw,0,0,sx,sy,sz);M4.mul(_stOut,st,_stTmp);b.addM(_stOut,r,g,bl,emi,0,-1,pat,sc);
}

/* ================================================================= WHARF ==== */
SCENES.wharf=function(S,sim){
  const A=sim.arena,L=S.L,rng=S.rng,R0=A.R0,K=A.K,W=[1,1,1],Larm=A.armL-A.island;
  S.deck=S.D(L.disc,1,true,true);S.isl=S.D(L.disc,1,false,true);S.islRing=S.D(L.torusThin,1,false,true);
  const ab=new MB(),nb=7;
  for(let i=0;i<nb;i++){const l=Larm/nb;ab.add(PR.box(l*1.0,.36+(i&1)*.04,.42+(i&1)*.05,i&1?[.97,.95,.9]:[.92,.22,.2]),mT(l*(i+.5),0,0))}
  ab.add(PR.sphere(.3,10,8,[1,.82,.25]),mT(Larm+.1,0,0));
  S.armM=S.mesh(ab);S.arms=S.D(S.armM,Math.max(1,K),true,false);S.struts=S.D(L.box,Math.max(1,K),false,false);
  S.hub=S.D(L.sph,2,true,false);S.pole=S.D(L.cyl8,2,false,false);S.boll=S.D(L.cyl,24,true,false);S.rope=S.D(L.torus,24,false,false);
  // pier, boats, lighthouse
  const bx=S.S(L.box,40,false),cn=S.S(L.cone,12,false),cy=S.S(L.cyl,64,false);
  const pz=-(R0+6.5);
  bx.add(0,-.2,pz,0,0,0,2*(R0+16),.9,3.6,.62,.42,.26,0,0,-1,3,.8);
  for(let i=0;i<14;i++){const x=-R0-14+i*(2*R0+28)/13;cy.add(x,-1.8,pz+1.5,0,0,0,.28,3.4,.28,.38,.26,.16,0,0,-1,0,0);cy.add(x,-1.8,pz-1.5,0,0,0,.28,3.4,.28,.38,.26,.16,0,0,-1,0,0)}
  for(let i=0;i<6;i++){const x=(rng()*2-1)*(R0+10);bx.add(x,.55,pz+(rng()-.5)*1.2,rng(),0,0,.9,.9,.9,.72,.52,.3,0,0,-1,0,0)}
  for(let i=0;i<5;i++){const x=(rng()*2-1)*(R0+10);cy.add(x,.5,pz+(rng()-.5)*1.2,0,0,0,.42,.9,.42,.5,.32,.2,0,0,-1,0,0)}
  const boatSpots=[[-R0-7,-R0*.5,.3],[R0+8,-R0*.2,-.4],[-R0-9,-R0-4,.1],[R0*.5,-R0-11,-.2]];
  for(const [x,z,yw] of boatSpots){
    bx.add(x,-.55,z,yw,0,0,3.6,1.0,1.4,.5,.33,.2,0,0,-1,0,0);bx.add(x,.1,z,yw,0,0,3.0,.2,1.15,.82,.68,.45,0,0,-1,0,0);
    cy.add(x,1.7,z,yw,0,0,.07,3.4,.07,.4,.28,.18,0,0,-1,0,0);bx.add(x+Math.cos(yw)*.55,1.6,z-Math.sin(yw)*.55,yw,0,0,.04,2.2,1.6,.97,.93,.85,0,0,-1,0,0);
  }
  // lighthouse
  const lx=R0+8,lz=-R0-5.5,lh=7;
  for(let i=0;i<5;i++)cy.add(lx,-1.2+i*(lh/5)+lh/10,lz,0,0,0,1.05-i*.07,lh/5,1.05-i*.07,i&1?.96:.88,i&1?.95:.22,i&1?.92:.2,0,0,-1,0,0);
  cy.add(lx,lh-1.2+.5,lz,0,0,0,.8,.9,.8,1,.9,.5,.8,0,-1,0,0);cn.add(lx,lh-1.2+.95,lz,0,0,0,1.0,1.1,1.0,.85,.2,.22,0,0,-1,0,0);
  S.lh={x:lx,y:lh-.7,z:lz};S.glow(lx,lh-.7,lz,3,[1,.9,.5],.1);
  const spots=[];for(let i=0;i<40;i++){const x=(-R0-13)+(2*R0+26)*(i/39)+(rng()-.5)*.6;spots.push({x,y:.25,z:pz+(rng()<.5?.4:-.4),yaw:(rng()-.5)*.6,s:.9+rng()*.3,ci:(rng()*6)|0,ph:rng()})}
  S.addCrowd(spots,[[.2,.35,.7],[.9,.9,.85],[.85,.3,.25],[.95,.8,.3],[.25,.6,.5],[.6,.4,.25]]);
  const rk=S.S(L.rock,10,false);for(let i=0;i<10;i++){const phi=(rng()*2-1)*2.6,r=R0+3+rng()*10,[x,z]=arcPos(phi,r);if(z>R0*.6)continue;const s=.8+rng()*1.2;rk.add(x,-.7+s*.15,z,rng()*6,0,0,s,s*.6,s,.45,.42,.4,0,0,-1,0,0)}
  S.ambient=(sim,dt,fx)=>{
    if(Math.random()<dt*1.2*fx.q){const y=4+Math.random()*3,z=-6-Math.random()*10;fx.p({x:-16,y,z,vx:4+Math.random()*2,vy:.2,life:8,s0:.38,spr:SPR.tri,r:1,g:1,b:1,a:.9,fade:.2,rot:Math.PI,mode:1})}
    if(Math.random()<dt*2.2*fx.q){const a=Math.random()*TAU,r=R0+1+Math.random()*9;fx.p({x:Math.cos(a)*r,y:-.85,z:Math.sin(a)*r-2,life:.8,s0:.35,s1:.05,spr:SPR.star,r:1,g:.95,b:.75,a:.9,add:true,rot:Math.random()*3})}
  };
  S.viewR=()=>R0+.6;
  S.frame=(sim,alpha,dt,fx)=>{
    const cR=A.core*A.coreScale,ir=Math.min(A.island,cR),T=S.time;
    S.deck.add(0,0,0,0,0,0,cR,1,cR,.98,.74,.5,0,0,-1,3,1.1);
    S.isl.add(0,.035,0,0,0,0,ir,.06,ir,.66,.64,.72,0,0,-1,6,1.4);
    S.islRing.add(0,.04,0,0,0,0,ir,ir,ir,.95,.85,.3,.6,0,-1,0,0);
    const sd=clamp(1-(1-A.coreScale)*8,0,1);
    for(let i=0;i<20;i++){const a=i/20*TAU,x=Math.cos(a)*(R0+.3),z=Math.sin(a)*(R0+.3);if(sd<.02)break;
      S.boll.add(x,.22*sd,z,0,0,0,.18*sd,.5*sd,.18*sd,.38,.28,.2,0,0,-1,0,0);S.rope.add(x,.36*sd,z,0,0,0,.2*sd,sd,.2*sd,.9,.82,.6,0,0,-1,0,0);
      if(i%4===0)fx.imm(true,x,.78*sd,z,.9*sd,0,0,SPR.glow,1,.8,.4,.55)}
    // windmill hub + arms
    const hy=3.1,pull=A.phase===1?(.5+.5*Math.sin(T*30)):0;
    S.hub.add(0,hy,0,0,0,0,.38,.38,.38,1,.82,.28,.3,0,-1,0,0);
    S.pole.add(0,hy+1.4,0,0,0,0,.07,2.8,.07,.55,.4,.3,0,0,-1,0,0);
    if(K>0){
      const ang=A.ang-A.omega*(1-alpha)*FIXED_DT;
      for(let k=0;k<K;k++){
        const th=ang+k*TAU/K,c=Math.cos(th),s=Math.sin(th);
        S.arms.add(c*A.island,.52,s*A.island,-th,0,0,1,1,1,1,1-pull*.5,1-pull*.6,pull*.4,0,-1,0,0);
        const Ls=Math.hypot(A.island,hy-.62);
        S.struts.add(c*A.island*.5,(hy+.62)/2,s*A.island*.5,-th,0,-Math.atan2(hy-.62,A.island),Ls,.07,.07,.45,.32,.22,0,0,-1,0,0);
        fx.imm(true,c*(A.armL),.7,s*(A.armL),.9,0,0,SPR.glow,1,.8,.3,.4);
      }
    }
    if(A.sudden)fx.imm(true,0,.05,0,cR*2.6,0,2,SPR.tele,1,.45,.15,.5+.4*Math.sin(T*9));
    // lighthouse beam
    const lh=S.lh;fx.imm(true,lh.x+Math.cos(T*.9)*3,lh.y,lh.z+Math.sin(T*.9)*.5,7,T*.9,0,SPR.streak,1,.95,.7,.3);
  };
};

/* ================================================================ TEETER ==== */
SCENES.teeter=function(S,sim){
  const A=sim.arena,L=S.L,rng=S.rng,R0=A.R0,W=[1,1,1];
  S.stage=new Float32Array(16);M4.ident(S.stage);S.tilt={dx:0,dz:0,s:0};
  S.floor=S.D(L.disc,1,true,true);S.ringGlow=S.D(L.torusThin,3,false,true);S.stones=S.D(L.box,64,true,true);S.arrow=null;
  // stone column under the disc
  const pil=S.S(L.cyl,3,false);pil.add(0,-5.2,0,0,0,0,R0*.3,8.6,R0*.3,.42,.46,.36,0,0,-1,6,1.1);pil.add(0,-8.7,0,0,0,0,R0*.55,1.6,R0*.55,.34,.4,.3,0,0,-1,6,1.1);
  // palm mesh
  const pm=new MB();
  pm.add(PR.cyl(.16,.26,3.4,8,[.5,.36,.22]),mTR(0,1.7,0,0,0,.12));
  for(let k=0;k<7;k++){const a=k/7*TAU;pm.add(PR.ellipsoid(1.25,.08,.3,8,5,[.28+.1*(k&1),.62,.25]),mTR(Math.cos(a)*.95+.2,3.4,Math.sin(a)*.95,-a,.0,-.35,1,1,1))}
  const palmM=S.mesh(pm);
  // totem
  const tm=new MB();
  tm.add(PR.box(.9,1.1,.9,[.5,.36,.24]),mT(0,.55,0));tm.add(PR.box(.8,.95,.8,[.56,.42,.28]),mT(0,1.55,0));tm.add(PR.box(1.0,.5,1.0,[.4,.3,.2]),mT(0,2.25,0));
  tm.add(PR.cone(.35,.55,6,[.8,.2,.2]),mT(0,2.5,0));
  tm.add(PR.box(.2,.2,.1,[1,.85,.2]),mT(-.2,1.7,.42));tm.add(PR.box(.2,.2,.1,[1,.85,.2]),mT(.2,1.7,.42));tm.add(PR.box(.4,.12,.1,[.15,.08,.05]),mT(0,1.3,.42));
  const totemM=S.mesh(tm);
  const cliff=S.S(L.cyl,16,false),moss=S.S(L.cyl,16,false),palms=S.S(palmM,16,false),tot=S.S(totemM,9,true);
  for(let i=0;i<13;i++){
    const phi=-2.1+i*(4.2/12)+(rng()-.5)*.2,r=R0+4.5+rng()*8,[x,z]=arcPos(phi,r);if(z>R0*.7)continue;
    const cr=2+rng()*2.2,top=-.5+rng()*1.4;
    cliff.add(x,top-3.5,z,0,0,0,cr,7,cr,.3,.25,.22,0,0,-1,6,1);moss.add(x,top+.05,z,0,0,0,cr*1.02,.35,cr*1.02,.2,.5,.2,0,0,-1,0,0);
    palms.add(x+(rng()-.5)*cr*.5,top+.2,z+(rng()-.5)*cr*.5,rng()*6,0,0,.9+rng()*.5,.9+rng()*.6,.9+rng()*.5,1,1,1,0,0,-1,0,0);
  }
  for(let i=0;i<7;i++){const phi=-1.35+i*(2.7/6),[x,z]=arcPos(phi,R0+3.2+(i&1)*.8);tot.add(x,-.4,z,-phi*.8,0,0,.9,.9,.9,1,1,1,0,0,-1,0,0);S.glow(x,1.3,z+.5,.9,[1,.85,.3],.3)}
  const spots=[];for(let i=0;i<28;i++){const phi=-1.7+i*(3.4/27),[x,z]=arcPos(phi,R0+6.2+rng()*1.2);spots.push({x,y:-.4,z,yaw:-phi,s:.85+rng()*.3,ci:(rng()*5)|0,ph:rng()})}
  S.addCrowd(spots,[[.3,.62,.3],[.85,.55,.2],[.8,.25,.25],[.3,.5,.75],[.9,.8,.3]]);
  S.ambient=(sim,dt,fx)=>{
    if(Math.random()<dt*10*fx.q){const a=Math.random()*TAU,r=R0*.5+Math.random()*(R0+8);fx.p({x:Math.cos(a)*r,y:Math.random()*3.5,z:Math.sin(a)*r-2,vx:(Math.random()-.5)*.7,vy:.15+Math.random()*.3,vz:(Math.random()-.5)*.7,life:3.5,s0:.17,s1:.05,spr:SPR.glow,r:.8,g:1,b:.35,a:1,add:true})}
  };
  S.viewR=()=>R0+.8;
  S.floorY=(x,z)=>-S.tilt.s*(x*S.tilt.dx+z*S.tilt.dz);
  S.frame=(sim,alpha,dt,fx)=>{
    const cR=A.core*A.coreScale,m=Math.min(1,Math.hypot(A.tx,A.tz)),th=m*A.maxTilt*1.55,T=S.time;
    stageMatrix(S.stage,A.tx,A.tz,th);S.tilt.s=Math.sin(th);S.tilt.dx=m>1e-3?A.tx/Math.hypot(A.tx,A.tz):0;S.tilt.dz=m>1e-3?A.tz/Math.hypot(A.tx,A.tz):0;
    const st=S.stage;
    addStaged(S.floor,st,0,0,0,0,cR,1,cR,.98,.92,.76,0,2,1.3);
    addStaged(S.ringGlow,st,0,.02,0,0,cR*.98,cR*.98,cR*.98,.5,1,.55,.55,0,0);
    addStaged(S.ringGlow,st,0,.02,0,0,cR*.55,cR*.55,cR*.55,.5,1,.55,.35,0,0);
    const n=Math.max(8,Math.round(TAU*cR/1.5));
    for(let i=0;i<n;i++){const a=i/n*TAU,sd=clamp(1-(1-A.coreScale)*8,0,1);if(sd<.02)break;
      addStaged(S.stones,st,Math.cos(a)*(cR+.12),.15*sd,Math.sin(a)*(cR+.12),-a+Math.PI/2,.5,.5*sd,1.1,.55+.1*(i&1),.5,.38,0,6,1.2)}
    if(m>.18){const a=Math.atan2(A.tz,A.tx);fx.imm(true,A.tx/m*1.6,.06,A.tz/m*1.6,1.5,a-Math.PI/2,2,SPR.tri,.5,1,.5,.25+.45*m*(.6+.4*Math.sin(T*8)))}
    if(A.sudden)fx.imm(true,0,.06,0,cR*2.6,0,2,SPR.tele,1,.4,.2,.5+.4*Math.sin(T*9));
  };
};

/* ================================================================== MESA ==== */
SCENES.mesa=function(S,sim){
  const A=sim.arena,L=S.L,rng=S.rng,R0=A.R0,W=[1,1,1];
  S.disc=S.D(L.disc,1,true,true);S.lip=S.D(L.torus,10,false,false);S.rock=S.D(L.rock,16,false,false);
  // crater walls (inverted lathe so the inside face points inward)
  S.wallM=S.mesh(PR.lathe([{r:1,y:0,hard:true},{r:1,y:-1,hard:true}],18,[.4,.26,.2]));S.walls=S.D(S.wallM,10,false,false);
  // stalactite under the slab
  const st=S.S(L.cone,4,false);st.add(0,-1,0,0,Math.PI,0,R0*.42,8,R0*.42,.72,.4,.28,0,0,-1,4,.9);st.add(0,-3.2,0,0,Math.PI,0,R0*.3,5,R0*.3,.9,.62,.4,0,0,-1,4,.9);
  // mesas around: layered columns
  const cy=S.S(L.cyl,56,false),cac=S.S(L.cyl8,48,false),rk=S.S(L.rock2,12,false);
  const layers=[[.62,.3,.22],[.88,.56,.36],[.72,.38,.26],[.94,.72,.48],[.68,.34,.25]];
  for(let i=0;i<9;i++){
    const phi=-2.3+i*(4.6/8)+(rng()-.5)*.25,r=R0+6+rng()*10,[x,z]=arcPos(phi,r);if(z>R0*.5)continue;
    const rr=2+rng()*3.2,top=-1+rng()*3.2,n=5;
    for(let k=0;k<n;k++){const h=(top+7.5)/n;cy.add(x,top-h*(k+.5),z,0,0,0,rr*(1-.06*(k&1))*(1+k*.04),h,rr*(1-.06*(k&1))*(1+k*.04),layers[k%5][0],layers[k%5][1],layers[k%5][2],0,0,-1,4,.7)}
    for(let c=0;c<2;c++){const a=rng()*TAU,cx=x+Math.cos(a)*rr*.5,cz=z+Math.sin(a)*rr*.5,h=.8+rng()*.9;cac.add(cx,top+h/2,cz,0,0,0,.16,h,.16,.3,.6,.32,0,0,-1,0,0);cac.add(cx+.22,top+h*.6,cz,0,0,.0,.1,h*.4,.1,.3,.6,.32,0,0,-1,0,0)}
  }
  for(let i=0;i<12;i++){const phi=(rng()*2-1)*2.7,r=R0+3+rng()*11,[x,z]=arcPos(phi,r);if(z>R0*.7)continue;const s=.7+rng()*1.3;rk.add(x,-5.8+s*.4,z,rng()*6,0,0,s,s,s,.55,.3,.24,0,0,-1,0,0)}
  S.ambient=(sim,dt,fx)=>{
    if(Math.random()<dt*10*fx.q)fx.p({x:(Math.random()-.5)*32,y:-5.8,z:-14+Math.random()*26,vx:.5,vy:.5+Math.random()*.8,life:2.8,s0:.18,s1:.04,spr:SPR.glow,r:1,g:.5,b:.2,a:.8,add:true});
    if(Math.random()<dt*.45*fx.q){const x=(Math.random()-.2)*28,z=-12-Math.random()*6;fx.p({x:x-8,y:12+Math.random()*3,z,vx:11,vy:-4.5,life:.7,s0:.9,s1:.1,spr:SPR.streak,r:1,g:.95,b:.8,a:.9,add:true,rot:-.4})}
  };
  S.viewR=()=>R0+.6;S.floorY=null;
  S.frame=(sim,alpha,dt,fx)=>{
    const t=sim.t,cR=A.core*A.coreScale,T=S.time;
    S.disc.add(0,0,0,0,0,0,cR,1,cR,1,.78,.55,0,0,-1,4,.9);
    S.holes.length=0;
    for(const h of A.holes){
      S.holes.push({x:h.x,z:h.z,r:h.r});
      const age=t-h.t;
      S.lip.add(h.x,.025,h.z,0,0,0,h.r*1.02,.9,h.r*1.02,.45,.3,.22,0,0,-1,0,0);
      S.walls.add(h.x,0,h.z,0,0,0,h.r*1.03,1,h.r*1.03,.4,.26,.2,0,0,-1,0,0);
      fx.imm(false,h.x,.035,h.z,h.r*3.1,0,2,SPR.glow,.12,.07,.05,.55);
      fx.imm(true,h.x,.045,h.z,h.r*2.4,0,2,SPR.tele,1,.45,.12,Math.max(0,.55-age*.12)*(.7+.3*Math.sin(T*6+h.x)));
    }
    for(const m of A.meteors){
      if(m.done)continue;
      const u=clamp((t-m.t0)/(m.hitT-m.t0),0,1),pu=.5+.5*Math.sin(T*(8+u*14));
      fx.imm(true,m.x,.06,m.z,m.r*2.55,0,2,SPR.tele,1,.18,.1,.45+.45*pu);
      fx.imm(true,m.x,.055,m.z,m.r*(5.0-3.2*u),0,2,SPR.tele,1,.7,.3,.3+.6*u);
      fx.imm(true,m.x,.05,m.z,m.r*2.0,0,2,SPR.disc,1,.2,.1,.12+.22*u);
      fx.imm(true,m.x,6,m.z,1.5,0,1,SPR.glow,1,.45,.2,.1+.28*u,10);
      const w=u*u,px=m.x-9*(1-w),py=.4+17*(1-w),pz=m.z+6*(1-w);
      if(u>.12){
        S.rock.add(px,py,pz,T*3,T*4,0,.55,.55,.55,.35,.2,.14,.9,0,-1,0,0);
        fx.imm(true,px,py,pz,2.4,0,0,SPR.glow,1,.55,.2,.9);fx.imm(true,px,py,pz,1.1,0,0,SPR.glow,1,.95,.7,1);
        if(Math.random()<.9)fx.p({x:px,y:py,z:pz,vx:(Math.random()-.5)*.6,vy:(Math.random()-.5)*.6,vz:(Math.random()-.5)*.6,life:.45,s0:1.1,s1:.1,spr:SPR.glow,r:1,g:.5,b:.15,a:.8,add:true});
      }
    }
    if(A.sudden)fx.imm(true,0,.05,0,cR*2.6,0,2,SPR.tele,1,.4,.15,.5+.4*Math.sin(T*9));
  };
};
