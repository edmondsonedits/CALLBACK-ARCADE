/* ============================================================================
   ROYAL SUMO - AUDIO  (fully procedural WebAudio: SFX, UI sounds, per-map music)
   ========================================================================== */
import {NAMES} from '../core/tune.js';
export const Sound=(function(){
  const S={ctx:null,g:null,vol:{master:.8,music:.6,sfx:.9,mute:false},tracks:[],timer:0,int:0,intT:0,wantMap:null,curMap:null,live:0,last:{},charge:{},nbuf:null,unlocked:false};
  const mf=(root,semi)=>root*Math.pow(2,semi/12);
  const rnd=(a,b)=>a+Math.random()*(b-a);

  /* ------------------------------------------------------------- graph --- */
  function buildGraph(c){
    const G={};
    G.master=c.createGain();G.master.gain.value=1;
    G.comp=c.createDynamicsCompressor();
    G.comp.threshold.value=-16;G.comp.knee.value=10;G.comp.ratio.value=10;G.comp.attack.value=.003;G.comp.release.value=.2;
    G.shaper=c.createWaveShaper();
    const N=2048,cv=new Float32Array(N);for(let i=0;i<N;i++){const x=i/(N-1)*2-1;cv[i]=.95*Math.tanh(1.3*x)}
    G.shaper.curve=cv;
    G.out=c.createGain();G.out.gain.value=.9;
    G.master.connect(G.comp);G.comp.connect(G.shaper);G.shaper.connect(G.out);G.out.connect(c.destination);
    for(const b of['music','sfx','ui','crowd']){G[b]=c.createGain();G[b].gain.value=1;G[b].connect(G.master)}
    return G;
  }
  function applyVol(){
    const G=S.g;if(!G||!S.ctx)return;const t=S.ctx.currentTime,v=S.vol;
    G.master.gain.setTargetAtTime(v.mute?0:v.master,t,.04);
    G.music.gain.setTargetAtTime(v.music*.8,t,.04);
    G.sfx.gain.setTargetAtTime(v.sfx,t,.04);G.ui.gain.setTargetAtTime(v.sfx,t,.04);G.crowd.gain.setTargetAtTime(v.sfx*.7,t,.04);
  }
  function noiseBuf(c){
    if(c._nb)return c._nb;
    const n=c.sampleRate*2,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);
    let s=12345;for(let i=0;i<n;i++){s=(s*1664525+1013904223)>>>0;d[i]=(s/4294967296)*2-1}
    return c._nb=b;
  }

  /* -------------------------------------------------------- primitives --- */
  // X = {c, d}  (context + destination node)
  function osc(X,type,f0,f1,t,dur,g,o){
    const c=X.c,os=c.createOscillator(),gn=c.createGain();o=o||{};
    os.type=type;os.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
    if(o.det)os.detune.value=o.det;
    const a=o.a||.004,r=o.r||.03;
    gn.gain.setValueAtTime(.0001,t);gn.gain.linearRampToValueAtTime(g,t+a);
    if(o.sus){gn.gain.setValueAtTime(g,Math.max(t+a,t+dur));gn.gain.exponentialRampToValueAtTime(.0001,t+dur+r)}
    else gn.gain.exponentialRampToValueAtTime(.0001,t+dur+r);
    let tail=gn;
    if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;f.Q.value=o.q||.7;os.connect(f);f.connect(gn)}else os.connect(gn);
    if(o.bp){/* handled by caller */}
    gn.connect(X.d);
    os.start(t);os.stop(t+dur+r+.03);
    os.onended=()=>{try{gn.disconnect()}catch(e){}};
    return os;
  }
  function noise(X,ftype,f0,f1,q,t,dur,g,o){
    const c=X.c,src=c.createBufferSource(),f=c.createBiquadFilter(),gn=c.createGain();o=o||{};
    src.buffer=noiseBuf(c);src.loop=true;
    f.type=ftype;f.Q.value=q||1;f.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    const a=o.a||.003,r=o.r||.03;
    gn.gain.setValueAtTime(.0001,t);gn.gain.linearRampToValueAtTime(g,t+a);
    if(o.sus){gn.gain.setValueAtTime(g,Math.max(t+a,t+dur));gn.gain.exponentialRampToValueAtTime(.0001,t+dur+r)}
    else gn.gain.exponentialRampToValueAtTime(.0001,t+dur+r);
    src.connect(f);f.connect(gn);gn.connect(X.d);
    src.start(t,Math.random()*1.5);src.stop(t+dur+r+.03);
    src.onended=()=>{try{gn.disconnect()}catch(e){}};
  }
  // vibrato helper: LFO onto an oscillator's frequency
  function vib(X,os,rate,depth,t,dur){
    const c=X.c,l=c.createOscillator(),lg=c.createGain();l.frequency.value=rate;lg.gain.value=depth;l.connect(lg);lg.connect(os.frequency);l.start(t);l.stop(t+dur+.1);
    l.onended=()=>{try{lg.disconnect()}catch(e){}};
  }

  /* ------------------------------------------------------------- drums --- */
  const kick=(X,t,g)=>{osc(X,'sine',150,45,t,.14,g,{r:.06});noise(X,'highpass',2500,2500,.7,t,.015,g*.25)};
  const snare=(X,t,g)=>{noise(X,'bandpass',1900,1500,.8,t,.13,g,{r:.05});osc(X,'triangle',210,150,t,.09,g*.5)};
  const hat=(X,t,g,open)=>noise(X,'highpass',7500,7500,.7,t,open?.16:.035,g,{r:.02});
  const tom=(X,t,f,g)=>{osc(X,'sine',f,f*.62,t,.2,g,{r:.08});noise(X,'bandpass',900,900,1,t,.02,g*.3)};
  const rim=(X,t,g)=>{osc(X,'square',1700,1500,t,.025,g*.6);noise(X,'bandpass',3000,3000,2,t,.03,g*.5)};
  /* ------------------------------------------------------ instruments --- */
  const bell=(X,t,f,g)=>{osc(X,'sine',f,f,t,1.1,g,{a:.003,r:.2});osc(X,'sine',f*2.76,f*2.76,t,.5,g*.35,{r:.1});osc(X,'sine',f*5.4,f*5.4,t,.2,g*.12)};
  const marimba=(X,t,f,g)=>{osc(X,'sine',f,f,t,.38,g,{a:.002,r:.08});osc(X,'sine',f*4,f*4,t,.1,g*.4)};
  const saw=(X,t,f,dur,g,lp,o)=>{o=o||{};osc(X,'sawtooth',f,f,t,dur,g,{lp:lp||1800,det:-8,sus:!!o.sus,a:o.a||.006,r:o.r||.05});osc(X,'sawtooth',f,f,t,dur,g,{lp:lp||1800,det:8,sus:!!o.sus,a:o.a||.006,r:o.r||.05})};
  const bass=(X,t,f,dur,g,type,lp)=>osc(X,type||'sawtooth',f,f,t,dur,g,{lp:lp||500,a:.004,r:.04});
  const pad=(X,t,fs,dur,g)=>{for(const f of fs)osc(X,'triangle',f,f,t,dur,g,{lp:1100,a:Math.min(.8,dur*.3),r:.5,sus:true})};
  const twang=(X,t,f,dur,g)=>{const o=osc(X,'sawtooth',f*.92,f,t,.05,g,{lp:2600,q:3,a:.003,r:.05});osc(X,'sawtooth',f,f,t+.04,dur,g,{lp:2200,q:2,a:.002,r:.06});};
  const accord=(X,t,f,dur,g)=>{osc(X,'sawtooth',f,f,t,dur,g,{lp:1500,det:-9,sus:true,a:.015,r:.06});osc(X,'sawtooth',f,f,t,dur,g,{lp:1500,det:9,sus:true,a:.015,r:.06});osc(X,'square',f*2,f*2,t,dur,g*.3,{lp:2400,sus:true,a:.015,r:.06})};
  const chip=(X,t,f,dur,g)=>osc(X,'square',f,f,t,dur,g,{lp:3200,a:.002,r:.03});

  /* -------------------------------------------------------- music defs --- */
  const MUSIC={
    keep:{bpm:112,steps:16,div:4,play(X,t,st,I){
      const bar=((st/16)|0)%4,s=st%16,root=110*Math.pow(2,[0,-4,-2,-5][bar]/12),ch=bar===0?[0,3,7]:[0,4,7];
      if(s===0||s===8||(I>.5&&s===10))kick(X,t,.55);
      if(s===4||s===12)snare(X,t,.3);
      if(bar===3&&(s===14||s===15))snare(X,t,.22);
      if(I>.3&&s%2===0)hat(X,t,.08,false);
      if(s%2===0)bass(X,t,s%4===2?root*1.5:root,.12,.22,'sawtooth',420);
      if(s===0||s===10||(I>.35&&s===6))for(const i of ch)saw(X,t,root*2*Math.pow(2,i/12),.2,.05,1700);
      if(I>.55&&s%2===0){const m=[12,15,17,19,17,15,12,10][(s/2)%8];chip(X,t,root*2*Math.pow(2,m/12),.1,.06)}
    }},
    floe:{bpm:96,steps:16,div:4,play(X,t,st,I){
      const bar=((st/16)|0)%4,s=st%16,root=293.66*Math.pow(2,[0,-2,-5,-7][bar]/12),ch=[0,4,7,12,16,19];
      if(s===0)pad(X,t,[root/2,root/2*1.5,root*1.2599],16*.156,.05);
      if(s%2===0)bell(X,t,root*Math.pow(2,ch[[0,1,2,3,2,1,4,5][(s/2)%8]]/12),.07);
      if(I>.3&&s%2===1)bell(X,t,root*2*Math.pow(2,ch[[2,3,1,4][(s>>1)%4]]/12),.035);
      if(s%4===2)noise({c:X.c,d:X.d},'highpass',9000,9000,.7,t,.05,.03);
      if(I>.5&&(s===0||s===8))kick(X,t,.3);
      if(I>.5&&(s===4||s===12))rim(X,t,.12);
    }},
    plaza:{bpm:128,steps:16,div:4,play(X,t,st,I){
      const bar=((st/16)|0)%4,s=st%16,root=130.81*Math.pow(2,[0,0,-2,3][bar]/12);
      if(s%4===0)kick(X,t,.5);
      if(s===4||s===12)snare(X,t,.25);
      if(s%4===2)hat(X,t,.09,false);
      const b=[0,-1,0,0,-1,3,-1,0,0,-1,0,5,-1,3,-1,7][s];
      if(b>=0)bass(X,t,root*Math.pow(2,b/12),.1,.24,'square',600);
      if(I>.2&&s%2===1){const a=[12,15,19,15,24,19,15,12][(s>>1)%8];chip(X,t,root*2*Math.pow(2,a/12),.07,.05)}
      if(I>.6&&s%4===3)chip(X,t,root*4*Math.pow(2,[0,3,7,10][(s>>2)%4]/12),.1,.045);
    }},
    wharf:{bpm:132,steps:12,div:2,play(X,t,st,I){
      const bar=((st/12)|0)%4,s=st%12,root=146.83*Math.pow(2,[0,0,5,7][bar]/12);
      if(s===0||s===6){bass(X,t,s===0?root/2:root*.75,.2,.3,'triangle',600);kick(X,t,.4)}
      if(s===3||s===9){const ch=bar===3?[0,4,7]:[0,4,7];for(const i of ch)accord(X,t,root*Math.pow(2,i/12),.18,.025)}
      if(I>.2&&(s===3||s===9))snare(X,t,.2);
      if(I>.5&&s%2===1)hat(X,t,.06,false);
      const mel=[12,-1,14,-1,16,14,12,-1,9,-1,12,-1][s];
      if(mel>=0)accord(X,t,root*2*Math.pow(2,(mel+(bar===2?-5:0))/12),.3,.05);
    }},
    teeter:{bpm:104,steps:16,div:4,play(X,t,st,I){
      const bar=((st/16)|0)%4,s=st%16,root=220*Math.pow(2,[0,0,-2,3][bar]/12);
      if([0,3,6,10,12].includes(s))tom(X,t,95,.5);
      if([2,5,8,11,14,15].includes(s))tom(X,t,170,.3);
      if(I>.3&&s%2===1)noise(X,'highpass',6500,6500,.7,t,.04,.06);
      if(I>.6&&s%8===0)kick(X,t,.4);
      const m=[0,-1,3,-1,5,7,-1,5,3,-1,0,-1,-2,0,-1,-1][s];
      if(m>=0)marimba(X,t,root*2*Math.pow(2,m/12),.13);
      if(s===0)pad(X,t,[root/2,root/2*1.5],16*.144,.04);
    }},
    mesa:{bpm:88,steps:16,div:4,play(X,t,st,I){
      const bar=((st/16)|0)%4,s=st%16,root=82.41*Math.pow(2,[0,0,-2,-5][bar]/12);
      if(s===0){osc(X,'sine',root,root,t,16*.17,.09,{sus:true,a:.4,r:.6});osc(X,'sine',root*1.5,root*1.5,t,16*.17,.04,{sus:true,a:.6,r:.6})}
      if(s===0||(I>.5&&s===8))kick(X,t,.4);
      if(I>.3&&s===8)rim(X,t,.2);
      if(I>.5&&s%2===1)noise(X,'highpass',7000,7000,.7,t,.04,.05);
      const m=[0,-1,-1,3,-1,5,-1,-1,7,-1,5,-1,3,-1,0,-1][s];
      if(m>=0)twang(X,t,root*4*Math.pow(2,m/12),.35,.075);
      if(s%8===0)bass(X,t,root,.4,.2,'sine',300);
    }}
  };
  for(const k in MUSIC){MUSIC[k].sd=60/MUSIC[k].bpm/MUSIC[k].div}

  /* -------------------------------------------------------------- sfx ---- */
  const SFX={
    bash(X,t,o){const p=o.p;noise(X,'bandpass',500,1900,1.2,t,.14+.14*p,.18+.32*p,{a:.04,r:.06});osc(X,'sawtooth',220,80,t,.18,.06+.08*p,{lp:700})},
    hitLight(X,t){noise(X,'highpass',1800,1800,.8,t,.07,.3);osc(X,'sine',320,150,t,.08,.4)},
    hitMedium(X,t){osc(X,'sine',190,60,t,.2,.6,{r:.06});noise(X,'lowpass',1000,500,.8,t,.12,.35)},
    hitHeavy(X,t){osc(X,'sine',130,38,t,.32,.8,{r:.08});noise(X,'bandpass',1300,500,.9,t,.2,.5);osc(X,'sawtooth',90,35,t,.2,.18,{lp:400})},
    hitCritical(X,t){osc(X,'sine',100,28,t,.7,.95,{r:.15});noise(X,'bandpass',1500,400,.7,t,.28,.6);osc(X,'sawtooth',110,30,t,.3,.25,{lp:500});noise(X,'highpass',5200,5200,.7,t+.04,1.1,.28,{a:.18,r:.4})},
    hitSweeper(X,t){osc(X,'sine',950,700,t,.07,.5);osc(X,'sine',1450,1100,t+.02,.06,.35);noise(X,'bandpass',2600,2200,2,t,.05,.4)},
    hitMeteor(X,t){osc(X,'sine',95,24,t,.8,.9,{r:.2});noise(X,'lowpass',500,150,.8,t,.6,.6)},
    dash(X,t){noise(X,'bandpass',600,2800,1.2,t,.22,.38,{a:.05,r:.06});osc(X,'sine',300,760,t,.2,.18)},
    chargeFull(X,t){osc(X,'sine',1318,1318,t,.4,.3,{r:.15});osc(X,'sine',1976,1976,t+.03,.3,.18,{r:.1})},
    bump(X,t){osc(X,'sine',230,100,t,.09,.35);noise(X,'lowpass',700,400,.7,t,.05,.15)},
    knockdown(X,t){const os=osc(X,'sine',420,150,t,.4,.35,{r:.1});vib(X,os,14,26,t,.4);osc(X,'sine',95,40,t+.22,.18,.55)},
    getup(X,t){const o=X.c.createOscillator(),g=X.c.createGain();o.type='sine';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(620,t+.12);o.frequency.exponentialRampToValueAtTime(300,t+.28);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.32,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(X.d);o.start(t);o.stop(t+.34);o.onended=()=>{try{g.disconnect()}catch(e){}}},
    fall(X,t){const os=osc(X,'sine',1500,260,t,.9,.24,{a:.02,r:.1});vib(X,os,9,35,t,.9)},
    outLava(X,t){noise(X,'highpass',3200,2400,.6,t,.9,.3,{a:.02,r:.2});osc(X,'sine',140,55,t,.3,.4);for(let i=0;i<6;i++)noise(X,'highpass',5000,5000,2,t+.1+i*rnd(.08,.14),.02,.25)},
    outWater(X,t){noise(X,'bandpass',1400,500,.7,t,.55,.5,{a:.01,r:.2});osc(X,'sine',520,230,t+.05,.14,.3);osc(X,'sine',380,180,t+.18,.12,.2)},
    outPlop(X,t){osc(X,'sine',420,120,t,.16,.5);noise(X,'lowpass',900,300,.7,t,.12,.25)},
    warn(X,t){osc(X,'square',1250,1250,t,.045,.14,{lp:3000});osc(X,'square',1250,1250,t+.1,.045,.14,{lp:3000})},
    drop(X,t){noise(X,'lowpass',260,90,.8,t,.7,.7,{a:.03,r:.2});for(let i=0;i<7;i++)noise(X,'bandpass',rnd(500,1800),300,1.5,t+rnd(.02,.6),.05,.28)},
    iceCrack(X,t){for(const d of[0,.03,.09,.17])noise(X,'highpass',4200,4200,1,t+d,.02,.45);osc(X,'sine',2300,900,t,.12,.18)},
    sudden(X,t){for(let i=0;i<3;i++){const o=X.c.createOscillator(),g=X.c.createGain(),f=X.c.createBiquadFilter(),s=t+i*.55;o.type='sawtooth';f.type='lowpass';f.frequency.value=2200;
      o.frequency.setValueAtTime(520,s);o.frequency.exponentialRampToValueAtTime(860,s+.27);o.frequency.exponentialRampToValueAtTime(520,s+.54);
      g.gain.setValueAtTime(.0001,s);g.gain.linearRampToValueAtTime(.22,s+.03);g.gain.setValueAtTime(.22,s+.48);g.gain.exponentialRampToValueAtTime(.0001,s+.56);o.connect(f);f.connect(g);g.connect(X.d);o.start(s);o.stop(s+.6);o.onended=()=>{try{g.disconnect()}catch(e){}}}
      osc(X,'sine',60,40,t,1.2,.4)},
    count(X,t,o){const hi=o.n===0;osc(X,'square',hi?1046:660,hi?1046:660,t,.14,.2,{lp:3000})},
    go(X,t){[523,659,784,1046].forEach((f,i)=>{osc(X,'square',f,f,t+i*.06,.32,.12,{lp:3200,r:.1});osc(X,'triangle',f/2,f/2,t+i*.06,.3,.15)});noise(X,'highpass',5000,5000,.7,t,.5,.12,{a:.05,r:.2})},
    roundWin(X,t){[523,659,784,1046].forEach((f,i)=>{osc(X,'triangle',f,f,t+i*.1,.22,.28,{r:.08});osc(X,'square',f,f,t+i*.1,.2,.07,{lp:2600})})},
    matchWin(X,t){[523,659,784,1046,784,1046,1318].forEach((f,i)=>{osc(X,'triangle',f,f,t+i*.14,.3,.3,{r:.1});osc(X,'square',f,f,t+i*.14,.26,.08,{lp:2800})});
      [523,659,784,1046].forEach(f=>osc(X,'triangle',f,f,t+1,1,.18,{r:.5}));noise(X,'highpass',5500,5500,.7,t+1,1.4,.2,{a:.1,r:.5})},
    lose(X,t){[392,349,311,262].forEach((f,i)=>osc(X,'triangle',f,f*.985,t+i*.2,.3,.28,{r:.1}))},
    bumper(X,t,o){const s=Math.min(1,(o.speed||8)/18),f=220+s*140;const os=X.c.createOscillator(),g=X.c.createGain();os.type='sine';os.frequency.setValueAtTime(f,t);os.frequency.exponentialRampToValueAtTime(f*2,t+.05);os.frequency.exponentialRampToValueAtTime(f*1.1,t+.26);
      g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.38,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.28);os.connect(g);g.connect(X.d);os.start(t);os.stop(t+.32);os.onended=()=>{try{g.disconnect()}catch(e){}};noise(X,'bandpass',1800,1800,2,t,.03,.2)},
    rail(X,t){const os=osc(X,'triangle',190,170,t,.4,.3,{lp:1800,r:.1});vib(X,os,24,16,t,.4);noise(X,'bandpass',2400,2400,2,t,.03,.2)},
    sweepWarn(X,t){[[880,0],[660,.26]].forEach(a=>{osc(X,'sine',a[0],a[0],t+a[1],.7,.26,{r:.2});osc(X,'sine',a[0]*2.4,a[0]*2.4,t+a[1],.3,.09)})},
    sweep(X,t){noise(X,'bandpass',280,650,1,t,.5,.28,{a:.12,r:.15});osc(X,'sine',85,70,t,.4,.2)},
    duck(X,t){noise(X,'highpass',1500,5000,.8,t,.14,.3,{a:.02,r:.04})},
    meteorWarn(X,t){const os=osc(X,'sine',1900,600,t,.8,.13,{a:.05,r:.1});vib(X,os,12,40,t,.8)},
    meteorHit(X,t){osc(X,'sine',90,22,t,.9,.95,{r:.2});noise(X,'lowpass',700,120,.8,t,.7,.65);for(let i=0;i<5;i++)noise(X,'bandpass',rnd(600,1500),300,1.5,t+.1+rnd(0,.5),.06,.25)},
    shock(X,t){osc(X,'sine',72,32,t,.35,.6);noise(X,'lowpass',500,180,.8,t,.2,.35)},
    land(X,t){osc(X,'sine',140,60,t,.12,.3);noise(X,'lowpass',600,300,.7,t,.07,.15)},
    cheerPulse(X,t,o){const s=o.p||.6;noise(X,'bandpass',650,900,1.4,t,.9+s,.35*s,{a:.3,r:.5});noise(X,'bandpass',1500,1900,1.8,t,.8+s,.22*s,{a:.3,r:.4});for(let i=0;i<6;i++)noise(X,'bandpass',rnd(1200,2400),rnd(900,1500),1.2,t+.15+rnd(0,1.2),.04,.18*s)},
    // ui
    click(X,t){osc(X,'sine',920,640,t,.05,.22)},
    back(X,t){osc(X,'sine',620,400,t,.07,.22)},
    select(X,t){osc(X,'sine',700,700,t,.045,.2);osc(X,'sine',1000,1000,t+.05,.06,.2)},
    toggle(X,t){osc(X,'square',800,1200,t,.06,.1,{lp:2500})},
    start(X,t){[523,659,784].forEach((f,i)=>{osc(X,'triangle',f,f,t+i*.07,.14,.28,{r:.05});osc(X,'square',f,f,t+i*.07,.1,.05,{lp:2600})})},
    error(X,t){osc(X,'square',170,150,t,.12,.18,{lp:900});osc(X,'square',170,150,t+.16,.14,.18,{lp:900})},
    pause(X,t){osc(X,'sine',720,400,t,.1,.25)},
    resume(X,t){osc(X,'sine',400,720,t,.1,.25)}
  };
  const NAMES=Object.keys(SFX);
  const PRIO={hitHeavy:1,hitCritical:1,fall:1,sudden:1,roundWin:1,matchWin:1,go:1,count:1,meteorHit:1,click:1,back:1,select:1,toggle:1,start:1,pause:1,resume:1,win:1,lose:1};

  /* ----------------------------------------------------------- playing --- */
  function play(name,bus,o){
    const c=S.ctx;if(!c||!S.g||c.state!=='running'||!SFX[name])return;
    o=o||{};const now=c.currentTime;
    const lt=S.last[name]||0;if(now-lt<(o.gap||.035))return;S.last[name]=now;
    if(S.live>28&&!PRIO[name])return;
    const gain=c.createGain();gain.gain.value=o.vol===undefined?1:o.vol;
    let dest=S.g[bus||'sfx'];
    let node=gain;
    if(o.pan&&c.createStereoPanner){const p=c.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,o.pan));gain.connect(p);p.connect(dest);node=p}else gain.connect(dest);
    S.live++;
    setTimeout(()=>{S.live=Math.max(0,S.live-1);try{gain.disconnect();if(node!==gain)node.disconnect()}catch(e){}},((o.life||1.6)*1000)|0);
    try{SFX[name]({c,d:gain},now+.005,o)}catch(e){}
  }
  function cheer(s){s=Math.max(0,Math.min(1,s===undefined?.6:s));play('cheerPulse','crowd',{p:s,gap:.4,life:3.4})}
  const HITNAME={light:'hitLight',medium:'hitMedium',heavy:'hitHeavy',critical:'hitCritical'};
  function event(e,info){
    if(!S.ctx||S.ctx.state!=='running'||!e)return;
    info=info||{};const pan=info.pan||0,near=info.near===undefined?.7:info.near,me=!!info.me;
    const vol=(.35+.65*near)*(me?1.1:.9);const base={pan,vol};
    const P=(n,x)=>play(n,'sfx',Object.assign({},base,x||{}));
    switch(e.type){
      case 'bash':P('bash',{p:Math.max(0,Math.min(1,e.power||0)),gap:.06});break;
      case 'dash':P('dash',{gap:.08});break;
      case 'chargeFull':if(me)P('chargeFull');break;
      case 'hit':{
        const k=e.kind;let n=HITNAME[e.tier]||'hitMedium';
        if(k==='sweeper')n='hitSweeper';else if(k==='meteor')n='hitMeteor';
        P(n,{gap:.05,life:2});
        if(e.tier==='critical')cheer(.7);else if(e.tier==='heavy'&&Math.random()<.5)cheer(.35);
        break}
      case 'knockdown':P('knockdown',{life:1.2});break;
      case 'getup':P('getup');break;
      case 'bump':if((e.speed||0)>2.5)P('bump',{vol:vol*Math.min(1,(e.speed||3)/10)});break;
      case 'land':if((e.speed||0)>7)P('land');break;
      case 'fall':P('fall',{life:1.6});break;
      case 'out':{const m=S.curMap;P(m==='keep'?'outLava':m==='floe'?'outWater':'outPlop',{life:2});if(me)cheer(.2);break}
      case 'warn':P('warn',{gap:.2});break;
      case 'drop':P(S.curMap==='floe'?'iceCrack':'drop',{gap:.1,life:1.6});if(S.curMap==='floe')P('drop',{vol:vol*.5,gap:.1});break;
      case 'ringGone':break;
      case 'sudden':play('sudden','sfx',{life:2.4,gap:1});break;
      case 'count':api.ui('count',{n:e.n});break;
      case 'go':play('go','ui',{life:1.4});cheer(.5);break;
      case 'roundEnd':play(e.winner===0?'roundWin':(e.winner<0?'lose':'roundWin'),'ui',{life:1.6,vol:e.winner===0?1:.6});cheer(e.winner===0?.8:.5);break;
      case 'matchEnd':play(e.winner===0?'matchWin':'lose','ui',{life:3,vol:1});if(e.winner===0)cheer(1);break;
      case 'bumper':P('bumper',{speed:e.speed,gap:.06});break;
      case 'rail':P('rail',{gap:.08});break;
      case 'sweepWarn':P('sweepWarn',{life:1.4,gap:1});break;
      case 'sweepReverse':P('sweepWarn',{life:1.4,gap:1});break;
      case 'sweep':P('sweep',{gap:.2,life:1.2});break;
      case 'duck':P('duck');break;
      case 'meteorWarn':P('meteorWarn',{gap:.25,life:1.4});break;
      case 'meteorHit':P('meteorHit',{life:2.2,gap:.1});break;
      case 'shock':P('shock',{gap:.1});break;
    }
  }

  /* -------------------------------------------------------------- music --- */
  function musicTick(){
    const c=S.ctx;if(!c||c.state!=='running')return;
    S.int+=(S.intT-S.int)*.08;
    const tr=S.tracks[S.tracks.length-1];
    for(const m of S.tracks){
      if(m.dead)continue;
      while(m.next<c.currentTime+.12){
        if(m.next<c.currentTime-.05)m.next=c.currentTime+.02;
        try{m.def.play({c,d:m.bus},m.next,m.step,S.int)}catch(e){}
        m.next+=m.def.sd;m.step++;
        if(m.fading&&m.next>m.endT){m.dead=true;break}
      }
    }
    S.tracks=S.tracks.filter(m=>{if(m.dead){try{m.bus.disconnect()}catch(e){}return false}return true});
    if(!S.tracks.length){clearInterval(S.timer);S.timer=0}
  }
  function startMusic(map){
    const c=S.ctx;if(!c||!S.g)return;
    const def=MUSIC[map];
    const cur=S.tracks[S.tracks.length-1];
    if(cur&&cur.map===map&&!cur.fading)return;
    for(const m of S.tracks){if(!m.fading){m.fading=true;m.bus.gain.cancelScheduledValues(c.currentTime);m.bus.gain.setValueAtTime(m.bus.gain.value,c.currentTime);m.bus.gain.linearRampToValueAtTime(0,c.currentTime+1.2);m.endT=c.currentTime+1.3}}
    if(!def)return;
    const bus=c.createGain();bus.gain.value=0;bus.gain.linearRampToValueAtTime(.7,c.currentTime+1.4);bus.connect(S.g.music);
    S.tracks.push({map,def,bus,step:0,next:c.currentTime+.08,fading:false});
    S.curMap=map;
    if(!S.timer)S.timer=setInterval(musicTick,25);
  }

  /* --------------------------------------------------------------- API ---- */
  const api={
    names:NAMES,
    init(){
      if(S.inited)return;S.inited=true;
      try{document.addEventListener('visibilitychange',()=>{const c=S.ctx;if(!c)return;if(document.hidden){c.suspend&&c.suspend()}else if(S.unlocked){c.resume&&c.resume()}})}catch(e){}
    },
    unlock(){
      try{
        if(!S.ctx&&navigator.userActivation&&!navigator.userActivation.hasBeenActive)return;
        if(!S.ctx){
          const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
          S.ctx=new AC({latencyHint:'interactive'});S.g=buildGraph(S.ctx);applyVol();
        }
        S.unlocked=true;
        if(S.ctx.state!=='running'){const p=S.ctx.resume();if(p&&p.then)p.then(()=>{if(S.wantMap)startMusic(S.wantMap)}).catch(()=>{})}
        if(S.wantMap&&!S.tracks.length&&S.ctx.state==='running')startMusic(S.wantMap);
      }catch(e){}
    },
    setVolumes(v){Object.assign(S.vol,v||{});applyVol()},
    event,
    music(map,o){
      S.wantMap=map||null;if(o&&o.intensity!==undefined)S.intT=o.intensity;
      if(!S.ctx||S.ctx.state!=='running')return;
      if(!map){for(const m of S.tracks){if(!m.fading){m.fading=true;m.bus.gain.linearRampToValueAtTime(0,S.ctx.currentTime+1);m.endT=S.ctx.currentTime+1.1}}return}
      startMusic(map);
    },
    intensity(v){S.intT=Math.max(0,Math.min(1,v||0))},
    ui(name,info){
      if(name==='count'){play('count','ui',{n:info&&info.n,gap:.2});return}
      if(name==='win'){play('roundWin','ui');return}
      play(name,'ui',{gap:.03});
    },
    chargeLoop(id,level){
      const c=S.ctx;if(!c||c.state!=='running'||!S.g)return;
      let v=S.charge[id];
      if(level<0){if(v){v.g.gain.setTargetAtTime(0,c.currentTime,.03);try{v.o.stop(c.currentTime+.15)}catch(e){}delete S.charge[id]}return}
      if(!v){
        if(Object.keys(S.charge).length>=3)return;
        const o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type='sawtooth';f.type='lowpass';f.frequency.value=1400;g.gain.value=0;
        o.connect(f);f.connect(g);g.connect(S.g.sfx);o.start();v=S.charge[id]={o,g,f};
        o.onended=()=>{try{g.disconnect()}catch(e){}};
      }
      const l=Math.max(0,Math.min(1,level));
      v.o.frequency.setTargetAtTime(160+l*l*760,c.currentTime,.04);v.g.gain.setTargetAtTime(.03+.07*l,c.currentTime,.05);
    },
    cheer,
    stopAll(){
      for(const id of Object.keys(S.charge))api.chargeLoop(id,-1);
      for(const m of S.tracks){m.dead=true}
    },
    isReady(){return !!S.ctx&&S.ctx.state==='running'},
    /* ------- offline rendering for tests ------- */
    render(name,seconds,sr){
      return offline(seconds,sr,(X)=>{if(!SFX[name])throw new Error('no sfx '+name);SFX[name](X,.05,{p:.8,n:0,speed:10,vol:1})});
    },
    renderMusic(map,seconds,sr,intensity){
      return offline(seconds,sr,(X)=>{const def=MUSIC[map];if(!def)throw new Error('no music '+map);
        let st=0,t=.05;while(t<seconds-.1){def.play(X,t,st,intensity===undefined?.5:intensity);t+=def.sd;st++}},true);
    }
  };
  function offline(seconds,sr,fn,isMusic){
    sr=sr||22050;seconds=seconds||2;
    const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    const c=new OAC(2,Math.ceil(seconds*sr),sr);
    const G=buildGraph(c);G.music.gain.value=.56;
    fn({c,d:isMusic?G.music:G.sfx});
    return c.startRendering().then(buf=>{
      const L=buf.getChannelData(0);let peak=0,sum=0,nan=false;
      for(let i=0;i<L.length;i++){const v=L[i];if(v!==v||!isFinite(v)){nan=true;continue}const a=Math.abs(v);if(a>peak)peak=a;sum+=v*v}
      // rough per-250ms pitch contour from zero-crossings
      const win=Math.floor(.25*sr),contour=[];
      for(let s=0;s+win<=L.length;s+=win){let z=0,e=0;for(let i=s+1;i<s+win;i++){if((L[i-1]<0)!==(L[i]<0))z++;e+=L[i]*L[i]}contour.push({hz:Math.round(z/2/.25),rms:+Math.sqrt(e/win).toFixed(4)})}
      return {peak:+peak.toFixed(4),rms:+Math.sqrt(sum/L.length).toFixed(5),seconds:buf.duration,nan,contour};
    });
  }
  return api;
})();
