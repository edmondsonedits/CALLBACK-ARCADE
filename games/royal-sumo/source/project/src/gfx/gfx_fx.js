/* ============================================================================
   ROYAL SUMO - FX  (particles, decals, shadows). All billboards share R.quadMesh.
   Instance layout (FX shader): [x,y,z,size][rot,mode,sprite,stretch][r,g,b,a]
   mode 0 camera facing, 1 vertical billboard, 2 flat on the ground.
   ========================================================================== */
import {TAU} from '../core/util.js';
import {Batch} from './engine.js';
import {STYLE_RGB} from './gfx_fighter.js';
export const SPR={glow:0,star:1,ring:2,smoke:3,streak:4,burst:5,snow:6,disc:7,leaf:8,tele:9,sq:10,tri:11,blob:12};
export class FX{
  constructor(R){
    this.R=R;const gl=R.gl;
    this.alpha=new Batch(gl,R.quadMesh,3400);this.addb=new Batch(gl,R.quadMesh,3400);
    this.P=[];this.q=1;this.max=2200;this.dust=[.86,.82,.74];this.floorY=null;this.reduceFlash=false;
  }
  clear(){this.P.length=0}
  setQuality(k){this.q=k==='low'?.5:(k==='high'?1.4:1);this.max=k==='low'?900:(k==='high'?2800:2000)}
  /* generic particle */
  p(o){
    if(this.P.length>=this.max)return null;
    const s=o.s0===undefined?.3:o.s0;
    const q={x:o.x,y:o.y,z:o.z,vx:o.vx||0,vy:o.vy||0,vz:o.vz||0,t:0,life:o.life||.6,s0:s,s1:o.s1===undefined?s:o.s1,spr:o.spr||0,
      r:o.r===undefined?1:o.r,g:o.g===undefined?1:o.g,b:o.b===undefined?1:o.b,a:o.a===undefined?1:o.a,add:!!o.add,grav:o.grav||0,drag:o.drag||0,
      rot:o.rot||0,vr:o.vr||0,mode:o.mode||0,stretch:o.stretch||0,fade:o.fade===undefined?1:o.fade,face:!!o.face,floor:o.floor};
    this.P.push(q);return q;
  }
  /* ------------------------------------------------------------ update --- */
  update(dt){
    const P=this.P,R=this.R,b=R.basis||[1,0,0,0,1,0,0,0,1];
    for(let i=P.length-1;i>=0;i--){
      const q=P[i];q.t+=dt;
      if(q.t>=q.life){P[i]=P[P.length-1];P.pop();continue}
      if(q.drag){const k=Math.exp(-q.drag*dt);q.vx*=k;q.vy*=k;q.vz*=k}
      q.vy-=q.grav*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.rot+=q.vr*dt;
      if(q.floor!==undefined&&q.y<q.floor){q.y=q.floor;q.vy*=-.35;q.vx*=.7;q.vz*=.7;q.vr*=.6}
    }
    this.alpha.clear();this.addb.clear();
    for(let i=0;i<P.length;i++){
      const q=P[i],u=q.t/q.life;
      const B=q.add?this.addb:this.alpha,o=B.slot();if(o<0)continue;const d=B.data;
      let a=q.a*(q.fade===0?1:Math.pow(1-u,q.fade));if(u<.08)a*=u/.08;
      let rot=q.rot;
      if(q.face){const sx=q.vx*b[0]+q.vy*b[3]+q.vz*b[6],sy=q.vx*b[1]+q.vy*b[4]+q.vz*b[7];rot=Math.atan2(sy,sx)}
      d[o]=q.x;d[o+1]=q.y;d[o+2]=q.z;d[o+3]=q.s0+(q.s1-q.s0)*u;
      d[o+4]=rot;d[o+5]=q.mode;d[o+6]=q.spr;d[o+7]=q.stretch;
      d[o+8]=q.r;d[o+9]=q.g;d[o+10]=q.b;d[o+11]=a;
    }
  }
  /* immediate (this frame only) quad: ground decals, shadows, telegraphs */
  imm(add,x,y,z,size,rot,mode,spr,r,g,b,a,stretch){
    const B=add?this.addb:this.alpha,o=B.slot();if(o<0)return;const d=B.data;
    d[o]=x;d[o+1]=y;d[o+2]=z;d[o+3]=size;d[o+4]=rot;d[o+5]=mode;d[o+6]=spr;d[o+7]=stretch||0;d[o+8]=r;d[o+9]=g;d[o+10]=b;d[o+11]=a;
  }
  flush(){this.alpha.upload();this.addb.upload()}
  /* --------------------------------------------------------- helpers ----- */
  n(k){return Math.max(1,Math.round(k*this.q))}
  rnd(a,b){return a+Math.random()*(b-a)}
  ground(x,z,r,col,a,life,add){                         // expanding flat ring
    this.p({x,y:this.fy(x,z)+.04,z,s0:r*.35,s1:r*2.1,life:life||.5,spr:SPR.ring,mode:2,r:col[0],g:col[1],b:col[2],a:a===undefined?.5:a,add:add!==false,fade:1.4});
  }
  fy(x,z){return this.floorY?this.floorY(x,z):0}
  puff(x,y,z,n,spread,col,size){
    for(let i=0;i<this.n(n);i++){
      const a=Math.random()*TAU,s=this.rnd(.4,1)*spread;
      this.p({x:x+Math.cos(a)*.15,y,z:z+Math.sin(a)*.15,vx:Math.cos(a)*s,vy:this.rnd(.2,1.2),vz:Math.sin(a)*s,life:this.rnd(.35,.7),s0:size*.5,s1:size*(1+Math.random()),
        spr:SPR.smoke,r:col[0],g:col[1],b:col[2],a:.32,drag:3,rot:Math.random()*6,vr:this.rnd(-2,2)});
    }
  }
  sparks(x,y,z,n,speed,col,dirx,dirz,spread){
    for(let i=0;i<this.n(n);i++){
      let a=Math.random()*TAU,sp=this.rnd(.4,1)*speed;
      if(dirx!==undefined){const base=Math.atan2(dirz,dirx);a=base+(Math.random()-.5)*(spread||2.2)}
      this.p({x,y,z,vx:Math.cos(a)*sp,vy:this.rnd(.5,3.2),vz:Math.sin(a)*sp,life:this.rnd(.22,.45),s0:.55,s1:.12,spr:SPR.streak,face:true,
        r:col[0],g:col[1],b:col[2],a:1,add:true,grav:9,drag:1.2});
    }
  }
  confetti(x,y,z,n,spread){
    const cols=[[1,.3,.4],[1,.8,.2],[.3,.85,1],[.5,1,.5],[.85,.45,1],[1,1,1]];
    for(let i=0;i<this.n(n);i++){
      const c=cols[i%cols.length],a=Math.random()*TAU,s=Math.random()*spread;
      this.p({x,y,z,vx:Math.cos(a)*s,vy:this.rnd(3,9),vz:Math.sin(a)*s,life:this.rnd(1.4,2.4),s0:this.rnd(.12,.2),spr:i%3?SPR.sq:SPR.tri,r:c[0],g:c[1],b:c[2],a:1,grav:9,drag:.9,rot:Math.random()*6,vr:this.rnd(-9,9),fade:.3});
    }
  }
  /* ---------------------------------------------------- rig callbacks ---- */
  step(x,z,f,sim){
    const c=this.dust;
    this.p({x,y:this.fy(x,z)+.08,z,vx:this.rnd(-.3,.3),vy:.5,vz:this.rnd(-.3,.3),life:.4,s0:.18,s1:.45,spr:SPR.smoke,r:c[0],g:c[1],b:c[2],a:.22,drag:2});
  }
  charge(x,z,f,c,dt){
    const col=STYLE_RGB[f.id%STYLE_RGB.length].belt;
    let k=dt*(22+34*c)*this.q;this._cacc=(this._cacc||0)+k;
    while(this._cacc>=1){
      this._cacc-=1;const a=Math.random()*TAU,r=this.rnd(1.1,1.7);
      this.p({x:x+Math.cos(a)*r,y:this.fy(x,z)+this.rnd(.2,1.5),z:z+Math.sin(a)*r,vx:-Math.cos(a)*r*3.3,vy:this.rnd(-.2,.8),vz:-Math.sin(a)*r*3.3,life:.3,s0:.22,s1:.04,spr:SPR.glow,r:col[0]*.6+.4,g:col[1]*.6+.4,b:col[2]*.6+.4,a:.55,add:true});
    }
  }
  dashTrail(x,y,z,f,dt){
    const col=STYLE_RGB[f.id%STYLE_RGB.length].belt;
    this._dacc=(this._dacc||0)+dt*38*this.q;
    while(this._dacc>=1){
      this._dacc-=1;
      this.p({x:x-f.fx*this.rnd(.2,.7)+this.rnd(-.3,.3),y:y+this.rnd(.3,1.2),z:z-f.fz*this.rnd(.2,.7)+this.rnd(-.3,.3),life:.3,s0:.4,s1:.08,spr:SPR.glow,r:col[0],g:col[1],b:col[2],a:.45,add:true});
    }
    if(Math.random()<dt*22)this.puff(x,y+.1,z,1,.8,this.dust,.7);
  }
  thud(x,z){this.puff(x,.1,z,6,2.2,this.dust,.9);this.ground(x,z,1.2,[1,1,1],.5,.4)}
  win(x,z,f){this.confetti(x,1.8,z,60,4);this.stars(x,1.8,z,10,3.5,[1,.9,.3])}
  dizzy(x,y,z,t){
    const a=t*7;
    this.p({x:x+Math.cos(a)*.5,y:y+Math.sin(a*2)*.05,z:z+Math.sin(a)*.5,life:.3,s0:.28,s1:.1,spr:SPR.star,r:1,g:.9,b:.3,a:1,add:true,rot:a});
  }
  stars(x,y,z,n,speed,col){
    for(let i=0;i<this.n(n);i++){
      const a=Math.random()*TAU,s=this.rnd(.4,1)*speed;
      this.p({x,y,z,vx:Math.cos(a)*s,vy:this.rnd(1,4.2),vz:Math.sin(a)*s,life:this.rnd(.4,.8),s0:this.rnd(.28,.5),s1:.05,spr:SPR.star,r:col[0],g:col[1],b:col[2],a:1,add:true,grav:7,drag:1,rot:Math.random()*6,vr:this.rnd(-8,8)});
    }
  }
  chips(x,y,z,n,col,speed){
    for(let i=0;i<this.n(n);i++){
      const a=Math.random()*TAU,s=this.rnd(.3,1)*speed,k=this.rnd(.7,1.15);
      this.p({x,y,z,vx:Math.cos(a)*s,vy:this.rnd(2,6),vz:Math.sin(a)*s,life:this.rnd(.6,1.1),s0:this.rnd(.1,.22),spr:SPR.sq,r:col[0]*k,g:col[1]*k,b:col[2]*k,a:1,grav:14,drag:.5,rot:Math.random()*6,vr:this.rnd(-12,12),fade:.4});
    }
  }
  /* liquid splash at the surface. mode follows the theme liquid mode */
  splash(x,y,z,mode){
    const m=mode|0;
    if(m===0){                                   // lava
      this.p({x,y:y+.05,z,s0:.8,s1:3.6,life:.6,spr:SPR.ring,mode:2,r:1,g:.55,b:.1,a:.9,add:true,fade:1.3});
      for(let i=0;i<this.n(16);i++){const a=Math.random()*TAU,s=this.rnd(1,4);this.p({x,y,z,vx:Math.cos(a)*s,vy:this.rnd(5,10),vz:Math.sin(a)*s,life:this.rnd(.7,1.3),s0:this.rnd(.2,.4),s1:.05,spr:SPR.leaf,r:1,g:.5+Math.random()*.4,b:.1,a:1,add:true,grav:12,rot:Math.random()*6,vr:this.rnd(-6,6)})}
      this.puff(x,y+.2,z,5,1.4,[.25,.2,.2],1.4);
    }else if(m===2){                              // neon void
      this.p({x,y:y+.05,z,s0:.8,s1:3.4,life:.7,spr:SPR.ring,mode:2,r:.9,g:.4,b:1,a:.9,add:true,fade:1.3});
      this.sparks(x,y,z,14,5,[.9,.5,1]);
    }else{                                        // water-like
      const c=m===4?[.55,.9,.5]:(m===5?[1,.6,.3]:[.85,.95,1]);
      this.p({x,y:y+.05,z,s0:.8,s1:3.4,life:.7,spr:SPR.ring,mode:2,r:c[0],g:c[1],b:c[2],a:.85,add:false,fade:1.2});
      for(let i=0;i<this.n(14);i++){const a=Math.random()*TAU,s=this.rnd(.8,3);this.p({x,y,z,vx:Math.cos(a)*s,vy:this.rnd(4,8),vz:Math.sin(a)*s,life:this.rnd(.6,1),s0:this.rnd(.18,.34),s1:.08,spr:SPR.leaf,r:c[0],g:c[1],b:c[2],a:.95,grav:13,rot:Math.random()*6,vr:this.rnd(-5,5)})}
      this.puff(x,y+.2,z,4,1.2,c,1.2);
    }
  }
  /* --------------------------------------------------------- sim events -- */
  onEvent(e,sim,scene){
    const q=this.q;
    switch(e.type){
      case 'hit':{
        const tier=e.tier,k=tier==='light'?0:(tier==='medium'?1:(tier==='heavy'?2:3));
        const y=.95,x=e.x,z=e.z,nx=e.nx,nz=e.nz;
        let col=[1,.95,.6];
        if(e.kind==='sweeper'){this.chips(x,y,z,10,[.7,.45,.22],4);col=[1,.85,.5]}
        else if(e.kind==='meteor'){col=[1,.6,.25]}
        else if(e.kind==='dash'){col=[.7,.95,1]}
        this.stars(x,y,z,3+k*3,2.5+k*1.2,col);
        this.sparks(x,y,z,4+k*4,6+k*2.5,col,nx,nz,2.6);
        this.p({x,y,z,s0:.3+k*.2,s1:.7+k*.45,life:.18,spr:SPR.glow,r:1,g:.95,b:.8,a:.7,add:true});
        this.p({x,y,z,s0:.3,s1:1.2+k*.6,life:.26+k*.04,spr:SPR.ring,r:1,g:1,b:.9,a:.6,add:true,fade:1.5});
        if(k>=1)this.p({x,y,z,s0:.45+k*.25,s1:1.0+k*.45,life:.18+k*.03,spr:SPR.burst,rot:Math.random()*6,r:1,g:.85,b:.3,a:.8,add:true,fade:1.4});
        this.puff(x,.15,z,1+k,1.4+k*.4,this.dust,.55);
        if(k>=2)this.ground(x,z,1.1+k*.4,[1,.95,.8],.45,.4);
        break}
      case 'land':if(e.speed>3){this.puff(e.x,.12,e.z,5,2.4,this.dust,.8);this.ground(e.x,e.z,.9,[1,1,1],.35,.35)}break;
      case 'bump':this.puff(e.x,.7,e.z,2,1,[1,1,1],.5);this.sparks(e.x,.8,e.z,3,3,[1,.95,.7]);break;
      case 'knockdown':this.puff(e.x,.15,e.z,6,2.4,this.dust,.9);this.stars(e.x,1.3,e.z,6,2.2,[1,.9,.4]);break;
      case 'chargeFull':{const f=sim.fighters[e.id];if(f){const c=STYLE_RGB[e.id%STYLE_RGB.length].belt;this.p({x:f.x,y:.9,z:f.z,s0:.6,s1:2.6,life:.35,spr:SPR.ring,r:c[0]*.5+.5,g:c[1]*.5+.5,b:c[2]*.5+.5,a:1,add:true,fade:1.4});this.stars(f.x,1.4,f.z,6,2.4,[1,.95,.5])}break}
      case 'dash':{const c=STYLE_RGB[e.id%STYLE_RGB.length].belt;this.puff(e.x,.2,e.z,5,2.2,this.dust,.8);this.ground(e.x,e.z,1.2,c,.7,.4)}break;
      case 'bash':if(e.power>.5){this.p({x:e.x+e.fx*.8,y:.95,z:e.z+e.fz*.8,s0:.8,s1:1.7,life:.18,spr:SPR.streak,face:false,rot:0,r:1,g:1,b:1,a:.35+e.power*.3,add:true,mode:0})}break;
      case 'bumper':this.sparks(e.x,.8,e.z,16,7,[1,.6,1],e.nx,e.nz,3);this.p({x:e.x,y:.8,z:e.z,s0:.6,s1:2.2,life:.3,spr:SPR.ring,r:1,g:.7,b:1,a:1,add:true,fade:1.4});break;
      case 'rail':this.sparks(e.x,.7,e.z,8,5,[.5,.95,1],-e.nx,-e.nz,2.4);break;
      case 'sweep':this.chips(e.x,.9,e.z,12,[.72,.5,.3],5);this.puff(e.x,.5,e.z,3,1.5,this.dust,.7);break;
      case 'duck':for(let i=0;i<this.n(8);i++)this.p({x:e.x+this.rnd(-.4,.4),y:this.rnd(.4,1.2),z:e.z+this.rnd(-.4,.4),life:.3,s0:.4,s1:.1,spr:SPR.streak,face:false,rot:this.rnd(0,3),r:1,g:1,b:1,a:.6,add:true});break;
      case 'shock':this.ground(e.x,e.z,e.r*1.1,[1,.6,.2],.9,.55);this.p({x:e.x,y:this.fy(e.x,e.z)+.05,z:e.z,s0:e.r*.5,s1:e.r*3.0,life:.5,spr:SPR.ring,mode:2,r:1,g:.9,b:.7,a:.7,add:true,fade:1.4});this.puff(e.x,.2,e.z,10,e.r*1.7,this.dust,1.3);break;
      case 'meteorHit':{
        for(let i=0;i<this.n(10);i++){const a=Math.random()*TAU,s=this.rnd(1,5);this.p({x:e.x,y:.4,z:e.z,vx:Math.cos(a)*s,vy:this.rnd(4,11),vz:Math.sin(a)*s,life:this.rnd(.7,1.3),s0:this.rnd(.2,.5),s1:.1,spr:SPR.glow,r:1,g:.6,b:.2,a:1,add:true,grav:11})}
        this.p({x:e.x,y:.8,z:e.z,s0:1.4,s1:4.6,life:.35,spr:SPR.glow,r:1,g:.8,b:.4,a:1,add:true,fade:1.2});
        this.p({x:e.x,y:.9,z:e.z,s0:1.8,s1:3.8,life:.28,spr:SPR.burst,rot:Math.random()*6,r:1,g:.85,b:.35,a:1,add:true});
        this.chips(e.x,.5,e.z,14,[.62,.45,.3],5);this.puff(e.x,.3,e.z,10,2.6,[.45,.38,.32],1.8);break}
      case 'roundEnd':{if(e.winner>=0){const f=sim.fighters[e.winner];if(f)this.confetti(f.x,2.2,f.z,36,3.2)}break}
      case 'matchEnd':{if(e.winner>=0){const f=sim.fighters[e.winner];if(f){this.confetti(f.x,2.4,f.z,90,5);this.stars(f.x,2.4,f.z,14,4,[1,.9,.3])}}break}
      case 'sudden':break;
    }
  }
  /* shadows for fighters (blob under feet) */
  shadows(sim,alpha,rig){
    for(const f of sim.fighters){
      if(!f.alive&&!f.falling)continue;
      const x=f.px+(f.x-f.px)*alpha,z=f.pz+(f.z-f.pz)*alpha,y=f.py+(f.y-f.py)*alpha;
      if(y<-.6)continue;
      const fy=this.fy(x,z),h=Math.max(0,y-fy);
      const s=1.9*(1/(1+h*.55));
      this.imm(false,x,fy+.03,z,s,0,2,SPR.blob,0,0,0,.5/(1+h*.5));
    }
  }
}
