"""Robustness: WebGL context loss + restore (repeatedly), GL object / JS heap leaks across many matches, hidden-tab auto-pause, and a JS CPU profile."""
from common import *
import io, time
from PIL import Image, ImageStat

INSTR = """
(()=>{const P=WebGL2RenderingContext.prototype;window.__gl={live:{},made:{}};
 for(const [c,d,k] of [['createTexture','deleteTexture','tex'],['createBuffer','deleteBuffer','buf'],['createVertexArray','deleteVertexArray','vao'],['createProgram','deleteProgram','prog'],['createFramebuffer','deleteFramebuffer','fbo'],['createRenderbuffer','deleteRenderbuffer','rbo']]){
   const oc=P[c],od=P[d];
   P[c]=function(){const o=oc.apply(this,arguments);if(o){__gl.live[k]=(__gl.live[k]||0)+1;__gl.made[k]=(__gl.made[k]||0)+1}return o};
   P[d]=function(o){if(o)__gl.live[k]=(__gl.live[k]||0)-1;return od.apply(this,arguments)};
 }
 window.__lst={lost:0,rest:0};
 const oa=HTMLCanvasElement.prototype.addEventListener,orm=HTMLCanvasElement.prototype.removeEventListener;
 HTMLCanvasElement.prototype.addEventListener=function(t,f,o){if(t==='webglcontextlost')__lst.lost++;if(t==='webglcontextrestored')__lst.rest++;return oa.call(this,t,f,o)};
 HTMLCanvasElement.prototype.removeEventListener=function(t,f,o){if(t==='webglcontextlost')__lst.lost--;if(t==='webglcontextrestored')__lst.rest--;return orm.call(this,t,f,o)};
})();"""

def heap_mb(g, cdp):
    cdp.send('HeapProfiler.collectGarbage'); cdp.send('HeapProfiler.collectGarbage')
    return cdp.send('Runtime.getHeapUsage')['usedSize'] / 1048576.0

def blankness(g):
    im = Image.open(io.BytesIO(g.page.screenshot())).convert('RGB')
    return ImageStat.Stat(im).stddev, im

def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, 'autostart=1&map=keep&fighters=4&seed=7', init=INSTR + SEEN_HELP)
        g.wait(1500)
        ok &= check('baseline: exactly one pair of context listeners', g.ev("[__lst.lost,__lst.rest]") == [1, 1], g.ev("__lst"))
        # ------------------------------------------------ A. context loss / restore, three times
        for cycle in range(1, 4):
            g.ev("window.__ext=document.getElementById('game').getContext('webgl2').getExtension('WEBGL_lose_context');__ext.loseContext()")
            g.wait(400)
            lost = g.ev("RoyalSumo.debug.renderer().lost")
            g.ev("__ext.restoreContext()")
            deadline = time.time() + 20; back = False
            while time.time() < deadline:
                g.wait(250)
                if g.ev("!RoyalSumo.debug.renderer().lost") and cycle >= 1:
                    back = True; break
            g.wait(1500)
            d0 = g.ev("RoyalSumo.debug.stats().draws")
            ok &= check('cycle %d: context was lost, then came back' % cycle, lost and back, (lost, back))
            ok &= check('cycle %d: drawing again after restore' % cycle, d0 > 0, d0)
            ok &= check('cycle %d: still exactly one listener pair (no pile-up)' % cycle, g.ev("[__lst.lost,__lst.rest]") == [1, 1], g.ev("__lst"))
        sd, im = blankness(g)
        ok &= check('picture is alive after three restores (not blank)', max(sd) > 25, [round(x, 1) for x in sd])
        im.save(os.path.join(SHOTS, 'robust_after_restore.png'))
        sim_ok = g.ev("(()=>{const s=RoyalSumo.debug.sim();return s&&s.fighters.length>0&&isFinite(s.fighters[0].x)})()")
        ok &= check('simulation survived the restores', sim_ok)
        bad = [e for e in g.errors if 'CONTEXT_LOST' not in e and 'context lost' not in e.lower() and 'Context Lost' not in e]
        ok &= check('no errors besides expected context-lost notices', not bad, bad[:4])
        if g.errors: print('     (console during context loss: %d message(s), e.g. %s)' % (len(g.errors), g.errors[0][:110]))
        g.errors.clear()
        # ------------------------------------------------ B. leaks across many matches
        cdp = g.ctx.new_cdp_session(g.page); cdp.send('HeapProfiler.enable')
        maps = ['keep', 'floe', 'plaza', 'wharf', 'teeter', 'mesa']
        def play(k):
            g.ev("o=>{RoyalSumo.scenario(o);RoyalSumo.debug.advance(4)}", dict(map=maps[k % 6], fighters=4 + (k % 5), seed=500 + k, hazard='wild'))
        for k in range(6): play(k)                      # warm up: every scene built once
        L1 = g.ev("JSON.parse(JSON.stringify(__gl.live))"); H1 = heap_mb(g, cdp)
        for k in range(6, 24): play(k)
        L2 = g.ev("JSON.parse(JSON.stringify(__gl.live))"); H2 = heap_mb(g, cdp)
        growth = {k: L2.get(k, 0) - L1.get(k, 0) for k in set(L1) | set(L2)}
        ok &= check('GL objects do not grow over 18 more matches', all(v <= 2 for v in growth.values()), {'before': L1, 'after': L2})
        ok &= check('JS heap does not grow (< 6 MB over 18 matches)', H2 - H1 < 6, '%.1f -> %.1f MB' % (H1, H2))
        # ------------------------------------------------ C. hidden tab pauses the match
        g.ev("o=>RoyalSumo.scenario(o)", dict(map='keep', fighters=4, seed=9)); g.wait(300)
        g.ev("(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})()")
        g.wait(200)
        ok &= check('switching tabs pauses the game', g.ev("RoyalSumo.debug.stats().paused") is True)
        t1 = g.ev("RoyalSumo.debug.sim().t"); g.wait(500); t2 = g.ev("RoyalSumo.debug.sim().t")
        ok &= check('the simulation is frozen while hidden', abs(t2 - t1) < 1e-6, (t1, t2))
        ok &= check('console clean (leak + visibility part)', not g.errors, g.errors[:3])
        g.close()

        # ------------------------------------------------ D. CPU profile of a live 6-fighter match (informational)
        g = Game(p, 'autostart=1&map=plaza&fighters=6&seed=5&hazard=wild', init=SEEN_HELP)
        g.wait(1000)
        cdp = g.ctx.new_cdp_session(g.page); cdp.send('Profiler.enable'); cdp.send('Profiler.start')
        g.wait(8000)
        prof = cdp.send('Profiler.stop')['profile']
        nodes = {n['id']: n for n in prof['nodes']}; selfus = {}
        for nid, dt in zip(prof['samples'], prof['timeDeltas']):
            n = nodes[nid]['callFrame']; key = '%s %s:%s' % (n['functionName'] or '(anon)', os.path.basename(n['url']) or '-', n['lineNumber'])
            selfus[key] = selfus.get(key, 0) + dt
        tot = sum(selfus.values()) or 1
        print('     CPU profile, 8 s of a 6-fighter wild plaza match (software GL, so GL calls dominate):')
        for k, v in sorted(selfus.items(), key=lambda kv: -kv[1])[:8]: print('       %5.1f%%  %s' % (100.0 * v / tot, k))
        idle = sum(v for k, v in selfus.items() if k.startswith('(idle)') or k.startswith('(program)'))
        print('       (idle+program %.0f%% of samples)' % (100.0 * idle / tot))
        g.close()
    print('ROBUST', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
