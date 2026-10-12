/* ------------------------------------------------------------------ Sim -- */
import {TAU, clamp, has, mulberry32, sat} from './util.js';
import {DASH_CD, DIFF, FIXED_DT, HAZARD_LEVELS, LAVA_Y, MAX_PLAYERS, MIXED_LADDER, NAMES, NULL_INPUT, OWNERS, PERSONALITIES, TUNE} from './tune.js';
import {normalizeOpts} from './options.js';
import {VERSIONS} from './versions.js';
import {MAPS} from './maps.js';
import {aiInit, aiUpdate} from './ai.js';
export class Sim{
  constructor(o={}){
    this.seed=(o.seed!=null?o.seed:(Math.random()*4294967296))>>>0;
    this.rng=mulberry32(this.seed);
    this.demo=!!o.demo;
    this.inputs=[];
    for(let i=0;i<MAX_PLAYERS;i++)this.inputs.push({mx:0,mz:0,bashDown:false,bashPower:-1,dash:false});
    this.events=[];this.crowns=new Array(MAX_PLAYERS).fill(0);
    this.round=0;this.phase='idle';this.phaseT=0;this.t=0;this.acc=0;this.count=0;this.gx=0;this.gz=0;
    this.fighters=[];this.arena=null;this.winner=-2;this.matchWinner=-1;this.stats=null;
    this.slotDiffUser=o.slotDiff||null;
    this.setOptions(o);
    this.seats=this.makeSeats(o);
    this.humanSlots=new Set();for(let i=0;i<this.n;i++)if(this.seats[i].owner!=='bot')this.humanSlots.add(i);
    this.setDifficulty(this.O.difficulty);
    this.resetStats();
  }
  /* Seats: who drives each fighter, what it is called and how it looks. They live on the Sim (not on the fighter
     objects, which are rebuilt every round) so names and ownership survive from round to round.
     o.slots = [{owner,name,style,skill}]  is the full description (see core/slots.js).
     o.humans = [ids]  is the older shorthand: seat 0 is the local player, the rest are remote humans.
     Demos are always bots only. */
  makeSeats(o){
    const seats=[];
    const given=Array.isArray(o.slots)?o.slots:null;
    let legacy=null;
    if(!given)legacy=new Set(this.demo?[]:((Array.isArray(o.humans)&&o.humans.length)?o.humans.filter(i=>i>=0&&i<this.n):[0]));
    for(let i=0;i<MAX_PLAYERS;i++){
      const g=given&&given[i]&&typeof given[i]==='object'?given[i]:null;
      let owner='bot';
      if(!this.demo){
        if(g)owner=OWNERS.indexOf(g.owner)>=0?g.owner:'bot';
        else if(legacy&&legacy.has(i))owner=i===0?'local':'remote';
      }
      seats.push({owner,
        name:g&&typeof g.name==='string'&&g.name&&!this.demo?g.name:(NAMES[i]||('P'+(i+1))),
        style:g&&Number.isInteger(g.style)&&g.style>=0?g.style:i,
        skill:g&&typeof g.skill==='string'&&has(DIFF,g.skill)?g.skill:''});
    }
    return seats;
  }
  /* (re)apply match rules; takes effect from the next round that starts */
  setOptions(o){
    const O=this.O=normalizeOpts(Object.assign({},this.O||{},o));
    this.n=O.fighters;this.map=MAPS[O.map];this.H=HAZARD_LEVELS[O.hazard];
    this.winTarget=O.winTarget?O.winTarget:(this.n>5?2:3);
    this.setDifficulty(O.difficulty);
    const m=this.map.phys;
    this.P={kb:O.knockback*m.kbMul,kbBumper:O.knockback,dmg:O.damage,spd:O.speed,dragMul:m.dragMul,accelMul:m.accelMul,
            dashCd:DASH_CD[O.dash],dashOn:O.dash!=='off'};
  }
  setDifficulty(name){
    this.difficulty=(has(DIFF,name)||name==='mixed')?name:'normal';
    this.O.difficulty=this.difficulty;
    this.D=DIFF[this.difficulty]||DIFF.normal;
    const ladder=this.difficulty==='mixed'?MIXED_LADDER:null;
    let over=false;if(this.seats)for(let i=0;i<MAX_PLAYERS;i++)if(this.seats[i].skill)over=true;
    if(this.slotDiffUser)this.slotDiff=this.slotDiffUser;
    else if(over){this.slotDiff=[];for(let i=0;i<MAX_PLAYERS;i++)this.slotDiff.push(this.seats[i].skill||(ladder?ladder[i]:undefined))}
    else this.slotDiff=ladder?ladder.slice():null;
  }
  isHuman(id){return this.humanSlots.has(id)}
  ownerOf(id){return id>=0&&id<MAX_PLAYERS?this.seats[id].owner:'bot'}
  /** Change who drives a seat, now or between rounds. Bots take over with a fresh AI state; a person takes over with
   *  a clean input (no stuck stick or half-pressed BASH). Returns true if it changed. */
  setOwner(id,owner){
    if(!Number.isInteger(id)||id<0||id>=this.n||OWNERS.indexOf(owner)<0||this.demo)return false;
    const seat=this.seats[id];if(seat.owner===owner)return false;
    const was=seat.owner;seat.owner=owner;
    if(owner==='bot')this.humanSlots.delete(id);else this.humanSlots.add(id);
    const inp=this.inputs[id];inp.mx=0;inp.mz=0;inp.bashDown=false;inp.bashPower=-1;inp.dash=false;
    const f=this.fighters[id];
    if(f){
      f.kind=owner;
      if(owner==='bot'&&this.arena){aiInit(f,this);f.charging=false;f.charge=0;f.chargeFull=false}
    }
    this.emit('owner',{id,owner,was});
    return true;
  }
  /** Rename a seat for the rest of the match (and the fighter currently on the field). */
  setSeatName(id,name){
    if(!Number.isInteger(id)||id<0||id>=MAX_PLAYERS||typeof name!=='string'||!name)return false;
    this.seats[id].name=name;if(this.fighters[id])this.fighters[id].name=name;return true;
  }
  resetStats(){this.stats=[];for(let i=0;i<MAX_PLAYERS;i++)this.stats.push({kos:0,falls:0,hits:0,taken:0,dmg:0,best:0,rounds:0})}
  emit(type,d){const e=d||{};e.type=type;e.t=this.t;this.events.push(e);return e}
  drain(){const e=this.events;this.events=[];return e}

  /* ---- lifecycle */
  startMatch(){this.crowns.fill(0);this.round=0;this.matchWinner=-1;this.resetStats();this.startRound()}
  startRound(){
    this.round++;this.t=0;this.winner=-2;this.gx=0;this.gz=0;this.arena=this.map.build(this,this.rng);
    this.fighters=[];
    const R=this.arena.spawnR;
    for(let i=0;i<this.n;i++){
      const a=Math.PI/2+i*TAU/this.n,f=this.makeFighter(i,Math.cos(a)*R,Math.sin(a)*R);
      f.fx=-Math.cos(a);f.fz=-Math.sin(a);f.y=6+i*.06;f.px=f.x;f.pz=f.z;f.py=f.y;
      this.fighters.push(f);
      if(f.kind==='bot')aiInit(f,this);
    }
    for(const k of this.inputs){k.mx=0;k.mz=0;k.bashDown=false;k.bashPower=-1;k.dash=false}
    this.phase='intro';this.phaseT=0;this.count=4;
    this.emit('roundStart',{round:this.round,n:this.n,map:this.map.id});
  }
  makeFighter(id,x,z){
    const seat=this.seats[id];
    return {
      id,name:seat.name,style:seat.style,personality:PERSONALITIES[id]||'aggressive',
      kind:seat.owner,
      x,z,vx:0,vz:0,y:0,vy:0,fx:0,fz:1,r:TUNE.radius,mass:1,px:x,pz:z,py:0,
      stab:100,noRegen:0,protect:0,
      alive:true,falling:false,fallT:0,fallStart:-1,fallBy:-1,fallCause:'',spin:0,spinV:0,
      stagger:0,recover:0,bashCd:0,dashCd:0,
      charging:false,charge:0,chargeFull:false,prevBash:false,bashBuf:0,tapQueued:false,
      bashT:0,bashDur:0,bashPower:0,bashHit:0,bashConn:false,bashSerial:0,
      dashT:0,dashSerial:0,dashHit:0,dashBuf:0,dashConn:false,
      down:false,downT:0,downStage:'none',downSide:1,
      unsup:0,teeter:0,landed:false,armImm:[0,0,0,0],
      lastHitBy:-1,lastHitT:-99,lastHitKind:'',lastImpact:0,
      input:this.inputs[id],state:'idle',winner:false,ai:null
    };
  }

  /* ---- fixed-step driver */
  advance(dt){
    this.acc=Math.min(this.acc+dt,.1);
    let n=0;
    while(this.acc>=FIXED_DT&&n<12){this.step(FIXED_DT);this.acc-=FIXED_DT;n++}
  }
  step(dt){
    for(const f of this.fighters){f.px=f.x;f.pz=f.z;f.py=f.y}        // previous state for render interpolation
    switch(this.phase){
      case 'intro':{
        this.phaseT+=dt;
        for(const f of this.fighters){
          if(f.y>0||f.vy>0){
            f.vy-=TUNE.fall.g*dt;f.y+=f.vy*dt;
            if(f.y<=0){f.y=0;if(!f.landed){f.landed=true;this.emit('land',{id:f.id,x:f.x,z:f.z,speed:-f.vy})}f.vy=0}
          }
        }
        if(this.phaseT>=TUNE.round.intro){this.phase='countdown';this.phaseT=0;this.count=4}
        break}
      case 'countdown':{
        this.phaseT+=dt;
        const c=this.phaseT<.7?3:(this.phaseT<1.4?2:1);
        if(c!==this.count){this.count=c;this.emit('count',{n:c})}
        if(this.phaseT>=TUNE.round.count){this.phase='fight';this.phaseT=0;this.emit('go',{})}
        break}
      case 'fight':this.fightStep(dt,true);break;
      case 'roundend':
        this.phaseT+=dt;this.fightStep(dt,false);
        if(this.phaseT>=TUNE.round.end){
          if(this.matchWinner>=0){
            if(this.demo)this.startMatch();
            else{this.phase='matchend';this.phaseT=0;this.emit('matchEnd',{winner:this.matchWinner})}
          }else this.startRound();
        }
        break;
      case 'matchend':this.phaseT+=dt;this.fightStep(dt,false);break;
      default:break;
    }
  }

  /* ---- arena helpers (all delegate to the map) */
  standingRadius(ang){return this.map.solidR(this,ang===undefined?0:ang)}
  knownRadius(react,ang){return this.map.knownR(this,ang===undefined?0:ang,react)}
  supportedAt(x,z,pad){return this.map.supported(this,x,z,pad)}
  targetLoad(id,except){let n=0;for(const o of this.fighters)if(o.id!==except&&o.kind==='bot'&&o.alive&&!o.falling&&o.ai&&o.ai.tgt===id)n++;return n}
  hudInfo(){
    const A=this.arena;if(!A)return null;
    if(A.sudden)return {tag:'SUDDEN DEATH',t:0,urgent:true,noTime:true};
    const h=this.map.hud?this.map.hud(this):null;
    const toSudden=A.suddenT-this.t;
    if((!h||!h.urgent)&&toSudden<6&&this.phase==='fight')return {tag:'SUDDEN DEATH IN',t:Math.max(0,toSudden),urgent:true};
    return h;
  }

  /* ---- fight tick */
  fightStep(dt,live){
    if(live){this.t+=dt;this.gx=0;this.gz=0;this.map.update(this,dt)}
    else{this.gx=0;this.gz=0}
    const fs=this.fighters;
    for(let i=0;i<fs.length;i++)this.updateFighter(fs[i],dt,live);
    for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++)this.collide(fs[i],fs[j],dt);
    if(live&&this.map.interact)for(let i=0;i<fs.length;i++)this.map.interact(this,fs[i],dt);
    for(let i=0;i<fs.length;i++)this.supportCheck(fs[i],dt);
    if(live)this.checkRoundEnd();
  }
  updateFighter(f,dt,live){
    if(!f.alive)return;
    const T=TUNE,P=this.P;
    f.stagger=Math.max(0,f.stagger-dt);f.recover=Math.max(0,f.recover-dt);
    f.bashCd=Math.max(0,f.bashCd-dt);f.dashCd=Math.max(0,f.dashCd-dt);
    f.noRegen=Math.max(0,f.noRegen-dt);f.protect=Math.max(0,f.protect-dt);
    f.dashBuf=Math.max(0,f.dashBuf-dt);f.bashBuf=Math.max(0,f.bashBuf-dt);
    if(f.falling){this.fallStep(f,dt);return}
    if(f.kind==='bot'&&live)aiUpdate(this,f,dt);
    const ctl=live?f.input:NULL_INPUT;
    if(f.down){this.downStep(f,dt);this.deriveState(f);return}
    if(f.winner){this.coast(f,dt,T.coast);this.integrate(f,dt);this.deriveState(f);return}

    // ---- buffered presses
    if(ctl.dash){if(live)ctl.dash=false;if(P.dashOn)f.dashBuf=.16}
    const down=!!ctl.bashDown;
    if(down&&!f.prevBash)f.bashBuf=.14;
    if(!down&&f.prevBash&&!f.charging&&f.bashBuf>0)f.tapQueued=true;
    f.prevBash=down;
    if(f.bashBuf<=0)f.tapQueued=false;
    if(f.stagger>0&&f.charging){f.charging=false;f.charge=0;f.chargeFull=false}
    const act=f.stagger<=0&&f.recover<=0&&f.bashT<=0&&f.dashT<=0;

    if(act&&f.dashBuf>0&&f.dashCd<=0&&P.dashOn)this.startDash(f,ctl);
    const act2=f.stagger<=0&&f.recover<=0&&f.bashT<=0&&f.dashT<=0;
    if(ctl.bashPower>=0){
      if(act2&&f.bashCd<=.1)this.startBash(f,ctl.bashPower);
      if(live)ctl.bashPower=-1;
    }
    if(act2&&f.bashCd<=.0001&&!f.charging){
      if(down&&f.bashBuf>0){f.charging=true;f.charge=T.minPower;f.chargeFull=false;f.bashBuf=0;this.emit('chargeStart',{id:f.id})}
      else if(f.tapQueued&&f.bashBuf>0){this.startBash(f,T.minPower);f.tapQueued=false;f.bashBuf=0}
    }
    if(f.charging){
      if(down){
        f.charge=Math.min(1,f.charge+dt/T.chargeTime);
        if(f.charge>=1&&!f.chargeFull){f.chargeFull=true;this.emit('chargeFull',{id:f.id})}
      }else{
        const p=f.charge;f.charging=false;f.charge=0;f.chargeFull=false;
        if(act2)this.startBash(f,p);
      }
    }

    // ---- movement (bash / dash are committed: no steering while they run)
    let mx=ctl.mx,mz=ctl.mz,mag=Math.hypot(mx,mz);
    if(mag>1){mx/=mag;mz/=mag;mag=1}
    let ms=f.stagger>0?0:(f.recover>0?.30:1);
    if(f.charging)ms*=T.chargeMove;
    const committed=f.bashT>0||f.dashT>0;
    if(!committed&&mag>T.deadzone&&ms>0){
      const n=clamp((mag-T.deadzone)/(1-T.deadzone),0,1),stren=T.floor+(1-T.floor)*Math.pow(n,T.expo);
      const dx=mx/mag,dz=mz/mag,sp=T.maxSpeed*P.spd*stren*ms*(.82+.18*f.stab/100);
      let ax=dx*sp-f.vx,az=dz*sp-f.vz;const am=Math.hypot(ax,az),maxA=T.accel*P.accelMul*dt*(ms>.5?1:.5);
      if(am>maxA){ax*=maxA/am;az*=maxA/am}
      f.vx+=ax;f.vz+=az;
      const k=1-Math.exp(-T.turn*dt);f.fx+=(dx-f.fx)*k;f.fz+=(dz-f.fz)*k;
      const fm=Math.hypot(f.fx,f.fz)||1;f.fx/=fm;f.fz/=fm;
    }else{
      this.coast(f,dt,f.stagger>0?T.stagDrag:(f.dashT>0?0:(f.bashT>0?.95:T.coast)));
    }
    if(f.dashT>0){const k=Math.exp(-T.dash.drag*P.dragMul*dt);f.vx*=k;f.vz*=k}
    this.integrate(f,dt);
    if(f.bashT>0)this.bashStep(f,dt);
    if(f.dashT>0)this.dashStep(f,dt);
    // stability regen
    if(f.noRegen<=0&&f.stab<100)f.stab=Math.min(100,f.stab+T.stab.regen*dt);
    this.deriveState(f);
  }
  coast(f,dt,drag){const k=Math.exp(-drag*this.P.dragMul*dt);f.vx*=k;f.vz*=k}
  integrate(f,dt){
    if(this.gx||this.gz){f.vx+=this.gx*dt;f.vz+=this.gz*dt}
    f.x+=f.vx*dt;f.z+=f.vz*dt;
    f.vy-=TUNE.fall.g*.38*dt;f.y+=f.vy*dt;
    if(f.y<0){f.y=0;if(f.vy<0)f.vy=0}
    f.spinV*=Math.exp(-4*dt);f.spin+=f.spinV*dt;
  }
  deriveState(f){
    f.state=!f.alive?'out':f.falling?'fall':f.down?('down:'+f.downStage):f.winner?'win':
      f.bashT>0?'bash':f.dashT>0?'dash':f.stagger>0?'stagger':f.charging?'charge':f.teeter>.5?'teeter':
      (Math.hypot(f.vx,f.vz)>.4?'run':'idle');
  }

  /* ---- actions */
  assistAim(f,power){                       // humans get a gentle auto-turn toward a rival in front of them
    const A=this.O.assist;if(A<=0)return;
    const maxAng=A*.95,range=1.5+power*.9+.9;let best=null,bs=1e9;
    for(const o of this.fighters){
      if(o===f||!o.alive||o.falling)continue;
      const dx=o.x-f.x,dz=o.z-f.z,d=Math.hypot(dx,dz);
      if(d>range||d<.01)continue;
      const cross=f.fx*dz-f.fz*dx,dot=f.fx*dx+f.fz*dz,ang=Math.abs(Math.atan2(cross,dot));
      if(ang>maxAng)continue;
      const s=ang+d*.12+(o.down?.5:0);
      if(s<bs){bs=s;best=[dx/d,dz/d]}
    }
    if(best){f.fx=best[0];f.fz=best[1]}
  }
  startBash(f,power){
    const B=TUNE.bash;power=clamp(power,TUNE.minPower,1);
    if(f.kind!=='bot')this.assistAim(f,power);
    f.bashT=1e-5;f.bashDur=B.dur+B.durP*power;f.bashPower=power;f.bashHit=0;f.bashConn=false;f.bashSerial++;
    const l=B.lunge+B.lungeP*power;f.vx+=f.fx*l;f.vz+=f.fz*l;
    this.stats[f.id].bashes=(this.stats[f.id].bashes||0)+1;
    this.emit('bash',{id:f.id,power,x:f.x,z:f.z,fx:f.fx,fz:f.fz});
  }
  bashStep(f,dt){
    const B=TUNE.bash;f.bashT+=dt;
    if(f.bashT>=B.hitStart&&f.bashT<=B.hitEnd){
      const reach=B.reach+B.reachP*f.bashPower;
      for(const o of this.fighters){
        if(o===f||!o.alive||o.falling||(f.bashHit&(1<<o.id)))continue;
        const dx=o.x-f.x,dz=o.z-f.z,d=Math.hypot(dx,dz)||1e-3;
        if(d>reach+o.r)continue;
        const nx=dx/d,nz=dz/d;
        if(nx*f.fx+nz*f.fz<B.arcDot&&d>(o.r+f.r)*.92)continue;
        f.bashHit|=(1<<o.id);f.bashConn=true;
        const closing=Math.max(0,(f.vx-o.vx)*nx+(f.vz-o.vz)*nz);
        this.hit(o,f,nx,nz,B.force+B.forceP*f.bashPower+Math.min(1.5,closing*.25),B.dmg+B.dmgP*f.bashPower,f.bashPower>.75?'mega':'bash',f.bashPower);
        f.vx*=B.brake;f.vz*=B.brake;
      }
    }
    if(f.bashT>=f.bashDur){
      f.bashT=0;
      f.recover=Math.max(f.recover,f.bashConn?B.hitRec:B.whiff+B.whiffP*f.bashPower);
      f.bashCd=B.cd+B.cdP*f.bashPower;
      this.emit('bashEnd',{id:f.id,hit:f.bashConn});
    }
  }
  startDash(f,ctl){
    const D=TUNE.dash;let dx=f.fx,dz=f.fz;const m=Math.hypot(ctl.mx,ctl.mz);
    if(m>.2){dx=ctl.mx/m;dz=ctl.mz/m}
    f.fx=dx;f.fz=dz;f.vx=dx*D.speed;f.vz=dz*D.speed;
    f.dashT=D.dur;f.dashSerial++;f.dashHit=0;f.dashConn=false;f.dashCd=D.cd*this.P.dashCd;f.dashBuf=0;
    f.charging=false;f.charge=0;f.chargeFull=false;
    this.stats[f.id].dashes=(this.stats[f.id].dashes||0)+1;
    this.emit('dash',{id:f.id,x:f.x,z:f.z,fx:dx,fz:dz});
  }
  dashStep(f,dt){
    const D=TUNE.dash;f.dashT-=dt;
    for(const o of this.fighters){
      if(o===f||!o.alive||o.falling||(f.dashHit&(1<<o.id)))continue;
      const dx=o.x-f.x,dz=o.z-f.z,d=Math.hypot(dx,dz)||1e-3;
      if(d>f.r+o.r+D.reach)continue;
      const nx=dx/d,nz=dz/d;
      if(nx*f.fx+nz*f.fz<.1)continue;
      f.dashHit|=(1<<o.id);f.dashConn=true;
      this.hit(o,f,nx,nz,D.force,D.dmg,'dash',1);
      f.vx*=-D.recoil*.5;f.vz*=-D.recoil*.5;f.dashT=0;f.recover=Math.max(f.recover,D.rec);this.emit('dashEnd',{id:f.id,hit:true});
      return;
    }
    if(f.dashT<=0){f.dashT=0;if(!f.dashConn)f.recover=Math.max(f.recover,D.whiff);this.emit('dashEnd',{id:f.id,hit:f.dashConn})}
  }

  /* ---- damage (src may be null: environment hits keep the previous KO credit) */
  hit(o,src,nx,nz,force,dmg,kind,power){
    if(!o.alive||o.falling)return false;
    const S=TUNE.stab,vuln=S.vulnMin+(1-o.stab/100)*S.vulnRange;
    let f2=force*this.P.kb,d2=dmg*this.P.dmg;
    if(o.down){f2*=.65;d2=0}
    if(o.protect>0)d2*=S.protectScale;
    const imp=f2*vuln/o.mass;
    o.vx+=nx*imp;o.vz+=nz*imp;o.vy=Math.max(o.vy,.7+.16*imp);
    o.spinV+=(this.rng()-.5)*.8*imp;
    o.stab=clamp(o.stab-d2,0,100);o.noRegen=S.delay;
    if(!o.down)o.stagger=Math.max(o.stagger,clamp(.14+d2*.012,.16,.58));
    if(src){o.lastHitBy=src.id;o.lastHitT=this.t}
    o.lastHitKind=kind;o.lastImpact=imp;
    if(src){const s=this.stats[src.id];s.hits++;s.dmg+=d2;s.best=Math.max(s.best,imp)}
    this.stats[o.id].taken++;
    const tier=(imp>=10.5||d2>=27)?'critical':(imp>=6.8||d2>=20)?'heavy':(imp<4.4&&d2<15)?'light':'medium';
    this.emit('hit',{src:src?src.id:-1,dst:o.id,x:o.x-nx*.3,z:o.z-nz*.3,nx,nz,force:f2,dmg:d2,imp,tier,kind,power:power||0});
    if(o.stab<=0&&!o.down)this.startDown(o,nx,nz);
    return true;
  }
  shock(x,z,R,force,dmg,kind){                     // radial blast (meteors): strongest at the centre
    this.emit('shock',{x,z,r:R,kind});
    for(const f of this.fighters){
      if(!f.alive||f.falling)continue;
      const dx=f.x-x,dz=f.z-z,d=Math.hypot(dx,dz),reach=R+f.r*.4;
      if(d>reach)continue;
      let nx,nz;if(d<.05){const a=this.rng()*TAU;nx=Math.cos(a);nz=Math.sin(a)}else{nx=dx/d;nz=dz/d}
      const k=sat(1-d/reach);
      this.hit(f,null,nx,nz,force*(.45+.55*k),dmg*(.35+.65*k),kind,0);
    }
  }
  startDown(f,nx,nz){
    f.down=true;f.downT=0;f.downStage='impact';f.downSide=this.rng()<.5?-1:1;f.stab=0;f.stagger=0;f.recover=0;
    f.charging=false;f.charge=0;f.chargeFull=false;f.bashT=0;f.dashT=0;
    f.noRegen=2.9;f.vx+=nx*1.0;f.vz+=nz*1.0;f.vy=Math.max(f.vy,1.05);f.spinV+=(this.rng()-.5)*9;
    this.emit('knockdown',{id:f.id,x:f.x,z:f.z});
  }
  downStep(f,dt){
    const D=TUNE.down,S=TUNE.stab;f.downT+=dt;
    const t=f.downT,total=D.impact+D.limp+D.brace+D.rise;
    f.downStage=t<D.impact?'impact':t<D.impact+D.limp?'limp':t<D.impact+D.limp+D.brace?'brace':'rise';
    f.vy-=TUNE.fall.g*.38*dt;f.y+=f.vy*dt;
    if(f.y<=0){f.y=0;f.vy=Math.abs(f.vy)>.6&&f.downStage==='impact'?-f.vy*.12:0}
    this.coast(f,dt,f.downStage==='impact'?1.25:2.15);
    if(this.gx||this.gz){f.vx+=this.gx*dt;f.vz+=this.gz*dt}
    f.x+=f.vx*dt;f.z+=f.vz*dt;f.spinV*=Math.exp(-3*dt);f.spin+=f.spinV*dt;
    if(t>=total){
      f.down=false;f.downStage='none';f.stab=S.getup;f.protect=S.protect;f.recover=.12;f.noRegen=1.2;f.vy=0;
      this.emit('getup',{id:f.id});
    }
  }
  collide(a,b,dt){
    if(!a.alive||!b.alive||a.falling||b.falling)return;
    const C=TUNE.contact;
    let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);const min=a.r+b.r;
    if(d>=min)return;
    if(d<1e-4){dx=1;dz=0;d=1e-4}
    const nx=dx/d,nz=dz/d,over=min-d;
    const ia=1/(a.mass*(a.down?C.downMass:1)),ib=1/(b.mass*(b.down?C.downMass:1)),is=ia+ib;
    const corr=Math.max(0,over-C.slop)*C.corr;
    a.x-=nx*corr*ia/is;a.z-=nz*corr*ia/is;b.x+=nx*corr*ib/is;b.z+=nz*corr*ib/is;
    const rvn=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
    if(rvn<0){
      const j=-(1+C.rest)*rvn/is;
      a.vx-=nx*j*ia;a.vz-=nz*j*ia;b.vx+=nx*j*ib;b.vz+=nz*j*ib;
      const closing=-rvn;
      if(closing>C.bump){
        const loss=(closing-C.bump)*C.bumpStab*this.P.dmg;
        a.stab=clamp(a.stab-loss,0,100);b.stab=clamp(b.stab-loss,0,100);
        if(closing>C.hard){a.stagger=Math.max(a.stagger,C.hardStag);b.stagger=Math.max(b.stagger,C.hardStag)}
        if(a.lastBump===undefined||this.t-a.lastBump>.12){
          a.lastBump=b.lastBump=this.t;
          this.emit('bump',{a:a.id,b:b.id,x:(a.x+b.x)/2,z:(a.z+b.z)/2,speed:closing});
        }
        if(a.stab<=0&&!a.down)this.startDown(a,-nx,-nz);
        if(b.stab<=0&&!b.down)this.startDown(b,nx,nz);
      }
    }
    // tangential friction so glancing blows spin people around
    const tx=-nz,tz=nx,ts=(b.vx-a.vx)*tx+(b.vz-a.vz)*tz,fr=(1-Math.exp(-C.fric*dt))*ts/is;
    a.vx+=tx*fr*ia;a.vz+=tz*fr*ia;b.vx-=tx*fr*ib;b.vz-=tz*fr*ib;
  }

  /* ---- ground + falling */
  supportCheck(f,dt){
    if(!f.alive||f.falling)return;
    const E=TUNE.edge;
    if(f.winner){
      if(!this.supportedAt(f.x,f.z,E.pad)){const d=Math.hypot(f.x,f.z)||1;f.vx+=-f.x/d*6*dt;f.vz+=-f.z/d*6*dt}
      return;
    }
    if(!this.supportedAt(f.x,f.z,E.pad)){
      f.unsup+=dt;
      if(f.unsup>E.delay)this.startFall(f,this.map.fallCause(this,f.x,f.z,E.pad));
    }else f.unsup=Math.max(0,f.unsup-dt*3);
    const d=Math.hypot(f.x,f.z);
    if(d>.3&&f.unsup<=0&&this.supportedAt(f.x,f.z,E.pad)){
      const k=E.teeter/d;let edge=!this.supportedAt(f.x+f.x*k,f.z+f.z*k,0);
      if(!edge){const sp=Math.hypot(f.vx,f.vz);if(sp>.6)edge=!this.supportedAt(f.x+f.vx/sp*E.teeter,f.z+f.vz/sp*E.teeter,0)}
      f.teeter=edge?Math.min(1,f.teeter+dt*8):Math.max(0,f.teeter-dt*5);
    }else if(f.unsup>0)f.teeter=1;
  }
  startFall(f,cause){
    f.falling=true;f.fallT=0;f.fallStart=this.t;f.vy=Math.max(f.vy,TUNE.fall.hop);f.fallCause=cause;
    f.charging=false;f.charge=0;f.chargeFull=false;f.bashT=0;f.dashT=0;f.down=false;f.downStage='none';
    f.spinV+=(this.rng()-.5)*10;
    const by=(this.t-f.lastHitT<3&&f.lastHitBy>=0)?f.lastHitBy:-1;f.fallBy=by;
    this.stats[f.id].falls++;if(by>=0)this.stats[by].kos++;
    this.emit('fall',{id:f.id,by,cause,x:f.x,z:f.z,vx:f.vx,vz:f.vz,kind:f.lastHitKind,imp:f.lastImpact});
    this.deriveState(f);
  }
  fallStep(f,dt){
    f.fallT+=dt;f.vy-=TUNE.fall.g*dt;f.y+=f.vy*dt;
    const k=Math.exp(-.5*dt);f.vx*=k;f.vz*=k;f.x+=f.vx*dt;f.z+=f.vz*dt;f.spin+=f.spinV*dt;
    if(f.y<LAVA_Y+.4){f.alive=false;f.state='out';this.emit('out',{id:f.id,x:f.x,z:f.z})}
    else f.state='fall';
  }

  /* ---- rules */
  checkRoundEnd(){
    let standing=0,last=null;
    for(const f of this.fighters)if(f.alive&&!f.falling){standing++;last=f}
    if(standing>1)return;
    let w=-1;
    if(standing===1)w=last.id;
    else{
      const s=this.fighters.slice().sort((a,b)=>b.fallStart-a.fallStart);
      if(s.length>=2&&s[0].fallStart-s[1].fallStart>.35)w=s[0].id;
    }
    this.endRound(w);
  }
  endRound(w){
    if(this.phase!=='fight')return;
    this.phase='roundend';this.phaseT=0;this.winner=w;
    for(const k of this.inputs){k.mx=0;k.mz=0;k.bashDown=false;k.bashPower=-1;k.dash=false}
    for(const f of this.fighters){f.charging=false;f.charge=0;f.bashT=0;f.dashT=0}
    if(w>=0){
      this.crowns[w]++;this.stats[w].rounds++;
      const f=this.fighters[w];f.winner=true;f.vx*=.3;f.vz*=.3;
      if(this.crowns[w]>=this.winTarget)this.matchWinner=w;
    }
    this.emit('roundEnd',{winner:w,crowns:this.crowns.slice(0,this.n),match:this.matchWinner});
  }

  /* ---- misc API */
  alive(){return this.fighters.filter(f=>f.alive&&!f.falling).length}
  snapshot(){
    const A=this.arena;
    return {version:VERSIONS.sim,seed:this.seed,phase:this.phase,round:this.round,t:+this.t.toFixed(3),n:this.n,map:this.map.id,
      winTarget:this.winTarget,difficulty:this.difficulty,crowns:this.crowns.slice(0,this.n),options:Object.assign({},this.O),
      arena:A?{kind:A.kind,R0:+A.R0.toFixed(2),standing:+this.standingRadius(0).toFixed(2),core:+(A.core*A.coreScale).toFixed(2),
               sudden:A.sudden,suddenT:+A.suddenT.toFixed(1),hud:this.hudInfo()}:null,
      fighters:this.fighters.map(f=>({id:f.id,name:f.name,kind:f.kind,owner:f.kind,style:f.style,alive:f.alive,state:f.state,x:+f.x.toFixed(2),z:+f.z.toFixed(2),
        vx:+f.vx.toFixed(2),vz:+f.vz.toFixed(2),stab:+f.stab.toFixed(1),charge:+f.charge.toFixed(2),bashCd:+f.bashCd.toFixed(2),dashCd:+f.dashCd.toFixed(2)}))};
  }
}
