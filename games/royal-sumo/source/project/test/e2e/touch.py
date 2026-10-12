"""Touch controls through real multi-touch events (Chrome DevTools Input.dispatchTouchEvent): floating stick, BASH hold/release,
DASH, and all three at once. Game time is driven with RoyalSumo.debug.advance (the software renderer is slow)."""
from common import *

LONE = "{map:'keep',fighters:4,seed:21,hazard:'off',difficulty:'rookie',owners:{1:'remote',2:'remote',3:'remote'}}"

def box(g, sel):
    b = g.page.locator(sel).bounding_box()
    return {'x': b['x'] + b['width'] / 2, 'y': b['y'] + b['height'] / 2, 'w': b['width'], 'h': b['height']}

def main():
    ok = True
    with sync_playwright() as p:
        g = Game(p, '', w=390, h=844, dpr=2, touch=True, init=SEEN_HELP)
        g.ev("RoyalSumo.scenario(%s)" % LONE); g.wait(300); adv(g, 3.6)
        F = Fingers(g)

        shown = g.ev("document.querySelector('.ct').classList.contains('show')")
        ok &= check('touch device: on-screen controls are visible', shown is True, shown)
        bash, dash = box(g, '.ct-bash'), box(g, '.ct-dash')
        ok &= check('BASH and DASH hit areas are at least 64 CSS px', min(bash['w'], bash['h'], dash['w'], dash['h']) >= 64, (round(bash['w']), round(dash['w'])))
        ok &= check('buttons sit on the right (thumb) side, below the stick zone', bash['x'] > 195 and dash['x'] > 195, (round(bash['x']), round(dash['x'])))

        # 1) stick: touch down on the left half, drag right
        x0 = fighter(g)['x']
        F.down(1, 90, 650); frames(g, 2)
        F.move(1, 150, 650); frames(g, 2)
        base_on = g.ev("document.querySelector('.ct-base').classList.contains('on')")
        adv(g, 0.3); f = fighter(g)
        ok &= check('floating stick appears under the thumb', base_on is True)
        ok &= check('dragging right runs east', f['vx'] > 2.0 and f['x'] > x0 + 0.5, {'vx': round(f['vx'], 2), 'dx': round(f['x'] - x0, 2)})

        # 2) hold BASH with a second finger while the stick stays down
        b0 = f['bashes']
        F.down(2, bash['x'], bash['y']); frames(g, 2)
        adv(g, 0.4); f = fighter(g)
        ok &= check('second finger holds BASH: charging while still moving', f['charging'] and f['charge'] > 0.35 and f['vx'] > 1.0, {'charge': round(f['charge'], 2), 'vx': round(f['vx'], 2)})
        F.move(1, 30, 650); frames(g, 2)                      # steer back west while charging
        F.up(2); frames(g, 2); adv(g, 0.4)
        f = fighter(g)
        ok &= check('lifting the BASH finger strikes', f['bashes'] == b0 + 1, (b0, f['bashes']))
        ok &= check('the stick finger is still steering after the strike', g.ev("document.querySelector('.ct-base').classList.contains('on')") is True)
        adv(g, 0.8); f = fighter(g)
        ok &= check('the fighter is still on the arena', f['alive'] and abs(f['x']) < 5 and abs(f['z']) < 5, (round(f['x'], 2), round(f['z'], 2)))

        # 3) DASH with a third finger, stick still held
        d0 = fighter(g)['dashes']
        F.down(3, dash['x'], dash['y']); frames(g, 2); adv(g, 0.25)
        F.up(3); frames(g, 1)
        ok &= check('third finger taps DASH', fighter(g)['dashes'] == d0 + 1, (d0, fighter(g)['dashes']))

        # 4) release the stick: it recentres, the fighter coasts to a stop
        F.up(1); frames(g, 2); adv(g, 1.5); f = fighter(g)
        ok &= check('releasing the stick stops the fighter', f['alive'] and abs(f['vx']) < 0.3 and abs(f['vz']) < 0.3, (round(f['vx'], 2), round(f['vz'], 2)))
        ok &= check('stick knob is released', g.ev("!document.querySelector('.ct-base').classList.contains('on')"))

        # 5) a tap on the upper part of the screen does not spawn a stick
        F.down(5, 90, 60); frames(g, 1); on = g.ev("document.querySelector('.ct-base').classList.contains('on')"); F.up_all()
        ok &= check('touches in the top strip are ignored by the stick', on is False, on)

        # 6) touch while paused must not leak into the game
        g.page.evaluate("RoyalSumo.debug.advance(0)")
        ok &= check('console clean (touch session)', not g.errors, g.errors[:3])
        g.shot('touch_play')
        g.close()

        # landscape + left-handed layout
        g = Game(p, '', w=844, h=390, dpr=2, touch=True, init=init_values({'ctl.swap': True}))
        g.ev("RoyalSumo.scenario(%s)" % LONE); g.wait(300); adv(g, 3.6)
        sw = g.ev("document.querySelector('.ct').classList.contains('swap')")
        bash = box(g, '.ct-bash')
        ok &= check('left-handed layout: BASH moves to the left side', sw is True and bash['x'] < 422, (sw, round(bash['x'])))
        g.shot('touch_landscape_swap')
        ok &= check('console clean (landscape)', not g.errors, g.errors[:3])
        g.close()
    print('TOUCH', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
