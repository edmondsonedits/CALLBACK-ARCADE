/* ============================================================================
   ROYAL SUMO - FIGHTER RIG  (chibi rikishi built from primitives, procedural animation)
   Local space: +Y up, faces +Z. Collision radius 0.6.
   ========================================================================== */
import {TAU, clamp, dampAngle, easeOutCubic, sat, smooth} from '../core/util.js';
import {MAX_PLAYERS, TUNE} from '../core/tune.js';
import {Batch, M4, MB, PR, hexRGB} from './engine.js';
export const STYLES=[
  {skin:'#f0c29b',belt:'#e8384f',hair:'#2a1c1a',acc:0,size:1.00},
  {skin:'#e0a27a',belt:'#2f6fed',hair:'#1e1e28',acc:1,size:1.00},
  {skin:'#f7d4b8',belt:'#ff6fb5',hair:'#5a2d1a',acc:2,size:.97},
  {skin:'#b97a4b',belt:'#2fb36d',hair:'#1a1410',acc:3,size:1.04},
  {skin:'#f1c79a',belt:'#f5c518',hair:'#7a4a1c',acc:4,size:.98},
  {skin:'#8d5524',belt:'#8a4dff',hair:'#16100c',acc:5,size:1.05},
  {skin:'#e8b48a',belt:'#ff8a1f',hair:'#2d1d14',acc:6,size:.99},
  {skin:'#c68642',belt:'#1fb5c9',hair:'#3a2a20',acc:7,size:1.00},
  {skin:'#fbe0cf',belt:'#e8eef5',hair:'#b02a2a',acc:8,size:.96},
  {skin:'#a86b3c',belt:'#3b3f66',hair:'#101018',acc:9,size:1.02}
];
export const STYLE_RGB=STYLES.map(s=>({skin:hexRGB(s.skin),belt:hexRGB(s.belt),hair:hexRGB(s.hair)}));

function buildFighterMeshes(gl){
  const I=M4.ident(new Float32Array(16)),tmp=new Float32Array(16);
  const T=(x,y,z,sx,sy,sz)=>{M4.trs(tmp,0,x,y,z,0,0,0,sx||1,sy||1,sz||1);return tmp.slice()};
  const W=[1,1,1];
  const M={};
  // belly + chest
  M.body=new MB().add(PR.ellipsoid(.64,.48,.60,22,14,W),T(0,.60,0)).add(PR.ellipsoid(.52,.36,.47,18,12,W),T(0,.98,-.02)).build(gl);
  // mawashi: belt ring, front apron, tassels, back knot
  const belt=new MB();
  belt.add(PR.torus(.625,.095,28,8,W),T(0,.48,0,1.0,1.0,.95));
  belt.add(PR.box(.36,.34,.06,W),T(0,.30,.60));
  for(let i=-2;i<=2;i++)belt.add(PR.box(.045,.2,.03,[.85,.85,.85]),T(i*.075,.08,.605));
  belt.add(PR.ellipsoid(.12,.1,.1,10,8,W),T(0,.5,-.64));
  M.belt=belt.build(gl);
  M.head=PR.sphere(.34,20,14,W).build(gl);
  M.face=PR.facePatch(.346,.60,.50,10).build(gl);
  // hair cap + topknot
  const hair=new MB();
  {
    const cap=new MB(),segs=18,rings=6,r=.356,lat0=28*Math.PI/180;
    for(let j=0;j<=rings;j++){const lat=lat0+(Math.PI/2-lat0)*j/rings;for(let i=0;i<=segs;i++){const ph=i/segs*TAU,x=Math.cos(lat)*Math.cos(ph),y=Math.sin(lat),z=Math.cos(lat)*Math.sin(ph);cap.v(x*r,y*r,z*r,x,y,z,0,0,1,1,1)}}
    for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){const a=j*(segs+1)+i,b=a+segs+1;cap.quad(a,b,b+1,a+1)}
    hair.add(cap);
  }
  hair.add(PR.ellipsoid(.12,.08,.17,10,8,W),T(0,.40,-.10)).add(PR.cyl(.05,.07,.1,8,W),T(0,.36,-.02));
  M.hair=hair.build(gl);
  // limbs hang from their pivot (origin = shoulder / hip)
  M.arm=new MB().add(PR.capsule(.135,.2,10,4,W),T(0,-.235,0)).add(PR.sphere(.165,10,8,W),T(0,-.50,.02)).build(gl);
  M.leg=new MB().add(PR.capsule(.175,.06,10,4,W),T(0,-.205,0)).add(PR.ellipsoid(.2,.09,.28,10,8,W),T(0,-.34,.09)).build(gl);
  // accessories (head space)
  const gold=[1,.82,.2],red=[.95,.2,.25],cream=[.96,.92,.8],green=[.35,.8,.3],white=[1,1,1];
  const A=[];
  { const m=new MB();                                   // 0 crown
    m.add(PR.lathe([{r:.285,y:.27,hard:true},{r:.285,y:.395,hard:true},{r:.245,y:.395,hard:true},{r:.245,y:.27,hard:true}],18,gold));
    for(let k=0;k<5;k++){const a=k/5*TAU;m.add(PR.cone(.058,.15,8,gold),T(Math.cos(a)*.265,.395,Math.sin(a)*.265));m.add(PR.sphere(.03,6,5,[1,.9,.5]),T(Math.cos(a)*.265,.56,Math.sin(a)*.265))}
    m.add(PR.sphere(.05,8,6,red),T(0,.335,.285));A.push(m.build(gl)) }
  { const m=new MB();                                   // 1 headband
    m.add(PR.torus(.345,.03,24,6,W),T(0,.13,0,1,1,1));m.add(PR.box(.07,.2,.03,W),T(.1,.0,-.4)).add(PR.box(.07,.18,.03,W),T(-.1,-.02,-.4));
    A.push(m.build(gl)) }
  { const m=new MB();                                   // 2 bow
    m.add(PR.cone(.1,.2,8,W),T(.16,.38,.0)).add(PR.cone(.1,.2,8,W),T(-.0,.38,.0));
    const l=new MB().add(PR.cone(.1,.2,8,W)),r=new MB().add(PR.cone(.1,.2,8,W));
    const mm=new MB();M4.trs(tmp,0,.12,.44,.0,0,0,-Math.PI/2,1,1,1);mm.add(l,tmp.slice());M4.trs(tmp,0,-.12,.44,.0,0,0,Math.PI/2,1,1,1);mm.add(r,tmp.slice());mm.add(PR.sphere(.06,8,6,W),T(0,.44,0));
    A.push(mm.build(gl)) }
  { const m=new MB();                                   // 3 horned cap
    m.add(PR.ellipsoid(.35,.2,.35,14,8,[.7,.72,.78]),T(0,.24,0));
    for(const s of[-1,1]){M4.trs(tmp,0,s*.31,.36,0,0,0,-s*.8,1,1,1);m.add(PR.cone(.07,.3,8,cream),tmp.slice())}
    A.push(m.build(gl)) }
  { const m=new MB();                                   // 4 sprout
    m.add(PR.cyl(.02,.025,.14,6,green),T(0,.41,0));M4.trs(tmp,0,.07,.5,0,0,0,-.9,1,1,1);m.add(PR.ellipsoid(.1,.035,.05,8,6,[.4,.85,.3]),tmp.slice());M4.trs(tmp,0,-.07,.5,0,0,0,.9,1,1,1);m.add(PR.ellipsoid(.1,.035,.05,8,6,[.4,.85,.3]),tmp.slice());
    A.push(m.build(gl)) }
  { const m=new MB();                                   // 5 chef hat
    m.add(PR.cyl(.24,.22,.2,14,white),T(0,.42,0)).add(PR.sphere(.22,12,8,white),T(0,.6,0)).add(PR.sphere(.14,10,8,white),T(.14,.56,.08)).add(PR.sphere(.14,10,8,white),T(-.14,.56,-.06));
    A.push(m.build(gl)) }
  { const m=new MB();                                   // 6 bandana
    m.add(PR.torus(.345,.045,24,6,W),T(0,.16,0,1,.8,1));M4.trs(tmp,0,.31,.12,-.1,0,0,-.4,1,1,1);m.add(PR.cone(.09,.2,6,W),tmp.slice());
    A.push(m.build(gl)) }
  { const m=new MB();                                   // 7 flower
    for(let k=0;k<5;k++){const a=k/5*TAU;m.add(PR.ellipsoid(.07,.03,.1,8,6,[1,.55,.7]),T(.22+Math.cos(a)*.1,.3,.12+Math.sin(a)*.1))}
    m.add(PR.sphere(.045,8,6,[1,.9,.3]),T(.22,.32,.12));A.push(m.build(gl)) }
  { const m=new MB();                                   // 8 mohawk
    for(let k=0;k<7;k++){const z=-.28+k*.09;m.add(PR.cone(.06,.22-Math.abs(k-3)*.03,6,[.95,.25,.25]),T(0,.28+Math.cos((z)*2.4)*.07,z))}
    A.push(m.build(gl)) }
  { const m=new MB();                                   // 9 party hat
    m.add(PR.cone(.2,.42,12,[.4,.8,1]),T(0,.3,0)).add(PR.sphere(.06,8,6,[1,.9,.2]),T(0,.74,0));
    A.push(m.build(gl)) }
  M.acc=A;
  return M;
}

export class FighterRig{
  constructor(R){
    this.R=R;const gl=R.gl;
    this.M=buildFighterMeshes(gl);
    const cap=MAX_PLAYERS;
    this.b={body:new Batch(gl,this.M.body,cap),belt:new Batch(gl,this.M.belt,cap),head:new Batch(gl,this.M.head,cap),face:new Batch(gl,this.M.face,cap),
            hair:new Batch(gl,this.M.hair,cap),arm:new Batch(gl,this.M.arm,cap*2),leg:new Batch(gl,this.M.leg,cap*2)};
    this.acc=this.M.acc.map(m=>new Batch(gl,m,4));
    this.list=[{batch:this.b.body,outline:1},{batch:this.b.belt,outline:1},{batch:this.b.head,outline:1},{batch:this.b.hair,outline:1},{batch:this.b.arm,outline:1},{batch:this.b.leg,outline:1}]
      .concat(this.acc.map(b=>({batch:b,outline:1})));
    this.faceList=[{batch:this.b.face,outline:0}];
    this.v=[];for(let i=0;i<MAX_PLAYERS;i++)this.v.push(this.makeVis(i));
    this.m0=new Float32Array(16);this.m1=new Float32Array(16);this.m2=new Float32Array(16);this.m3=new Float32Array(16);this.mt=new Float32Array(16);
    this.stage=null;this.out={};
  }
  makeVis(i){
    return {phase:Math.random()*10,t:Math.random()*10,blinkT:2+Math.random()*3,blink:0,hit:0,hitX:0,hitZ:0,land:0,yaw:0,lastState:'',stepSide:0,expr:0,
            dizzy:0,sq:0,lean:0,leanR:0,prevSt:'',winT:0,shown:true,chargeFx:0,spinVis:0,stateT:0,dashTrail:0,squashV:0,lastSt:'',prevCharge:0,teeter:0,aimYaw:0};
  }
  reset(n){for(let i=0;i<MAX_PLAYERS;i++){const v=this.v[i];v.hit=0;v.land=0;v.yaw=0;v.expr=0;v.shown=true;v.winT=0;v.spinVis=0;v.sq=0;v.dizzy=0}}
  setStage(m){this.stage=m}
  onEvent(e){
    const v=e.id!==undefined?this.v[e.id]:null;
    if(e.type==='hit'){const d=this.v[e.dst];if(d){d.hit=1;d.hitX=e.nx;d.hitZ=e.nz;d.hitPow=Math.min(1.4,.45+e.imp/9)}}
    else if(e.type==='land'&&v){v.land=1}
    else if(e.type==='bumper'&&v){v.hit=.8;v.hitX=e.nx;v.hitZ=e.nz;v.hitPow=.8}
  }
  /* build all part instances for this frame */
  update(sim,dt,alpha,fx,time){
    const R=this.R,A=sim.arena;
    for(const k in this.b)this.b[k].clear();
    for(const b of this.acc)b.clear();
    const st=this.stage;
    for(let i=0;i<sim.fighters.length;i++){
      const f=sim.fighters[i],v=this.v[i],sty=STYLES[i%STYLES.length],rgb=STYLE_RGB[i%STYLES.length];
      if(!f.alive&&!f.falling)continue;
      this.pose(sim,f,v,sty,rgb,dt,alpha,fx,time);
    }
    for(const k in this.b)this.b[k].upload();
    for(const b of this.acc)b.upload();
  }
  pose(sim,f,v,sty,rgb,dt,alpha,fx,time){
    const R=this.R;
    v.t+=dt;
    const x=f.px+(f.x-f.px)*alpha,z=f.pz+(f.z-f.pz)*alpha,yy=f.py+(f.y-f.py)*alpha;
    const speed=Math.hypot(f.vx,f.vz);
    // heading
    let tyaw=Math.atan2(f.fx,f.fz);
    if(f.falling||f.down)tyaw=v.yaw;
    if(sim.phase==='roundend'||sim.phase==='matchend'){if(f.winner){const dx=R.cam.eye[0]-x,dz=R.cam.eye[2]-z;tyaw=Math.atan2(dx,dz)}}
    if(v.yaw===0&&v.t<.05)v.yaw=tyaw;
    v.yaw=dampAngle(v.yaw,tyaw,f.charging?30:(f.bashT>0||f.dashT>0?60:18),dt);
    // timers
    v.hit=Math.max(0,v.hit-dt*5.5);v.land=Math.max(0,v.land-dt*4.2);
    v.blinkT-=dt;if(v.blinkT<=0){v.blink=.12;v.blinkT=2.2+Math.random()*3.2}v.blink=Math.max(0,v.blink-dt);
    const he=v.hit*v.hit;
    // pose defaults
    let pitch=0,roll=0,sy=1,sxz=1,lift=0,flash=0,emi=0,expr=0,scale=sty.size,armF=0,armF2=0,armAb=.34,armAb2=.34,legL=0,legR=0,headP=0,headY=0,headR=0,wob=0,shakeX=0,shakeZ=0,yawAdd=0;
    const state=f.state;
    const runK=Math.min(1,speed/3.4);
    if(state==='run'||state==='charge'||state==='stagger'){v.phase+=speed*dt*3.4}
    const ph=v.phase;
    const bodyBreath=Math.sin(v.t*2.3+v.phase)*.018;
    sy=1+bodyBreath;sxz=1-bodyBreath*.5;
    expr=v.blink>0?9:0;
    if(state==='idle'||state==='run'||state==='teeter'){
      armAb=.30+Math.sin(v.t*1.7)*.04;armAb2=armAb;
    }
    if(state==='run'){
      const s=Math.sin(ph);
      legL=s*.95*runK;legR=-s*.95*runK;roll=s*.09*runK;lift=Math.abs(Math.cos(ph))*.075*runK;pitch=.10+Math.min(.14,speed*.035);
      armF=-s*.7*runK;armF2=s*.7*runK;armAb=.25;armAb2=.25;
      if(Math.floor(ph/Math.PI)!==Math.floor(v.stepSide)&&speed>1.4&&yy<.05){fx.step(x,z,f,sim)}
      v.stepSide=ph/Math.PI;
    }
    if(state==='charge'){
      const c=sat((f.charge-.18)/.82);
      pitch=-.12-.26*c;sy=.97-.14*c;sxz=1.02+.09*c;
      armF=-1.2*c-.2;armF2=armF;armAb=.65+.3*c;armAb2=armAb;
      legL=.25*c;legR=.25*c;
      shakeX=Math.sin(v.t*70)*.028*c;shakeZ=Math.cos(v.t*63)*.02*c;
      expr=2;emi=0;flash=f.chargeFull?(Math.sin(v.t*34)*.5+.5)*.45:c*.12;
      if(c>.1)fx.charge(x,z,f,c,dt);
    }
    if(state==='bash'){
      const p=sat(f.bashT/Math.max(.05,f.bashDur));
      const k=Math.sin(Math.min(1,p*1.25)*Math.PI);
      pitch=.18+.55*k;sy=1-.10*k;sxz=1+.04*k;
      armF=.9+1.2*smooth(p*3);armF2=armF;armAb=.15;armAb2=.15;legL=.5;legR=-.35;
      expr=1;lift=.05*k;
    }
    if(state==='dash'){
      pitch=.78;sy=.9;sxz=1.04;armF=-1.1;armF2=-1.1;armAb=.5;armAb2=.5;legL=Math.sin(ph*3)*1.0;legR=-legL;ph+0;expr=7;
      v.phase+=dt*20;fx.dashTrail(x,yy,z,f,dt);
    }
    if(state==='stagger'){
      const k=sat(f.stagger/.45);
      pitch=-.45*k+Math.sin(v.t*40)*.05*k;roll=Math.sin(v.t*33)*.12*k;armF=Math.sin(v.t*26)*.9;armF2=-armF;armAb=.8;armAb2=.8;expr=3;legL=Math.sin(ph)*.4;legR=-legL;
    }
    if(state==='teeter'){
      pitch=Math.sin(v.t*13)*.28-.1;armF=Math.sin(v.t*19)*1.4;armF2=-Math.sin(v.t*19)*1.4;armAb=1.0;armAb2=1.0;expr=5;sy=1.02;
      legL=Math.sin(v.t*15)*.3;legR=-legL;
    }
    if(state.startsWith('down')){
      const D=TUNE.down,dt_=f.downT,side=f.downSide;
      let k=0;
      if(f.downStage==='impact')k=easeOutCubic(dt_/D.impact);
      else if(f.downStage==='limp')k=1;
      else if(f.downStage==='brace')k=1-.15*sat((dt_-D.impact-D.limp)/D.brace);
      else k=.85*(1-smooth((dt_-D.impact-D.limp-D.brace)/D.rise));
      pitch=-side*1.35*k;lift=.46*k;sy=1+.02*k;
      armF=1.6*k;armF2=1.4*k;armAb=1.1*k;armAb2=.9*k;legL=-.5*k;legR=-.3*k;
      expr=f.downStage==='rise'?1:4;roll=Math.sin(v.t*2)*.02;
      if(f.downStage==='impact'&&v.stateT<=0)fx.thud(x,z);
      if(f.downStage==='limp'||f.downStage==='brace')v.dizzy=1;
      if(f.downStage==='rise'){armF=-.8*k;armF2=-.8*k;legL=0;legR=0}
    }
    if(state==='win'||f.winner){
      const wt=v.winT+=dt;
      lift=Math.abs(Math.sin(wt*6))*.38;armF=2.7;armF2=2.7;armAb=.7+Math.sin(wt*12)*.15;armAb2=armAb;expr=6;sy=1+Math.sin(wt*12)*.04;
      pitch=-.05;legL=Math.sin(wt*12)*.3;legR=-legL;
      if(wt<.05)fx.win(x,z,f);
    }else v.winT=0;
    if(state==='fall'){
      const ft=f.fallT;
      expr=5;armF=Math.sin(v.t*30)*1.5;armF2=-armF;armAb=1.2;armAb2=1.2;legL=Math.sin(v.t*24)*1.0;legR=-legL;
      v.spinVis+=f.spinV*dt*.6;
      scale*=clamp(1-ft*.22,.4,1);
      roll=Math.sin(ft*9)*.5;pitch=-.4+Math.sin(ft*7)*.3;
    }
    // ---- squash / stretch / lean reactions
    if(v.land>0){const l=v.land;sy*=1-.28*l*l;sxz*=1+.2*l*l}
    if(he>0&&!state.startsWith('down')){
      const p=v.hitPow||.6;
      sy*=1-.20*he*p;sxz*=1+.14*he*p;flash=Math.max(flash,he*.9);
      // lean away from the blow (in the fighter's frame)
      const cy=Math.cos(v.yaw),sn=Math.sin(v.yaw);const lx=v.hitX*cy-v.hitZ*sn,lz=v.hitX*sn+v.hitZ*cy; // hit dir in local space
      pitch+=-lz*.55*he*p;roll+=lx*.4*he*p;
      if(state!=='stagger')expr=3;
    }
    if(f.protect>0&&!f.down)flash=Math.max(flash,(Math.sin(v.t*30)*.5+.5)*.18);
    if(v.stateT<=0||v.lastSt!==state){v.lastSt=state;v.stateT=0}
    v.stateT+=dt;
    // ---- matrices
    const st=this.stage,m0=this.m0,m1=this.m1,m2=this.m2,mt=this.mt;
    const gy=yy+lift;
    M4.trs(m0,0,x+shakeX,gy,z+shakeZ,v.yaw+yawAdd+v.spinVis*(state==='fall'?1:0),pitch,roll,sxz*scale,sy*scale,sxz*scale);
    let root=m0;if(st){M4.mul(m3_(this),st,m0);root=m3_(this)}
    const b=this.b;
    const skin=rgb.skin,belt=rgb.belt,hair=rgb.hair;
    const eFlash=flash;
    b.body.addM(root,skin[0],skin[1],skin[2],emi,eFlash,-1,0,0);
    b.belt.addM(root,belt[0],belt[1],belt[2],emi,eFlash*.8,-1,0,0);
    // head
    const bob=Math.sin(v.t*2.3+1)*.012+(state==='run'?Math.abs(Math.cos(ph))*.03*runK:0);
    M4.trs(mt,0,0,1.24+bob,.10,headY,headP,headR,1,1,1);M4.mul(m1,root,mt);
    b.head.addM(m1,skin[0],skin[1],skin[2],emi,eFlash,-1,0,0);
    b.hair.addM(m1,hair[0],hair[1],hair[2],0,eFlash,-1,0,0);
    b.face.addM(m1,1,1,1,0,eFlash*.5,expr,0,0);
    const ac=this.acc[sty.acc];
    if(ac){const tint=(sty.acc===1||sty.acc===6)?belt:[1,1,1];ac.addM(m1,tint[0],tint[1],tint[2],0,eFlash,-1,0,0)}
    // arms (shoulder pivots)
    for(let s=-1;s<=1;s+=2){
      const fw=s>0?armF:armF2,ab=s>0?armAb:armAb2;
      M4.trs(mt,0,s*.64,1.0,0,0,-fw,s*ab,1,1,1);M4.mul(m2,root,mt);
      b.arm.addM(m2,skin[0],skin[1],skin[2],emi,eFlash,-1,0,0);
    }
    // legs
    for(let s=-1;s<=1;s+=2){
      const sw=s>0?legL:legR;
      M4.trs(mt,0,s*.27,.40,0,0,-sw,0,1,1,1);M4.mul(m2,root,mt);
      b.leg.addM(m2,skin[0],skin[1],skin[2],emi,eFlash,-1,0,0);
    }
    // visual outputs for FX/labels
    v.wx=x;v.wz=z;v.wy=gy;
    // dizzy stars
    if(v.dizzy>0&&state.startsWith('down')){fx.dizzy(x,gy+1.7,z,v.t);v.dizzy=0}
  }
  drawFaces(){}
}
function m3_(r){return r.m3}
