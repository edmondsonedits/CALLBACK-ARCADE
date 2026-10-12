"""Procedural audio, rendered offline: every SFX and every music track must be audible, finite and below clipping."""
from common import *
import json

def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, 'autostart=1&map=keep&fighters=4&seed=3&demo=1')
        g.wait(500)
        names = g.ev("RoyalSumo.debug.sound().names")
        ok &= check('sound effect list is not empty', len(names) >= 30, len(names))
        rows = g.page.evaluate("""async(names)=>{const S=RoyalSumo.debug.sound(),out={};for(const n of names){try{const r=await S.render(n,1.6,22050);out[n]=r}catch(e){out[n]={err:String(e)}}}return out}""", names)
        bad = {k: v for k, v in rows.items() if 'err' in v or v['nan'] or v['peak'] > 0.98 or v['rms'] < 1e-4}
        ok &= check('all %d sound effects render audible, finite, unclipped' % len(rows), not bad, bad)
        loud = max(rows.items(), key=lambda kv: kv[1].get('peak', 0)); quiet = min(rows.items(), key=lambda kv: kv[1].get('rms', 9))
        print('     loudest peak %s %.3f   quietest rms %s %.5f' % (loud[0], loud[1]['peak'], quiet[0], quiet[1]['rms']))
        maps = ['keep', 'floe', 'plaza', 'wharf', 'teeter', 'mesa']
        mus = g.page.evaluate("""async(maps)=>{const S=RoyalSumo.debug.sound(),out={};for(const m of maps){out[m]={};for(const it of [0,1]){try{out[m][it]=await S.renderMusic(m,8,22050,it)}catch(e){out[m][it]={err:String(e)}}}}return out}""", maps)
        badm = {}
        for m, d in mus.items():
            for it, v in d.items():
                if 'err' in v or v['nan'] or v['peak'] > 0.98 or v['rms'] < 1e-3: badm['%s/%s' % (m, it)] = v
        ok &= check('all 6 music tracks render (calm + intense) audible, finite, unclipped', not badm, badm)
        ok &= check('intense mix is louder than calm for every map', all(d['1']['rms'] >= d['0']['rms'] * 0.98 for d in mus.values()),
                    {m: (round(d['0']['rms'], 4), round(d['1']['rms'], 4)) for m, d in mus.items()})
        ok &= check('audio unlocks after a user gesture', (lambda: (g.page.mouse.click(40, 40), g.wait(300), g.ev("RoyalSumo.debug.sound().isReady()"))[2])(), '')
        ok &= check('console clean', not g.errors, g.errors[:3])
        g.close()
    print('AUDIO', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
