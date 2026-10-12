"""Regression tests for the reported v1.2 bugs. They use only the public RoyalSumo API (+ debug hooks that exist in v1.2),
so the SAME file can be run against the old build (to see the bugs) and the new build (to see the fixes):
    RS_HTML=/path/to/royal_sumo_crownfall_v1.2.html python3 regress.py"""
import json
from common import *

def init_script(values=None):
    return "try{if(!localStorage.getItem('royalSumo.v1'))localStorage.setItem('royalSumo.v1',JSON.stringify({v:1,values:%s,flags:{seenHelp:true}}))}catch(e){}" % json.dumps(values or {})

def boot(p, query='', values=None, **kw):
    g = Game.__new__(Game)
    g.browser = p.chromium.launch(args=ARGS)
    g.ctx = g.browser.new_context(viewport={'width': kw.get('w', 390), 'height': kw.get('h', 844)})
    g.ctx.add_init_script(init_script(values))
    g.page = g.ctx.new_page(); g.errors = []; g.logs = []
    g.page.on('console', lambda m: (g.errors if m.type in ('error', 'warning') else g.logs).append('[%s] %s' % (m.type, m.text)))
    g.page.on('pageerror', lambda e: g.errors.append('[pageerror] %s' % e))
    g.page.goto('file://' + DIST + ('?' + query if query else ''))
    g.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug')
    return g

def main():
    ok = True
    with sync_playwright() as p:
        # ------------------------------------------------------------- A/B/C: slot ownership, names, persistence
        g = boot(p)
        g.ev("RoyalSumo.scenario({map:'keep',fighters:4,seed:5,hazard:'off'})")
        g.ev("RoyalSumo.debug.advance(4)")
        k0 = g.ev("RoyalSumo.multiplayer.getSlots()[2].kind")
        ok &= check('slot 2 starts as a bot', k0 == 'bot', k0)
        g.ev("RoyalSumo.multiplayer.setHumanSlot(2,true)")
        k1 = g.ev("RoyalSumo.multiplayer.getSlots()[2].kind")
        ok &= check('setHumanSlot(2,true) changes the fighter owner', k1 != 'bot', k1)
        # drive slot 2 east for 0.6s, re-submitting like a network client would
        g.ev("window.__x0=RoyalSumo.debug.sim().fighters[2].x")
        g.ev("for(let i=0;i<6;i++){RoyalSumo.multiplayer.submitInput(2,{mx:1,mz:0,bashDown:false});RoyalSumo.debug.advance(0.1)}")
        v = g.ev("(()=>{const f=RoyalSumo.debug.sim().fighters[2];return {vx:f.vx,vz:f.vz,dx:f.x-window.__x0}})()")
        ok &= check('external input actually drives the human-owned fighter', v['vx'] > 2.0 and abs(v['vz']) < 1.0 and v['dx'] > 0.8, v)
        g.ev("RoyalSumo.multiplayer.setPlayerName(2,'ZED')")
        g.ev("RoyalSumo.restart()")
        g.ev("RoyalSumo.debug.advance(0.5)")
        s = g.ev("RoyalSumo.multiplayer.getSlots()[2]")
        ok &= check('ownership survives restart()', s['kind'] != 'bot', s)
        ok &= check('player name survives restart()', s['name'] == 'ZED', s['name'])
        g.ev("RoyalSumo.multiplayer.setHumanSlot(2,false)")
        k2 = g.ev("RoyalSumo.multiplayer.getSlots()[2].kind")
        ok &= check('setHumanSlot(2,false) hands the fighter back to the AI', k2 == 'bot', k2)
        g.close()

        # ------------------------------------------------------------- D: seeds
        g = boot(p)
        st = g.ev("RoyalSumo.scenario({map:'floe',fighters:4,seed:1234,hazard:'off'})")
        ok &= check('scenario({seed}) reaches the sim', st['seed'] == 1234, st['seed'])
        g.ev("RoyalSumo.debug.advance(6)"); a = g.ev("JSON.stringify(RoyalSumo.getState().fighters)")
        g.ev("RoyalSumo.restart()")
        st2 = g.ev("RoyalSumo.getState()")
        ok &= check('restart() replays the same seed', st2['seed'] == 1234, st2['seed'])
        g.ev("RoyalSumo.debug.advance(6)"); b = g.ev("JSON.stringify(RoyalSumo.getState().fighters)")
        ok &= check('restart() replays an identical match', a == b)
        st3 = g.ev("RoyalSumo.restart({seed:99})")
        seed3 = g.ev("RoyalSumo.getState().seed")
        ok &= check('restart({seed}) takes an explicit seed', seed3 == 99, seed3)
        g.close()
        g = boot(p, 'seed=777')
        g.ev("RoyalSumo.scenario({map:'keep',fighters:3,seed:4242})")
        seed4 = g.ev("RoyalSumo.getState().seed")
        ok &= check('API seed beats the URL seed', seed4 == 4242, seed4)
        g.close()

        # ------------------------------------------------------------- E: Crown Cup final podium order
        g = boot(p, values={'match.mode': 'cup', 'match.fighters': 4})
        g.wait(600)
        g.page.locator('[data-primary="1"]:visible').first.click(); g.page.wait_for_timeout(700)   # title: PLAY
        g.page.locator('[data-primary="1"]:visible').first.click(); g.page.wait_for_timeout(900)   # setup: START CUP
        cup = g.ev("(()=>{const c=RoyalSumo.debug.cupState();return c?{stage:c.stage,n:c.order.length}:null})()")
        ok &= check('cup is running', cup is not None, cup)
        # fabricate the last arena: fighter 0 leads on points, fighter 3 wins the final arena
        g.ev("""(()=>{const c=RoyalSumo.debug.cupState(),s=RoyalSumo.debug.sim();
            c.stage=c.order.length-1;c.counted=c.stage;c.total=[10,4,2,4];c.wins=[2,1,0,1];s.matchWinner=3;RoyalSumo.debug.showResults()})()""")
        g.wait(400)
        pod = g.ev("Array.from(document.querySelectorAll('.pod-c')).map(e=>({cls:e.className,name:(e.querySelector('.pod-n')||{}).textContent,pts:(e.querySelector('.pod-s')||{}).firstChild&&e.querySelector('.pod-s').firstChild.textContent}))")
        title = g.ev("(document.querySelector('.rs-h')||{}).textContent")
        first = [x for x in pod if 'p1' in x['cls'].split()]
        ok &= check('podium has three places', len(pod) == 3, pod)
        ok &= check('cup title names the points leader', title and 'cup' in title.lower(), title)
        ok &= check('podium 1st place is the points leader (YOU, 10 pts)', first and first[0]['pts'] == '10', first)
        g.shot('regress_cup_podium')
        g.close()

        # ------------------------------------------------------------- F: auto quality reacts, can be switched off, and recovers
        g = boot(p, 'autostart=1&map=keep&fighters=6&seed=3')
        g.wait(1500)
        w0 = g.ev("document.getElementById('game').width")
        changes = 0; w1 = w0
        for _ in range(30):                                   # the software renderer here runs at a few fps, so Auto Quality must step down
            g.wait(1000)
            changes = g.ev("RoyalSumo.debug.governor().changes")
            if changes >= 1: break
        w1 = g.ev("document.getElementById('game').width"); k1 = g.ev("RoyalSumo.debug.governor().k")
        ok &= check('auto quality steps down under sustained low fps and the canvas really shrinks', changes >= 1 and w1 < w0 * 0.97, {'w0': w0, 'w1': w1, 'k': k1, 'changes': changes})
        g.ev("RoyalSumo.debug.settings().set('gfx.auto', false)"); g.wait(600)
        w2 = g.ev("document.getElementById('game').width"); en = g.ev("RoyalSumo.debug.governor().enabled")
        ok &= check('switching Auto Quality off restores full resolution at once', (not en) and w2 == w0, {'w0': w0, 'w2': w2, 'enabled': en})
        g.ev("RoyalSumo.debug.settings().set('gfx.auto', true)"); g.wait(600)
        en2 = g.ev("RoyalSumo.debug.governor().enabled"); w3 = g.ev("document.getElementById('game').width")
        ok &= check('switching it back on starts again from full resolution', en2 and w3 == w0, {'w3': w3, 'enabled': en2})
        g.close()
    print('REGRESS', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
