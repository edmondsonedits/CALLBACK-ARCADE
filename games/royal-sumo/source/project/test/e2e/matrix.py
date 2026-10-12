"""Every map x three extreme rule sets: each match must play to a winner with finite physics and a clean console."""
from common import *
import math

VARIANTS = [
    ('duel-small-off',  dict(fighters=2, arena=.8, hazard='off', length='short', difficulty='rookie', winTarget=1)),
    ('crowd-wild-max',  dict(fighters=10, hazard='wild', speed=1.25, knockback=1.6, damage=1.8, dash='fast', difficulty='mixed', winTarget=1)),
    ('big-epic-legend', dict(fighters=6, hazard='mild', length='epic', dash='off', difficulty='legend', winTarget=1, arena=1.3)),
]
MAPS = ['keep', 'floe', 'plaza', 'wharf', 'teeter', 'mesa']

def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, 'autostart=1&map=keep&fighters=3&seed=1', init=SEEN_HELP)
        g.wait(800)
        n = 0
        for m in MAPS:
            for label, v in VARIANTS:
                n += 1
                spec = dict(v); spec['map'] = m; spec['seed'] = 1000 + n
                g.ev("o=>RoyalSumo.scenario(o)", spec)
                res = g.ev("""()=>{const s=RoyalSumo.debug.sim();let guard=0,bad=0;
                    while(s.phase!=='matchend'&&guard++<400){RoyalSumo.debug.advance(5);
                      for(const f of s.fighters){if(!isFinite(f.x)||!isFinite(f.z)||!isFinite(f.vx)||!isFinite(f.vz)||!isFinite(f.y)||!isFinite(f.stab))bad++}}
                    return {phase:s.phase,round:s.round,winner:s.matchWinner,n:s.n,t:+s.t.toFixed(1),bad,crowns:s.crowns.slice(0,s.n)}}""")
                good = res['phase'] == 'matchend' and res['bad'] == 0 and -1 <= res['winner'] < res['n']
                ok &= check('%-6s %-16s' % (m, label), good, res)
                # exercise the results screen for this match too
                g.ev("RoyalSumo.debug.showResults()")
                card = g.ev("!!document.querySelector('.rs-card')")
                ok &= check('   results screen builds', card)
        ok &= check('console clean after %d matches' % n, not g.errors, g.errors[:3])
        g.close()
    print('MATRIX', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
