"""Diagnostic: print fps / render scale / governor state every 2 s of a heavy autostart match."""
import sys
from common import *
INIT = "try{if(!localStorage.getItem('royalSumo.v1'))localStorage.setItem('royalSumo.v1',JSON.stringify({v:1,values:{},flags:{seenHelp:true}}))}catch(e){}"
with sync_playwright() as p:
    g = Game(p, 'autostart=1&map=keep&fighters=6&seed=3')
    g.ctx.add_init_script(INIT); g.page.reload(); g.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug')
    for i in range(int(sys.argv[1]) if len(sys.argv) > 1 else 10):
        g.wait(2000)
        s = g.ev("(()=>{const s=RoyalSumo.debug.stats();return {fps:+s.fps.toFixed(1),scale:+s.scale.toFixed(2),a:s.auto,w:document.getElementById('game').width,phase:s.phase,paused:s.paused,mode:s.mode}})()")
        print(i * 2 + 2, s)
    g.close()
