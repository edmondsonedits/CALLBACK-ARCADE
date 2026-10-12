"""Two local players on one keyboard: independent movement, independent BASH/DASH, names survive round changes."""
from common import *

def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, 'autostart=1&map=keep&fighters=4&seed=21&players=2&hazard=off', init=SEEN_HELP)
        g.wait(600)
        kinds = g.ev("RoyalSumo.debug.sim().fighters.map(f=>[f.name,f.kind])")
        ok &= check('seats 0 and 1 are local players named P1 / P2', kinds[0] == ['P1', 'local'] and kinds[1] == ['P2', 'local'] and kinds[2][1] == 'bot', kinds)
        # make the bots passive remote seats so only the humans move
        g.ev("[2,3].forEach(i=>RoyalSumo.multiplayer.setHumanSlot(i,true))")
        g.ev("RoyalSumo.debug.advance(3.5)")
        a0, b0 = fighter(g, 0), fighter(g, 1)
        g.page.keyboard.down('d'); g.page.keyboard.down('ArrowLeft'); frames(g, 4); adv(g, .6)
        a1, b1 = fighter(g, 0), fighter(g, 1)
        ok &= check('P1 (D) runs east', a1['vx'] > 2.5, a1)
        ok &= check('P2 (ArrowLeft) runs west', b1['vx'] < -2.5, b1)
        g.page.keyboard.up('d'); g.page.keyboard.up('ArrowLeft'); frames(g, 3); adv(g, .5)
        g.page.keyboard.down('Space'); frames(g, 4); adv(g, .4)
        s = fighter(g, 0); t = fighter(g, 1)
        ok &= check('Space charges only P1', s['charging'] and not t['charging'], (s['charge'], t['charge']))
        g.page.keyboard.up('Space'); frames(g, 3); adv(g, .1)
        g.page.keyboard.down('Enter'); frames(g, 4); adv(g, .4)
        s = fighter(g, 0); t = fighter(g, 1)
        ok &= check('Enter charges only P2', t['charging'] and not s['charging'], (s['charge'], t['charge']))
        g.page.keyboard.up('Enter'); frames(g, 3); adv(g, .6)
        ok &= check('bashes counted per player', fighter(g, 0)['bashes'] >= 1 and fighter(g, 1)['bashes'] >= 1, (fighter(g, 0)['bashes'], fighter(g, 1)['bashes']))
        # run a whole match; names must still be P1/P2 in a later round
        g.ev("RoyalSumo.debug.advance(40)")
        rd = g.ev("RoyalSumo.debug.sim().round")
        names = g.ev("RoyalSumo.debug.sim().fighters.slice(0,2).map(f=>f.name)")
        ok &= check('names persist into round %d' % rd, names == ['P1', 'P2'], names)
        badges = g.ev("Array.from(document.querySelectorAll('.bd-c')).slice(0,2).map(e=>e.textContent)")
        ok &= check('HUD badges say P1 / P2', badges == ['P1', 'P2'], badges)
        ok &= check('console clean', not g.errors, g.errors[:3])
        g.close()
    print('P2', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
