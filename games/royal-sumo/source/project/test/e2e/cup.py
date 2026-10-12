"""Crown Cup, start to finish with one human: six arenas, points add up, standings and champion are consistent, results screen matches."""
from common import *

def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, '', init=init_values({'match.mode': 'cup', 'match.fighters': 4, 'match.hazard': 'mild', 'match.length': 'short'}))
        g.wait(500)
        g.page.locator('[data-primary="1"]:visible').first.click(); g.wait(700)
        g.page.locator('[data-primary="1"]:visible').first.click(); g.wait(900)
        c = g.ev("(()=>{const c=RoyalSumo.debug.cupState();return c?{n:c.order.length,stage:c.stage,order:c.order}:null})()")
        ok &= check('cup starts on stage 1 of 6', c and c['n'] == 6 and c['stage'] == 0, c)
        seeds = []; totals_prev = [0, 0, 0, 0]
        for stage in range(6):
            r = g.ev("""()=>{const s=RoyalSumo.debug.sim();let guard=0;while(s.phase!=='matchend'&&guard++<300)RoyalSumo.debug.advance(5);
                RoyalSumo.debug.showResults();
                const st=RoyalSumo.getState();return {phase:s.phase,seed:s.seed,map:s.map.id,winner:s.matchWinner,
                  title:(document.querySelector('.rs-h')||{}).textContent,
                  rows:Array.from(document.querySelectorAll('table.stats tr')).slice(1).map(r=>Array.from(r.children).map(c=>c.textContent)),
                  btn:Array.from(document.querySelectorAll('.rs-btns .btn')).map(b=>b.textContent)}}""")
            seeds.append(r['seed'])
            ok &= check('stage %d (%s) finished' % (stage + 1, r['map']), r['phase'] == 'matchend', (r['winner'], r['title']))
            rows = r['rows']
            tot = [int(x[2]) for x in rows]
            ok &= check('   standings table is sorted by cup points', tot == sorted(tot, reverse=True), tot)
            if stage < 5:
                ok &= check('   offers Next arena', any('Next arena' in b for b in r['btn']), r['btn'])
                g.ev("RoyalSumo.debug.control().nextStage()"); g.wait(300)
            else:
                ok &= check('   final: title names a champion', r['title'] and ('cup' in r['title'].lower()), r['title'])
                ok &= check('   final: offers New cup', any('New cup' in b for b in r['btn']), r['btn'])
                pts = g.ev("Array.from(document.querySelectorAll('.pod-c')).map(e=>({cls:e.className,pts:+e.querySelector('.pod-s').firstChild.textContent}))")
                first = [x for x in pts if 'p1' in x['cls'].split()]
                ok &= check('   podium 1st place has the most points', first and first[0]['pts'] == max(tot), (first, tot))
        ok &= check('six different stage seeds', len(set(seeds)) == 6, seeds)
        ok &= check('console clean through the whole cup', not g.errors, g.errors[:3])
        g.close()
    print('CUP', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
