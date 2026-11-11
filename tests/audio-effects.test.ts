import assert from "node:assert/strict";
import test from "node:test";
import { GameAudioEngine } from "../app/components/useHostAudio";

test("approved effects stay quiet, overlap up to five voices, and cap rapid bursts while fading", async () => {
  const saved = Object.fromEntries(["window","Audio","requestAnimationFrame","cancelAnimationFrame"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const frames = new Map<number,FrameRequestCallback>(); let frameId=0;
  const audios: FakeAudio[]=[];
  class FakeAudio {
    volume=1; muted=false; paused=true; currentTime=0; duration=.95;
    constructor(public src:string){audios.push(this);}
    addEventListener(){} play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}
  }
  const parameter={value:0,setTargetAtTime(){}};
  class FakeContext {
    currentTime=0;
    createGain(){return {gain:{...parameter},connect(){}};}
    createDynamicsCompressor(){return {threshold:{...parameter},knee:{...parameter},ratio:{...parameter},attack:{...parameter},release:{...parameter},connect(){}};}
    close(){return Promise.resolve();}
  }
  Object.assign(globalThis,{window:{AudioContext:FakeContext},Audio:FakeAudio,requestAnimationFrame:(callback:FrameRequestCallback)=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:(id:number)=>frames.delete(id)});
  const flush=(time:number)=>{const current=[...frames.values()];frames.clear();current.forEach(callback=>callback(time));};
  try {
    const engine=new GameAudioEngine();
    for(let index=0;index<5;index++) assert.equal(engine.playApprovedEffect("join"),true);
    assert.ok(audios.every(audio=>audio.volume===0));
    await Promise.resolve(); flush(performance.now()+80);
    assert.equal(audios.filter(audio=>!audio.paused).length,5);
    assert.ok(audios.every(audio=>audio.volume>0 && audio.volume<.1));
    for(let index=0;index<30;index++) engine.playApprovedEffect("join");
    assert.ok(audios.filter(audio=>!audio.paused).length<=5,"rapid effects must remain bounded while older effects fade");
    engine.destroy();
    assert.ok(audios.every(audio=>audio.paused));
  } finally {
    for(const [key,descriptor] of Object.entries(saved)) { if(descriptor) Object.defineProperty(globalThis,key,descriptor); else Reflect.deleteProperty(globalThis,key); }
  }
});
