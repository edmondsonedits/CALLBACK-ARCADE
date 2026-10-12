/* ============================================================================
   ROYAL SUMO - MAPS  (geometry + hazard rules + AI hooks; pure logic, no GL)
   Every map implements:
     build(sim,rng)            -> arena state A (R0, core, coreScale, suddenT, spawnR + map data)
     update(sim,dt)            -> advance hazards (live fight only)
     supported(sim,x,z,pad)    -> is there floor under this point
     fallCause(sim,x,z,pad)    -> 'collapse' | 'edge' | 'hole'
     solidR / knownR           -> radius that is solid now / that bots believe is safe
     pushDir(sim,tx,tz)        -> unit vector bots try to shove a target along (null = outward)
     interact(sim,f,dt)        -> per-fighter hazard contact (bumpers, rail, sweepers)
     aiAvoid(sim,f,ai)         -> {gx,gz,urg,dash} steering advice for bots (urg>=1 overrides)
     hud(sim)                  -> {tag,t,urgent} for the hazard banner
     phys                      -> {dragMul,accelMul,kbMul} floor feel
   ========================================================================== */
import {TAU, angDiff, clamp, smooth} from './util.js';
import {LENGTH_SECS, TUNE} from './tune.js';
export const MAP_ORDER=['keep','floe','plaza','wharf','teeter','mesa'];
export const MAPS={};

export function polarAng(x,z){const a=Math.atan2(z,x);return a<0?a+TAU:a}
function coreR(A){return A.core*A.coreScale}
function hzScale(H){return H>0?Math.pow(1/H,.8):2.2}           // timeline stretch: mild slower, wild faster, off very late
function pickLen(O){return LENGTH_SECS[O.length]||0}
function baseArena(sim,R0,core,suddenAuto,o){
  const L=pickLen(sim.O),n=sim.n;
  if(!o||o.kind!=='rings'&&o.kind!=='wedges')suddenAuto*=n>4?clamp(1-.045*(n-4),.72,1):1;     // crowds get a shorter fuse on hazard-free maps
  return Object.assign({R0,core,coreScale:1,coreMinR:Math.min(core,1.35),sudden:false,suddenT:L>0?L:suddenAuto,
    spawnR:Math.min(R0*.62,core*.92),shrinkDur:16,railOn:false},o||{});
}
function suddenUpdate(sim,A){
  if(sim.t>=A.suddenT){
    if(!A.sudden){A.sudden=true;sim.emit('sudden',{})}
    A.coreScale=1-(1-A.coreMinR/A.core)*smooth((sim.t-A.suddenT)/A.shrinkDur);
  }
}
function segDist(px,pz,ux,uz,s0,s1){          // distance from p to segment s0..s1 along unit (ux,uz) from origin
  const s=clamp(px*ux+pz*uz,s0,s1),qx=ux*s,qz=uz*s;
  return {d:Math.hypot(px-qx,pz-qz),s,qx,qz};
}

/* ================================================================== KEEP ==== */
MAPS.keep={
  id:'keep',name:'Crownfall Keep',tag:'Collapsing rings',icon:'keep',
  blurb:'Stone rings crumble into the lava, outside in. Read the red warnings, hold the middle and shove rivals onto doomed tiles.',
  tips:['A red ring falls about 2 seconds after it flashes.','Stay off the outer ring once things get tense.','Charge a BASH while rivals scramble inward.'],
  style:'Positioning',phys:{},
  build(sim,rng){
    const T=TUNE.arena,O=sim.O,n=sim.n,H=sim.H;
    const R0=(T.r0base+T.r0per*(n-2))*O.arena,core=(T.core0+T.corePer*(n-2))*O.arena;
    const nRings=n<=3?3:(n<=7?4:5),width=(R0-core)/nRings;
    let first=T.first0+T.firstPer*(n-2),interval=T.int0+T.intPer*(n-2);
    const hs=hzScale(H);first*=hs;interval*=hs;
    const lead=T.warnLead*(H>0?Math.pow(1/H,.35):1.25),tail=lead+T.sweep+.06+T.sudden;
    const L=pickLen(O);
    if(L>0){const sched=first+(nRings-1)*interval,s=Math.max(.25,(L-tail)/sched);first*=s;interval*=s}
    const rings=[];
    for(let i=0;i<nRings;i++){
      const outer=R0-i*width,inner=outer-width,mid=(outer+inner)/2;
      const S=Math.max(10,Math.round(TAU*mid/T.tile));
      const warnT=first+i*interval,dropT=warnT+lead;
      const j0=Math.floor(rng()*S),dir=rng()<.5?1:-1,dropAt=new Float32Array(S);
      for(let j=0;j<S;j++){const k=(((j-j0)*dir)%S+S)%S;dropAt[j]=dropT+k/S*T.sweep+(rng()-.5)*.10}
      rings.push({i,outer,inner,S,warnT,dropT,dropAt,lastDrop:dropT+T.sweep+.06,warned:false,dropped:false,gone:false});
    }
    const auto=rings[nRings-1].lastDrop+T.sudden;
    return baseArena(sim,R0,core,auto,{kind:'rings',nRings,width,rings,first,interval,lead,coreMinR:core*T.coreMin});
  },
  update(sim,dt){
    const A=sim.arena,t=sim.t;
    for(const r of A.rings){
      if(!r.warned&&t>=r.warnT){r.warned=true;sim.emit('warn',{ring:r.i,drop:r.dropT-t})}
      if(!r.dropped&&t>=r.dropT){r.dropped=true;sim.emit('drop',{ring:r.i})}
      if(!r.gone&&t>=r.lastDrop){r.gone=true;sim.emit('ringGone',{ring:r.i,last:r.i===A.nRings-1,radius:r.inner})}
    }
    suddenUpdate(sim,A);
  },
  supported(sim,x,z,pad){
    const A=sim.arena;const d=Math.hypot(x,z)-pad;
    if(d<=A.core*A.coreScale)return true;
    if(d>A.R0)return false;
    let i=Math.floor((A.R0-d)/A.width);if(i>=A.nRings)i=A.nRings-1;if(i<0)i=0;
    const r=A.rings[i];let a=Math.atan2(z,x);if(a<0)a+=TAU;
    return sim.t<r.dropAt[Math.min(r.S-1,Math.floor(a/TAU*r.S))];
  },
  fallCause(sim,x,z,pad){
    const A=sim.arena;const d=Math.hypot(x,z)-pad;
    if(d<=A.core*A.coreScale||d>A.R0)return 'edge';
    let i=Math.floor((A.R0-d)/A.width);if(i>=A.nRings)i=A.nRings-1;if(i<0)i=0;
    const r=A.rings[i];let a=Math.atan2(z,x);if(a<0)a+=TAU;
    return sim.t-r.dropAt[Math.min(r.S-1,Math.floor(a/TAU*r.S))]<1?'collapse':'edge';
  },
  solidR(sim){const A=sim.arena;for(const r of A.rings){if(sim.t<r.dropT)return r.outer}return coreR(A)},
  knownR(sim,ang,react){const A=sim.arena;for(const r of A.rings){if(sim.t-react<r.warnT)return r.outer}return coreR(A)},
  pushDir(){return null},
  hud(sim){
    const A=sim.arena,t=sim.t;
    for(const r of A.rings){
      if(t<r.warnT)return {tag:'NEXT COLLAPSE',t:r.warnT-t,urgent:false};
      if(t<r.dropT+TUNE.arena.sweep)return {tag:'COLLAPSING',t:Math.max(0,r.dropT-t),urgent:true};
    }
    return null;
  }
};

/* ================================================================== FLOE ==== */
MAPS.floe={
  id:'floe',name:'Frostbite Floe',tag:'Ice + cracking shards',icon:'floe',
  blurb:'Slick ice that never stops sliding, and shards that crack off the rim. Brake early: one hard bash can send a rival across the whole floe.',
  tips:['Let go of the stick to glide; steer early, not late.','A DASH on ice is a missile. You will not stop.','Shards glow and shake before they drop.'],
  style:'Momentum',phys:{dragMul:.34,accelMul:.42,kbMul:.64},
  build(sim,rng){
    const O=sim.O,n=sim.n,H=sim.H;
    const R0=(5.4+.30*(n-2))*O.arena,core=R0*.5,S=n<=3?8:(n<=6?10:12);
    const hs=hzScale(H);let first=7.0*hs,int0=3.1*hs;const decay=.93,lead=2.0*(H>0?Math.pow(1/H,.3):1.3),tail=lead+.4+7;
    const L=pickLen(O);
    if(L>0){let sched=first,iv=int0;for(let k=1;k<S;k++){sched+=iv;iv*=decay}const s=Math.max(.25,(L-tail)/sched);first*=s;int0*=s}
    // crack order: random, but consecutive shards stay apart so the danger zone keeps moving
    const left=[];for(let i=0;i<S;i++)left.push(i);
    const order=[];let prev=-9;
    while(left.length){
      let cand=left.filter(i=>{const d=Math.abs(i-prev);return Math.min(d,S-d)>=2});
      if(!cand.length)cand=left;
      const pick=cand[Math.floor(rng()*cand.length)];
      order.push(pick);left.splice(left.indexOf(pick),1);prev=pick;
    }
    const wedges=new Array(S);let tt=first,iv=int0;
    for(let k=0;k<S;k++){
      const i=order[k];
      wedges[i]={i,a0:i*TAU/S,a1:(i+1)*TAU/S,warnT:tt,dropT:tt+lead,order:k,warned:false,dropped:false};
      tt+=iv;iv*=decay;
    }
    const lastDrop=Math.max(...wedges.map(w=>w.dropT));
    return baseArena(sim,R0,core,lastDrop+7,{kind:'wedges',S,wedges,lead,coreMinR:core*.52});
  },
  update(sim,dt){
    const A=sim.arena,t=sim.t;
    for(const w of A.wedges){
      if(!w.warned&&t>=w.warnT){w.warned=true;sim.emit('warn',{wedge:w.i,drop:w.dropT-t,a0:w.a0,a1:w.a1})}
      if(!w.dropped&&t>=w.dropT){w.dropped=true;sim.emit('drop',{wedge:w.i,a0:w.a0,a1:w.a1})}
    }
    suddenUpdate(sim,A);
  },
  supported(sim,x,z,pad){
    const A=sim.arena;const d=Math.hypot(x,z)-pad;
    if(d<=A.core*A.coreScale)return true;
    if(d>A.R0)return false;
    return sim.t<A.wedges[Math.min(A.S-1,Math.floor(polarAng(x,z)/TAU*A.S))].dropT;
  },
  fallCause(sim,x,z,pad){
    const A=sim.arena;const d=Math.hypot(x,z)-pad;
    if(d<=A.core*A.coreScale||d>A.R0)return 'edge';
    return sim.t-A.wedges[Math.min(A.S-1,Math.floor(polarAng(x,z)/TAU*A.S))].dropT<1?'collapse':'edge';
  },
  solidR(sim,ang){const A=sim.arena;const w=A.wedges[Math.min(A.S-1,Math.floor(ang/TAU*A.S))];return sim.t<w.dropT?A.R0:coreR(A)},
  knownR(sim,ang,react){const A=sim.arena;const w=A.wedges[Math.min(A.S-1,Math.floor(ang/TAU*A.S))];return (sim.t-react<w.warnT)?A.R0:coreR(A)},
  pushDir(sim,tx,tz){                                  // shove people toward the shard that is about to go
    const A=sim.arena,t=sim.t;let best=null,bd=1e9;
    for(const w of A.wedges){
      if(!w.warned||t>=w.dropT-.35)continue;
      const am=(w.a0+w.a1)/2,rm=(A.R0+coreR(A))/2,cx=Math.cos(am)*rm,cz=Math.sin(am)*rm,d=Math.hypot(cx-tx,cz-tz);
      if(d<bd){bd=d;best=[cx-tx,cz-tz,d]}
    }
    if(best&&bd<4.6)return [best[0]/bd,best[1]/bd];
    return null;
  },
  hud(sim){
    const A=sim.arena,t=sim.t;let nextWarn=1e9,cracking=false,tl=1e9;
    for(const w of A.wedges){
      if(w.warned&&!w.dropped){cracking=true;tl=Math.min(tl,w.dropT-t)}
      else if(!w.warned)nextWarn=Math.min(nextWarn,w.warnT-t);
    }
    if(cracking)return {tag:'ICE CRACKING',t:Math.max(0,tl),urgent:true};
    if(nextWarn<1e8)return {tag:'NEXT CRACK',t:nextWarn,urgent:false};
    return null;
  }
};

/* ================================================================= PLAZA ==== */
MAPS.plaza={
  id:'plaza',name:'Pinball Plaza',tag:'Bumpers + drifting gates',icon:'plaza',
  blurb:'Springy bumpers and a rubber rail with drifting gates. Bank rivals off the bumpers, then bash them through an open gate.',
  tips:['The rail bounces you back, except at the gates.','Bumpers launch anything that touches them.','Gates drift slowly. Always know where they are.'],
  style:'Bank shots',phys:{},
  build(sim,rng){
    const O=sim.O,n=sim.n,H=sim.H;
    const R0=(5.2+.30*(n-2))*O.arena,nGaps=n<=5?3:4;
    const nB=H<=0?0:(H<.9?3:(H<1.2?5:7));
    const gapHalf=nGaps===3?.40:.33,spawnR=R0*.62;
    // bumper ring: rotate it to maximise clearance from the spawn points
    const bR=R0*.43,bumpers=[];
    if(nB>0){
      let bestOff=0,bestClear=-1;
      for(let s=0;s<72;s++){
        const off=s/72*TAU/nB;let clear=1e9;
        for(let k=0;k<nB;k++){
          const ba=off+k*TAU/nB,bx=Math.cos(ba)*bR,bz=Math.sin(ba)*bR;
          for(let i=0;i<n;i++){const a=Math.PI/2+i*TAU/n;clear=Math.min(clear,Math.hypot(bx-Math.cos(a)*spawnR,bz-Math.sin(a)*spawnR))}
        }
        if(clear>bestClear){bestClear=clear;bestOff=off}
      }
      for(let k=0;k<nB;k++){const ba=bestOff+k*TAU/nB;bumpers.push({x:Math.cos(ba)*bR,z:Math.sin(ba)*bR,r:.55,pulse:0,hits:0})}
    }
    const auto=22;
    return baseArena(sim,R0,R0,auto,{kind:'disc',bumpers,nGaps,gapHalf,gapAng:rng()*TAU,gapW:(H>0?.30*(.6+.5*H):.14)*(rng()<.5?-1:1),railOn:true,
      coreMinR:1.4,spawnR,shrinkDur:12,bumperPop:1});
  },
  update(sim,dt){
    const A=sim.arena;
    A.gapAng+=A.gapW*dt;
    for(const b of A.bumpers)b.pulse=Math.max(0,b.pulse-dt*4.5);
    suddenUpdate(sim,A);
    if(A.sudden&&A.railOn){A.railOn=false;sim.emit('railDown',{})}
  },
  supported(sim,x,z,pad){const A=sim.arena;return Math.hypot(x,z)-pad<=A.core*A.coreScale},
  fallCause(){return 'edge'},
  inGap(A,ang,extra){
    for(let k=0;k<A.nGaps;k++){
      const g=A.gapAng+k*TAU/A.nGaps;
      if(Math.abs(angDiff(g,ang))<A.gapHalf+(extra||0))return k;
    }
    return -1;
  },
  solidR(sim,ang){const A=sim.arena;return A.railOn&&MAPS.plaza.inGap(A,ang,0)<0?A.R0+.5:coreR(A)},
  knownR(sim,ang,react){
    const A=sim.arena;if(!A.railOn)return coreR(A);
    return MAPS.plaza.inGap(A,ang,.22)>=0?A.R0-1.1:A.R0+.5;
  },
  pushDir(sim,tx,tz){                                  // shove toward the nearest gate
    const A=sim.arena;if(!A.railOn)return null;
    const ta=polarAng(tx,tz);let bd=9,bg=0;
    for(let k=0;k<A.nGaps;k++){const g=A.gapAng+k*TAU/A.nGaps,d=Math.abs(angDiff(g,ta));if(d<bd){bd=d;bg=g}}
    if(bd>1.5)return null;
    const gx=Math.cos(bg)*(A.R0+1),gz=Math.sin(bg)*(A.R0+1),dx=gx-tx,dz=gz-tz,m=Math.hypot(dx,dz)||1;
    return [dx/m,dz/m];
  },
  interact(sim,f,dt){
    const A=sim.arena;if(f.falling||!f.alive)return;
    // bumpers
    for(let i=0;i<A.bumpers.length;i++){
      const b=A.bumpers[i];
      let dx=f.x-b.x,dz=f.z-b.z,d=Math.hypot(dx,dz);const min=b.r+f.r;
      if(d>=min)continue;
      if(d<1e-4){dx=1;dz=0;d=1e-4}
      const nx=dx/d,nz=dz/d;
      f.x=b.x+nx*(min+.01);f.z=b.z+nz*(min+.01);
      const vn=f.vx*nx+f.vz*nz;
      if(vn<0){
        const out=Math.max(4.4,-vn*1.25+1.0)*sim.P.kbBumper;
        f.vx+=nx*(out-vn);f.vz+=nz*(out-vn);
        f.stagger=Math.max(f.stagger,.16);if(f.dashT>0){f.dashT=0;f.recover=Math.max(f.recover,.18)}
        if(f.bashT>0){f.bashT=0;f.recover=Math.max(f.recover,.18)}
        f.charging=false;f.charge=0;f.chargeFull=false;
        b.pulse=1;b.hits++;
        f.stab=clamp(f.stab-2.0*sim.P.dmg,0,100);f.noRegen=Math.max(f.noRegen,.6);
        f.vy=Math.max(f.vy,1.1);f.spinV+=(sim.rng()-.5)*6;
        sim.emit('bumper',{id:f.id,idx:i,x:b.x+nx*b.r,z:b.z+nz*b.r,nx,nz,speed:-vn});
        if(f.stab<=0&&!f.down)sim.startDown(f,nx,nz);
      }
    }
    // rubber rail
    if(A.railOn){
      const d=Math.hypot(f.x,f.z),lim=A.R0-.04;
      if(d+f.r>lim&&d>.01){
        const ang=polarAng(f.x,f.z);
        if(MAPS.plaza.inGap(A,ang,-.04)<0){
          const nx=f.x/d,nz=f.z/d,vr=f.vx*nx+f.vz*nz;
          const k=lim-f.r;f.x=nx*k;f.z=nz*k;
          if(vr>0){
            f.vx-=nx*vr*1.65;f.vz-=nz*vr*1.65;
            if(vr>1.4){f.stagger=Math.max(f.stagger,.08);sim.emit('rail',{id:f.id,x:nx*A.R0,z:nz*A.R0,nx,nz,speed:vr})}
          }
        }
      }
    }
  },
  aiAvoid(sim,f,ai){
    const A=sim.arena;let gx=0,gz=0;
    for(const b of A.bumpers){
      const dx=f.x-b.x,dz=f.z-b.z,d=Math.hypot(dx,dz),sk=f.D?f.D.dodge:.32,range=b.r+f.r+.7+.9*sk;
      if(d<range&&d>.01){const w=1-d/range;gx+=dx/d*w*(1.8+1.2*sk);gz+=dz/d*w*(1.8+1.2*sk)}
    }
    return (gx||gz)?{gx,gz,urg:.9}:null;
  },
  hud(sim){return sim.arena.railOn?null:null}
};

/* ================================================================= WHARF ==== */
MAPS.wharf={
  id:'wharf',name:'Windmill Wharf',tag:'Sweeper arms',icon:'wharf',
  blurb:'Giant windmill arms sweep the dock. The center island is safe from them, so fight for it, and DASH to duck under a passing arm.',
  tips:['The center island is safe from the arms.','DASH ducks under an arm: you cannot be hit mid-dash.','Arms slow and reverse every so often.'],
  style:'King of the hill',phys:{},
  build(sim,rng){
    const O=sim.O,n=sim.n,H=sim.H;
    const R0=(5.6+.30*(n-2))*O.arena,K=H<=0?0:(H<.9?1:(H<1.2?2:3));
    const island=2.7*Math.min(1.1,O.arena);
    const baseW=.70*(H<=0?1:(H<.9?.8:(H<1.2?1:1.3)));
    return baseArena(sim,R0,R0,40,{kind:'sweep',K,island,armL:R0-.45,armHalf:.21,ang:Math.PI/2+Math.PI/n+(rng()<.5?0:Math.PI/Math.max(1,K)),dir:rng()<.5?-1:1,baseW,
      omega:0,mul:1,phase:0,phaseT:0,flipIn:8+rng()*3,coreMinR:1.45,spawnR:R0*.62});
  },
  update(sim,dt){
    const A=sim.arena,t=sim.t;
    if(A.K>0){
      // reversal: wind down (0.7s), flip, wind up (0.7s)
      if(A.phase===0){A.flipIn-=dt;if(A.flipIn<=0){A.phase=1;A.phaseT=0;sim.emit('sweepWarn',{})}}
      else if(A.phase===1){A.phaseT+=dt;A.mul=1-smooth(A.phaseT/.7);if(A.phaseT>=.7){A.dir=-A.dir;A.phase=2;A.phaseT=0;sim.emit('sweepReverse',{dir:A.dir})}}
      else{A.phaseT+=dt;A.mul=smooth(A.phaseT/.7);if(A.phaseT>=.7){A.phase=0;A.mul=1;A.flipIn=7.5+sim.rng()*3.5}}
      const w=A.baseW*(1+.7*smooth(t/A.suddenT))*A.mul*smooth(t/2.2);
      A.omega=A.dir*w;A.ang+=A.omega*dt;
    }
    suddenUpdate(sim,A);
  },
  supported(sim,x,z,pad){const A=sim.arena;return Math.hypot(x,z)-pad<=A.core*A.coreScale},
  fallCause(){return 'edge'},
  solidR(sim){return coreR(sim.arena)},
  knownR(sim){return coreR(sim.arena)},
  pushDir(){return null},
  armHitTime(A,f){                                   // seconds until the nearest arm reaches fighter f (Infinity if none / stopped)
    if(A.K<=0)return 1e9;
    const d=Math.hypot(f.x,f.z),fa=polarAng(f.x,f.z),sg=Math.sign(A.omega||A.dir),w=Math.abs(A.omega);
    if(d<A.island-.9||d>A.armL+.7||w<.05)return 1e9;
    const half=Math.asin(Math.min(.95,(A.armHalf+f.r)/Math.max(d,1)));
    let best=1e9;
    for(let k=0;k<A.K;k++){
      const th=A.ang+k*TAU/A.K;let dl=(((fa-th)*sg)%TAU+TAU)%TAU;     // angle the arm still has to turn
      if(dl>TAU-half)dl=0;                                            // already touching
      best=Math.min(best,Math.max(0,dl-half)/w);
    }
    return best;
  },
  interact(sim,f,dt){
    const A=sim.arena;if(A.K<=0||f.falling||!f.alive)return;
    const t=sim.t;
    for(let k=0;k<A.K;k++){
      const th=A.ang+k*TAU/A.K,ux=Math.cos(th),uz=Math.sin(th);
      const sd=segDist(f.x,f.z,ux,uz,A.island,A.armL);
      const reach=A.armHalf+f.r;
      if(sd.d>=reach)continue;
      if(f.armImm[k]>t)continue;
      if(f.down)continue;                              // arms pass over a fighter lying down
      if(f.dashT>0){f.armImm[k]=t+.55;sim.emit('duck',{id:f.id,x:f.x,z:f.z});continue}
      const sg=Math.sign(A.omega||A.dir),vt=Math.abs(A.omega)*sd.s;
      let tx=-uz*sg,tz=ux*sg;                          // direction the arm is travelling
      const fd=Math.hypot(f.x,f.z)||1,ox=f.x/fd,oz=f.z/fd;
      let nx=tx+ox*.45,nz=tz+oz*.45;const nm=Math.hypot(nx,nz)||1;nx/=nm;nz/=nm;
      // lift the fighter clear of the beam on its leading side
      const px=f.x-sd.qx,pz=f.z-sd.qz,pd=Math.hypot(px,pz)||1;
      const side=(px*tx+pz*tz)>=0?1:-1;
      f.x=sd.qx+(side>0?px/pd:tx)*(reach+.03);f.z=sd.qz+(side>0?pz/pd:tz)*(reach+.03);
      f.armImm[k]=t+.9;
      sim.hit(f,null,nx,nz,2.5+.6*vt,9,'sweeper',0);
      sim.emit('sweep',{id:f.id,x:f.x,z:f.z,nx,nz,speed:vt});
    }
  },
  aiAvoid(sim,f,ai){
    const A=sim.arena;if(A.K<=0)return null;
    const D=f.D,d=Math.hypot(f.x,f.z)||1e-3,tau=MAPS.wharf.armHitTime(A,f);
    if(tau>1.15)return null;
    // roll once per pass: sharp bots react, sloppy ones get clipped
    if(sim.t-(ai.armRollT||-9)>1.6){ai.armRollT=sim.t;ai.armDodge=sim.rng()<clamp(D.dodge*1.7+.1,.08,.97)}
    if(!ai.armDodge)return null;
    const ix=-f.x/d,iz=-f.z/d,sp=3.3;
    const need=Math.max(0,d-(A.island-.9))/sp;
    if(f.dashCd<=0&&tau<.36&&tau>.04&&f.recover<=0&&f.stagger<=0&&f.bashT<=0&&need>tau-.05)return {gx:ix,gz:iz,urg:1,dash:true};
    if(need<tau+.1)return {gx:ix,gz:iz,urg:1};
    return {gx:ix,gz:iz,urg:.8};
  },
  hud(sim){const A=sim.arena;return A.phase===1?{tag:'ARMS REVERSING',t:Math.max(0,.7-A.phaseT),urgent:true}:null}
};

/* ================================================================ TEETER ==== */
MAPS.teeter={
  id:'teeter',name:'Teeter Temple',tag:'Weight-tilting floor',icon:'teeter',
  blurb:'An ancient balance disc tips toward wherever the weight is. Camp near the rim and the floor slides you off, so stay central and shove rivals outward.',
  tips:['The floor slopes toward the crowd\'s combined weight.','Charging and fallen fighters weigh more.','Fight near the middle; the rim slides away.'],
  style:'Balance',phys:{},
  build(sim,rng){
    const O=sim.O,n=sim.n,H=sim.H;
    const R0=(5.4+.30*(n-2))*O.arena;
    return baseArena(sim,R0,R0,40,{kind:'tilt',tx:0,tz:0,gain:5.6*H,maxTilt:.2,resp:.8,wref:2.7,coreMinR:1.45});
  },
  update(sim,dt){
    const A=sim.arena;
    if(A.gain>0){
      let sx=0,sz=0;
      for(const f of sim.fighters){
        if(!f.alive||f.falling)continue;
        const w=f.down?1.7:(f.charging?1.25:(f.dashT>0?1.15:1));
        sx+=w*f.x;sz+=w*f.z;
      }
      let tx=sx/(A.R0*A.wref),tz=sz/(A.R0*A.wref);const m=Math.hypot(tx,tz);if(m>1){tx/=m;tz/=m}
      const k=1-Math.exp(-dt/A.resp);A.tx+=(tx-A.tx)*k;A.tz+=(tz-A.tz)*k;
      const ramp=1+.55*smooth(sim.t/A.suddenT);
      sim.gx=A.tx*A.gain*ramp;sim.gz=A.tz*A.gain*ramp;
    }
    suddenUpdate(sim,A);
  },
  supported(sim,x,z,pad){const A=sim.arena;return Math.hypot(x,z)-pad<=A.core*A.coreScale},
  fallCause(){return 'edge'},
  solidR(sim){return coreR(sim.arena)},
  knownR(sim,ang){
    const A=sim.arena;
    const out=Math.max(0,sim.gx*Math.cos(ang)+sim.gz*Math.sin(ang));       // slope pushing toward the rim here
    return coreR(A)-out*.34;
  },
  pushDir(){return null},
  aiAvoid(sim,f){
    if(Math.abs(sim.gx)+Math.abs(sim.gz)<.3)return null;
    return {gx:-sim.gx*.2,gz:-sim.gz*.2,urg:.6};
  },
  hud(sim){const A=sim.arena;const m=Math.hypot(A.tx,A.tz);return m>.55?{tag:'FLOOR TILTING',t:0,urgent:m>.8,noTime:true}:null}
};

/* ================================================================== MESA ==== */
MAPS.mesa={
  id:'mesa',name:'Meteor Mesa',tag:'Falling stars + craters',icon:'mesa',
  blurb:'Stars rain on the mesa. A red ring marks each impact: it shoves everyone nearby and leaves a crater that stays. Bait rivals into the rings.',
  tips:['A red ring marks an impact about 1.5 seconds ahead.','Craters are permanent holes in the floor.','Stars love to land near the nearest fighter.'],
  style:'Dodge + bait',phys:{},
  build(sim,rng){
    const O=sim.O,n=sim.n,H=sim.H;
    const R0=(5.6+.30*(n-2))*O.arena;
    return baseArena(sim,R0,R0,42,{kind:'mesa',meteors:[],holes:[],nextM:3.4/Math.max(.5,Math.min(1.3,H||.5)),seq:0,
      rate:H,lead:1.55*(H>0?Math.pow(1/H,.22):1),mr:1.7*(H>1.2?1.14:1),holeR:.86,coreMinR:1.45});
  },
  update(sim,dt){
    const A=sim.arena,t=sim.t;
    if(A.rate>0&&!A.sudden){
      if(t>=A.nextM){
        const ramp=smooth(t/A.suddenT);
        const gap=(2.6-1.4*ramp)/A.rate;
        let x,z;const live=sim.fighters.filter(f=>f.alive&&!f.falling);
        if(live.length&&sim.rng()<.58){
          const f=live[Math.floor(sim.rng()*live.length)],a=sim.rng()*TAU,j=sim.rng()*1.3;
          x=f.x+Math.cos(a)*j+f.vx*.35;z=f.z+Math.sin(a)*j+f.vz*.35;
        }else{const a=sim.rng()*TAU,r=Math.sqrt(sim.rng())*(coreR(A)-.9);x=Math.cos(a)*r;z=Math.sin(a)*r}
        const d=Math.hypot(x,z),lim=coreR(A)-.5;if(d>lim){x*=lim/d;z*=lim/d}
        A.meteors.push({id:A.seq++,x,z,r:A.mr,t0:t,hitT:t+A.lead,done:false});
        A.nextM=t+gap*(.75+.5*sim.rng());
        sim.emit('meteorWarn',{x,z,r:A.mr,t:A.lead});
      }
    }
    for(const m of A.meteors){
      if(m.done||t<m.hitT)continue;
      m.done=true;
      sim.shock(m.x,m.z,m.r,7.2,17,'meteor');
      const d=Math.hypot(m.x,m.z);let hole=false;
      if(d<coreR(A)-.4&&A.holes.length<9){A.holes.push({x:m.x,z:m.z,r:A.holeR,t});hole=true}
      sim.emit('meteorHit',{x:m.x,z:m.z,r:m.r,hole,id:m.id});
    }
    if(A.meteors.length>14&&A.meteors[0].done)A.meteors.shift();
    suddenUpdate(sim,A);
  },
  inHole(A,x,z,extra){
    for(const h of A.holes){if(Math.hypot(x-h.x,z-h.z)<h.r+extra)return h}
    return null;
  },
  supported(sim,x,z,pad){
    const A=sim.arena;if(Math.hypot(x,z)-pad>A.core*A.coreScale)return false;
    return !MAPS.mesa.inHole(A,x,z,pad*.35);
  },
  fallCause(sim,x,z,pad){return MAPS.mesa.inHole(sim.arena,x,z,pad*.35+.15)?'hole':'edge'},
  solidR(sim){return coreR(sim.arena)},
  knownR(sim){return coreR(sim.arena)},
  pushDir(sim,tx,tz){
    const A=sim.arena;let best=null,bd=3.4;
    for(const h of A.holes){const d=Math.hypot(h.x-tx,h.z-tz);if(d<bd){bd=d;best=h}}
    if(!best)return null;
    return [(best.x-tx)/bd,(best.z-tz)/bd];
  },
  aiAvoid(sim,f,ai){
    const A=sim.arena,t=sim.t,D=f.D;let gx=0,gz=0,urg=0;
    for(const m of A.meteors){
      if(m.done||t-m.t0<D.react*.9+(ai.jit-.85))continue;                // not noticed yet
      const dx=f.x-m.x,dz=f.z-m.z,d=Math.hypot(dx,dz);
      if(d<m.r+.75){
        const left=m.hitT-t,w=left<.9?1:.7;
        if(d>.05){gx+=dx/d*w;gz+=dz/d*w}else{gx+=Math.cos(f.id)*w;gz+=Math.sin(f.id)*w}
        urg=Math.max(urg,left<1.1?1:.6);
      }
    }
    for(const h of A.holes){
      const dx=f.x-h.x,dz=f.z-h.z,d=Math.hypot(dx,dz),range=h.r+f.r+.9;
      if(d<range&&d>.01){const w=1-d/range;gx+=dx/d*w*1.6;gz+=dz/d*w*1.6;urg=Math.max(urg,.5)}
    }
    if(!urg)return null;
    const d=Math.hypot(f.x,f.z);                                         // do not flee over the rim
    if(d>coreR(A)-1.4){gx-=f.x/d*.9;gz-=f.z/d*.9}
    return {gx,gz,urg};
  },
  hud(sim){
    const A=sim.arena,t=sim.t;let soon=1e9;
    for(const m of A.meteors)if(!m.done)soon=Math.min(soon,m.hitT-t);
    return soon<1e8?{tag:'INCOMING',t:Math.max(0,soon),urgent:soon<1}:null;
  }
};

for(const id of MAP_ORDER){const m=MAPS[id];m.phys=Object.assign({dragMul:1,accelMul:1,kbMul:1},m.phys||{})}
