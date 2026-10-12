/* ============================================================================
   ROYAL SUMO - AUTO QUALITY GOVERNOR  (pure: frame times in, render-scale multiplier out)
   Lowers the render resolution in small steps when the game really is slow, and raises it again when there is
   headroom. Designed to be boring:
     * only frames of an ACTIVE match count (not menus, pauses, hidden tabs, or the first moments after resuming)
     * the display refresh rate is not a performance problem: a step down that does not help is undone, and the
       governor then waits (with exponential back-off) before it tries again
     * stepping back up is gated by a long healthy streak, and a failed attempt blocks the next one for a while
     * turning Auto off returns to full resolution immediately
   `update(dt, active)` returns the new multiplier when it changed, otherwise null.
   ========================================================================== */
const r2=v=>Math.round(v*100)/100;

export class QualityGovernor{
  constructor(o={}){
    this.min=o.min===undefined?.6:o.min;this.max=o.max===undefined?1:o.max;this.step=o.step||.1;
    this.lowFps=o.lowFps||38;this.highFps=o.highFps||56;
    this.win=o.win||.5;this.downWins=o.downWins||4;this.upWins=o.upWins||12;
    this.settle=o.settle===undefined?.8:o.settle;this.maxDt=o.maxDt||1;
    this.hitch=o.hitch||.2;                 // a single long frame counts as at most this many seconds
    this.enabled=o.enabled!==false;
    this.reset();
  }
  reset(){
    this.k=this.max;this.t=0;this.acc=0;this.frames=0;this.low=0;this.good=0;this.settleLeft=this.settle;
    this.fps=0;this.blockDown=0;this.blockUp=0;this.downBackoff=60;this.upBackoff=30;this.probe=null;this.probeUp=null;
    this.changes=0;
  }
  /** Turn the governor on or off. Off means full resolution, immediately. Returns true if the multiplier changed. */
  setEnabled(on){
    on=!!on;if(on===this.enabled)return false;
    this.enabled=on;const was=this.k;this.reset();return was!==this.k;
  }
  _interrupt(){this.acc=0;this.frames=0;this.low=0;this.good=0;this.settleLeft=this.settle;this.probe=null;this.probeUp=null}
  _move(k){k=Math.max(this.min,Math.min(this.max,r2(k)));if(k===this.k)return null;this.k=k;this.changes++;this.acc=0;this.frames=0;this.low=0;this.good=0;this.settleLeft=this.settle;return k}
  update(dt,active){
    if(!this.enabled)return null;
    if(!active||!(dt>0)||dt>this.maxDt){this._interrupt();return null}
    this.t+=dt;
    if(this.settleLeft>0){this.settleLeft-=dt;return null}
    this.acc+=Math.min(dt,this.hitch);this.frames++;
    if(this.acc<this.win)return null;
    const fps=this.frames/this.acc;this.fps=fps;this.acc=0;this.frames=0;
    // ---- judge the result of the last step down: did it actually help?
    if(this.probe){
      const p=this.probe;p.got.push(fps);
      if(p.got.length>=2){
        const after=(p.got[0]+p.got[1])/2;this.probe=null;
        if(after<p.before*1.06&&after<this.lowFps){          // no real gain: the limit is not pixels (refresh cap, CPU, ...)
          this.blockDown=this.t+this.downBackoff;this.downBackoff=Math.min(this.downBackoff*2,960);
          return this._move(p.from);
        }
        this.downBackoff=60;
      }
      return null;
    }
    // ---- judge a recent step up: did it hold?
    if(this.probeUp){
      if(fps<this.lowFps){const from=this.probeUp.from;this.probeUp=null;this.blockUp=this.t+this.upBackoff;this.upBackoff=Math.min(this.upBackoff*2,480);return this._move(from)}
      if(this.t>=this.probeUp.until){this.probeUp=null;this.upBackoff=30}
    }
    if(fps<this.lowFps){this.low++;this.good=0}
    else if(fps>=this.highFps){this.good++;this.low=0}
    else{this.low=0;this.good=0}
    if(this.low>=this.downWins&&this.k>this.min+1e-9&&this.t>=this.blockDown){
      const from=this.k,before=fps,k=this._move(from-this.step);
      if(k!==null)this.probe={from,before,got:[]};
      return k;
    }
    if(this.good>=this.upWins&&this.k<this.max-1e-9&&this.t>=this.blockUp){
      const from=this.k,k=this._move(from+this.step);
      if(k!==null)this.probeUp={from,until:this.t+6};
      return k;
    }
    return null;
  }
  info(){return {enabled:this.enabled,k:this.k,fps:+this.fps.toFixed(1),changes:this.changes,blockedDown:this.t<this.blockDown,blockedUp:this.t<this.blockUp}}
}
