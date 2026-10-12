/* ------------------------------------------------------------------ AI --- */
import {clamp} from './util.js';
import {DIFF, TUNE} from './tune.js';
import {polarAng} from './maps.js';
export function aiInit(f,sim){
  const name=(sim.slotDiff&&sim.slotDiff[f.id]&&DIFF[sim.slotDiff[f.id]])?sim.slotDiff[f.id]:(DIFF[sim.difficulty]?sim.difficulty:'normal');
  const D=Object.assign({},DIFF[name]),O=sim.O;
  D.aggr*=O.aiAggr;D.react*=O.aiReact;D.think*=O.aiReact;
  f.D=D;f.diffName=name;
  f.ai={think:sim.rng()*.35,mode:'engage',tgt:-1,plan:null,dodgeT:0,dx:0,dz:0,
        strafe:sim.rng()<.5?-1:1,strafeT:0,retreat:false,safeR:9,seen:-1,wantDash:false,dashDir:null,jit:.85+sim.rng()*.3,hold:0,fleeT:0,
        av:null,avT:-9,armRollT:-9,armDodge:false,stand:2.0};
}
function aiThink(sim,f){
  const ai=f.ai,D=f.D,A=sim.arena,rng=sim.rng,pers=f.personality,P=sim.P;
  const d=Math.hypot(f.x,f.z),ang=polarAng(f.x,f.z),cr=A.core*A.coreScale;
  const Rk=sim.knownRadius(D.react,ang);
  const slip=P.dragMul<.8?(1/P.dragMul-1)*.28:0;
  const margin=(pers==='cautious'?.9:(pers==='aggressive'?.4:.75))+slip;
  ai.safeR=Math.max(cr*.9,Rk-margin);
  ai.retreat=d>ai.safeR;
  ai.stand=pers==='aggressive'?1.95:(pers==='cautious'?2.2:2.1);
  ai.av=sim.map.aiAvoid?sim.map.aiAvoid(sim,f,ai):null;ai.avT=sim.t;
  // ---- target
  let best=null,bs=-1e9;
  for(const o of sim.fighters){
    if(o===f||!o.alive||o.falling)continue;
    const dist=Math.hypot(o.x-f.x,o.z-f.z),od=Math.hypot(o.x,o.z);
    const edge=clamp((od-A.R0*.55)/(A.R0*.45),0,1);
    let s=-dist*(pers==='aggressive'?.62:.45)+(100-o.stab)*.012*(pers==='opportunist'?1.6:1)+edge*(pers==='opportunist'?1.4:.6);
    if(o.id===ai.tgt)s+=.9;
    if(o.down)s-=pers==='cautious'?.8:.4;
    s-=sim.targetLoad(o.id,f.id)*.55;
    if(s>bs){bs=s;best=o}
  }
  ai.tgt=best?best.id:-1;
  const t=best;
  // ---- weak fighters back off for a moment (people do)
  if(ai.fleeT<=0&&f.stab<32&&rng()<(pers==='aggressive'?.28:.62))ai.fleeT=1.0+rng()*.8;
  const ready=f.bashCd<=.05&&f.recover<=0&&f.bashT<=0&&f.dashT<=0&&f.stagger<=0;
  // ---- react to a wind-up aimed at me: interrupt it, back off, or sidestep
  if(ai.dodgeT<=0&&!ai.plan){
    const dodgeP=D.dodge*(pers==='cautious'?1.6:pers==='aggressive'?.45:1),intP=D.punish*(pers==='cautious'?1.0:pers==='aggressive'?.5:.8);
    for(const o of sim.fighters){
      if(o===f||!o.alive||o.falling||!(o.charging&&o.charge>.22))continue;
      const dx=f.x-o.x,dz=f.z-o.z,dist=Math.hypot(dx,dz);
      if(dist>2.7||dist<.1)continue;
      if((dx*o.fx+dz*o.fz)/dist<.78)continue;
      const key=o.id*1000+o.bashSerial;
      if(ai.seen===key)continue;
      ai.seen=key;
      const r=rng();
      if(ready&&dist<2.25&&r<intP){
        ai.plan={power:TUNE.minPower,t:0,maxT:.45,relDist:9,err:(rng()-.5)*D.aim};
        ai.tgt=o.id;
      }else if(r<intP+dodgeP){
        const side=rng()<.5?-1:1,back=rng()<.5;
        ai.dodgeT=.30+rng()*.10;
        const ux=dx/dist,uz=dz/dist;
        ai.dx=back?ux:(-uz*side*.9+ux*.35);ai.dz=back?uz:(ux*side*.9+uz*.35);
        const px=f.x+ai.dx,pz=f.z+ai.dz;
        if(Math.hypot(px,pz)>d&&d>ai.safeR-.6){ai.dx=-f.x/(d||1);ai.dz=-f.z/(d||1)}
      }
      break;
    }
  }
  if(!t||ai.retreat){ai.plan=ai.retreat?null:ai.plan;ai.mode=ai.retreat?'retreat':'idle';return}
  // ---- attack / dash decisions
  const dx=t.x-f.x,dz=t.z-f.z,dist=Math.hypot(dx,dz)||1e-3;
  const ang2=(dx*f.fx+dz*f.fz)/dist;
  const aggr=(pers==='aggressive'?1.05:pers==='cautious'?1.0:.95)*D.aggr*ai.jit;
  ai.mode='engage';
  const pun=D.punish*(pers==='cautious'?1.9:pers==='opportunist'?1.0:.7);
  if(ai.fleeT>0){ai.mode='flee'}
  else if(!ai.plan&&ready&&dist<2.3&&ang2>.5&&!t.down&&t.recover>.06&&t.bashT<=0&&t.dashT<=0&&rng()<pun){
    ai.plan={power:TUNE.minPower,t:0,maxT:.45,relDist:9,err:(rng()-.5)*D.aim};      // whiff punish: instant poke
  }else if(!ai.plan&&ready&&dist<2.3&&ang2>.6&&!t.down&&rng()<.40*aggr){
    const tEdge=Math.hypot(t.x,t.z)/A.R0,low=t.stab<45;
    let p=(low||tEdge>.82)?.20+rng()*.25:.28+rng()*.62;
    if(pers==='aggressive')p=Math.min(1,p+.03);
    p=clamp(p*D.power,.14,1);
    ai.plan={power:p,t:0,maxT:1.35,relDist:1.25+p*.75,err:(rng()-.5)*2*D.aim};
    if(rng()<D.mistake){ai.plan.err*=3;ai.plan.relDist+=.9}
  }else if(!ai.plan&&P.dashOn&&f.dashCd<=0&&ready&&dist>2.5&&dist<4.4&&rng()<D.dashRate*aggr*(pers==='cautious'?2.2:pers==='opportunist'?(Math.hypot(t.x,t.z)>A.R0*.7?4:2):pers==='player'?1.6:1)){
    const ux=dx/dist,uz=dz/dist,lx=f.x+ux*3.0,lz=f.z+uz*3.0;
    if(Math.hypot(lx,lz)<A.R0*.88&&sim.supportedAt(lx,lz,.0)&&sim.supportedAt(f.x+ux*1.5,f.z+uz*1.5,.2))ai.wantDash=true;
  }
  if(!ai.plan&&ai.mode==='engage'){
    ai.strafeT-=1;
    if(ai.strafeT<=0&&dist<3.1){
      const c=pers==='cautious'?.45:(pers==='opportunist'?.28:.16);
      if(rng()<c){ai.mode='strafe';ai.strafeT=3+(rng()*3|0);ai.strafe=rng()<.5?-1:1}
    }
  }
}
function aiSteer(sim,f,dt){
  const ai=f.ai,inp=f.input,A=sim.arena,P=sim.P;
  const d=Math.hypot(f.x,f.z)||1e-3;
  const t=ai.tgt>=0?sim.fighters[ai.tgt]:null,tv=(t&&t.alive&&!t.falling)?t:null;
  let gx=0,gz=0,str=.9,bash=false;
  const av=(ai.av&&sim.t-ai.avT<.45)?ai.av:null;
  if(av&&av.urg>=1){
    gx=av.gx;gz=av.gz;str=1;ai.plan=null;
    if(av.dash&&P.dashOn){ai.wantDash=true;ai.dashDir=[av.gx,av.gz]}
  }
  else if(ai.dodgeT>0){gx=ai.dx;gz=ai.dz;str=1;ai.plan=null}
  else if(ai.fleeT>0&&!ai.retreat){
    let ex=0,ez=0,bd=1e9;
    for(const o of sim.fighters){if(o===f||!o.alive||o.falling)continue;const dd=Math.hypot(o.x-f.x,o.z-f.z);if(dd<bd){bd=dd;ex=(f.x-o.x)/(dd||1);ez=(f.z-o.z)/(dd||1)}}
    const ix=-f.x/d,iz=-f.z/d;gx=ex*.8+ix*.7;gz=ez*.8+iz*.7;str=.95;ai.plan=null;
  }
  else if(ai.retreat){
    const ix=-f.x/d,iz=-f.z/d;
    gx=ix-iz*.18*ai.strafe;gz=iz+ix*.18*ai.strafe;str=1;ai.plan=null;
  }else if(tv){
    const dx=tv.x-f.x,dz=tv.z-f.z,dist=Math.hypot(dx,dz)||1e-3,ux=dx/dist,uz=dz/dist;
    if(ai.plan){
      const p=ai.plan;p.t+=dt;
      const c=Math.cos(p.err),s=Math.sin(p.err);
      gx=ux*c-uz*s;gz=ux*s+uz*c;str=dist<1.3?.22:.5;
      const release=f.charge>=p.power&&(dist<=p.relDist||p.t>p.maxT*.8);
      if(release||p.t>p.maxT||f.stagger>0){ai.plan=null;bash=false}else bash=true;
    }else if(ai.mode==='strafe'){
      gx=-uz*ai.strafe+ux*.35;gz=ux*ai.strafe+uz*.35;str=.75;
    }else{
      const od=Math.hypot(tv.x,tv.z),pd=sim.map.pushDir?sim.map.pushDir(sim,tv.x,tv.z):null;
      let ox,oz;if(pd){ox=pd[0];oz=pd[1]}else if(od>.8){ox=tv.x/od;oz=tv.z/od}else{ox=-ux;oz=-uz}
      const st=ai.stand||1.9,px=tv.x-ox*st,pz=tv.z-oz*st,mx=px-f.x,mz=pz-f.z,mm=Math.hypot(mx,mz)||1e-3;
      if(dist<st+.5&&mm<1.0){gx=ux;gz=uz;str=dist>st?.55:.12}
      else{gx=mx/mm;gz=mz/mm;str=.95;if(P.dragMul<.8)str*=clamp(.35+mm*.5,.35,1)}      // on ice: ease off when arriving
    }
  }else{gx=-f.x;gz=-f.z;str=.45}
  // separation from other fighters
  let sx=0,sz=0;
  for(const o of sim.fighters){
    if(o===f||!o.alive||o.falling)continue;
    const ox=f.x-o.x,oz=f.z-o.z,dd=Math.hypot(ox,oz);
    if(dd>.001&&dd<1.5&&(!tv||o!==tv)){const w=1-dd/1.5;sx+=ox/dd*w;sz+=oz/dd*w}
  }
  // keep off the rim while chasing
  const R=sim.standingRadius(polarAng(f.x,f.z));
  if(!ai.retreat&&d>R-1.15){const w=clamp((d-(R-1.15))/1.15,0,1)*1.4;sx+=-f.x/d*w;sz+=-f.z/d*w}
  gx+=sx*.7;gz+=sz*.7;
  // soft hazard advice (bumpers, craters, slope)
  if(av&&av.urg<1){gx+=av.gx*av.urg;gz+=av.gz*av.urg;str=Math.max(str,Math.min(.9,Math.hypot(av.gx,av.gz)*av.urg))}
  let gm=Math.hypot(gx,gz)||1,ox=gx/gm,oz=gz/gm;
  // never walk into a hole / off the edge, and brake when the slide would carry us off
  const sp=Math.hypot(f.vx,f.vz),committed=f.bashT>0||f.dashT>0;
  if(!committed){
    const look=.55+Math.min(1.0,sp*.26);
    if(sim.supportedAt(f.x,f.z,0)&&!sim.supportedAt(f.x+ox*look,f.z+oz*look,.22)){
      let found=false;
      for(const a of [.6,-.6,1.2,-1.2,1.9,-1.9]){
        const c=Math.cos(a),s=Math.sin(a),rx=ox*c-oz*s,rz=ox*s+oz*c;
        if(sim.supportedAt(f.x+rx*look,f.z+rz*look,.22)){ox=rx;oz=rz;found=true;break}
      }
      if(!found){str=0;ai.plan=null}
    }
    if(sp>1.0){
      const stopD=sp/(TUNE.coast*P.dragMul)*.75;
      if(!sim.supportedAt(f.x+f.vx/sp*stopD,f.z+f.vz/sp*stopD,.22)){ox=-f.vx/sp;oz=-f.vz/sp;str=1;ai.plan=null}
    }
  }
  inp.mx=ox*str;inp.mz=oz*str;inp.bashDown=bash;
  if(ai.wantDash){
    if(f.dashCd<=0&&f.recover<=0&&f.stagger<=0&&f.bashT<=0){
      if(ai.dashDir){const dm=Math.hypot(ai.dashDir[0],ai.dashDir[1])||1;inp.mx=ai.dashDir[0]/dm;inp.mz=ai.dashDir[1]/dm;inp.dash=true}
      else if(tv){const dx=tv.x-f.x,dz=tv.z-f.z,dd=Math.hypot(dx,dz)||1;inp.mx=dx/dd;inp.mz=dz/dd;inp.dash=true}
    }
    ai.wantDash=false;ai.dashDir=null;
  }
}
export function aiUpdate(sim,f,dt){
  const ai=f.ai,inp=f.input,D=f.D;
  inp.dash=false;inp.bashPower=-1;
  if(sim.phase!=='fight'||f.down||f.falling||f.stagger>0){
    inp.mx=0;inp.mz=0;inp.bashDown=false;ai.plan=null;ai.wantDash=false;ai.dashDir=null;
    if(f.stagger>0)ai.think=Math.min(ai.think,.06);
    return;
  }
  ai.dodgeT=Math.max(0,ai.dodgeT-dt);ai.fleeT=Math.max(0,ai.fleeT-dt);
  ai.think-=dt;
  if(ai.think<=0){ai.think=((ai.av&&ai.av.urg>=.8)?.07:(.14+sim.rng()*.16))*D.think;aiThink(sim,f)}
  aiSteer(sim,f,dt);
}
