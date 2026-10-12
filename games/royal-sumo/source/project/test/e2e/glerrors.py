"""GL hygiene: play every map through landing, brawl, hits, falls and the winner pose and require ZERO WebGL errors/warnings.
Also polls gl.getError() after every step so a failure names the map, moment and event that caused it."""
import sys
from common import *

HOOK = """()=>{const s=RoyalSumo.debug.sim();window.__ev=[];const od=s.drain.bind(s);s.drain=()=>{const e=od();for(const x of e)window.__ev.push(x);return e}}"""
MAPS = ['keep', 'floe', 'plaza', 'wharf', 'teeter', 'mesa']

def main():
    ok = True
    only = sys.argv[1:] or MAPS
    with sync_playwright() as p:
        g = Game(p, '', w=390, h=844, dpr=1, init=SEEN_HELP)
        ready(g)
        for mi, m in enumerate(only):
            n0 = len(g.errors)
            g.ev("o=>RoyalSumo.scenario(o)", dict(map=m, fighters=5, seed=40 + MAPS.index(m) * 7, hazard='normal', difficulty='hard'))
            g.ev(HOOK); frames(g, 2)
            if len(g.errors) > n0: ok &= check('%s: warning right after scenario()' % m, False, g.errors[n0:n0 + 2])
            seen = set(); steps = 0; first_bad = None
            while steps < int(os.environ.get("RS_GL_STEPS", "1500")):
                steps += 1
                g.ev("RoyalSumo.debug.advance(0.05)"); frames(g, 1)
                ev = g.ev("window.__ev.splice(0).map(x=>x.type+(x.tier?':'+x.tier:'')+(x.kind?'/'+x.kind:''))")
                for e in ev: seen.add(e)
                gl = g.ev("RoyalSumo.debug.renderer().gl.getError()")
                if (gl or len(g.errors) > n0) and first_bad is None:
                    first_bad = dict(step=steps, glError=gl, events=ev[-4:], phase=g.ev("RoyalSumo.debug.sim().phase"), msg=g.errors[n0:n0 + 1])
                    break
                if g.ev("RoyalSumo.debug.sim().phase") in ('matchend',) : break
            ok &= check('%s: no GL errors through %d steps (%d event kinds)' % (m, steps, len(seen)), first_bad is None, first_bad or '')
        ok &= check('console clean', not g.errors, g.errors[:3])
        g.close()
    print('GLERRORS', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
