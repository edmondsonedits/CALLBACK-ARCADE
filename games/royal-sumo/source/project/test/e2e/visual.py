"""High-resolution visual review: every map in five moments (landing, countdown, brawl, heavy hit, fall, winner) at 2x DPR.
Writes test/shots/visual/<map>_<moment>.png and a contact sheet per orientation. Look at them: this is a human-eyes test."""
from common import *
from PIL import Image
import sys
VIS = os.path.join(SHOTS, 'visual'); os.makedirs(VIS, exist_ok=True)
MAPS = ['keep', 'floe', 'plaza', 'wharf', 'teeter', 'mesa']

HOOK = """()=>{const s=RoyalSumo.debug.sim();window.__ev=[];const od=s.drain.bind(s);s.drain=()=>{const e=od();for(const x of e)window.__ev.push(x);return e};
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
  document.getElementById('ui').style.visibility='hidden'}"""

def settle(g, n=4): frames(g, n)

def run(p, w, h, tag, seed0):
    tiles = {}
    g = Game(p, '', w=w, h=h, dpr=2, init=SEEN_HELP)
    for mi, m in enumerate(MAPS):
        g.ev("o=>RoyalSumo.scenario(o)", dict(map=m, fighters=5, seed=seed0 + mi * 7, hazard='normal', difficulty='hard'))
        g.ev(HOOK)
        names = {}
        def grab(label):
            settle(g, 5); path = os.path.join(VIS, '%s_%s_%s.png' % (m, tag, label)); g.page.screenshot(path=path); names[label] = path
        g.ev("RoyalSumo.debug.advance(0.45)"); grab('1landing')
        g.ev("RoyalSumo.debug.advance(1.9)"); grab('2countdown')
        # fight: step until a heavy/critical hit, a fall, and the round end, grabbing each once
        got = set(); steps = 0
        while steps < 1500 and len(got) < 4:
            steps += 1
            g.ev("RoyalSumo.debug.advance(0.05)")
            ev = g.ev("(()=>{const e=window.__ev.splice(0);return e.map(x=>({t:x.type,tier:x.tier,id:x.id}))})()")
            st = g.ev("RoyalSumo.debug.sim().phase")
            if 'brawl' not in got and steps == 220: grab('3brawl'); got.add('brawl')
            if 'hit' not in got and any(e['t'] == 'hit' and e['tier'] in ('heavy', 'critical') for e in ev):
                g.ev("RoyalSumo.debug.advance(0.07)"); grab('4hit'); got.add('hit')
            if 'fall' not in got and any(e['t'] == 'fall' for e in ev):
                g.ev("RoyalSumo.debug.advance(0.35)"); grab('5fall'); got.add('fall')
            if 'win' not in got and st in ('roundend', 'matchend'):
                g.ev("RoyalSumo.debug.advance(1.3)"); grab('6win'); got.add('win')
        print('  %-6s %s captured: %s (%d steps)' % (m, tag, sorted(got), steps))
        tiles[m] = names
    ok = not g.errors
    print('  console %s' % ('clean' if ok else g.errors[:3]))
    g.close()
    # contact sheet
    labels = ['1landing', '2countdown', '3brawl', '4hit', '5fall', '6win']
    tw = 300 if w < h else 520
    sample = Image.open(next(iter(tiles.values()))['1landing']); th = int(tw * sample.height / sample.width)
    sheet = Image.new('RGB', (tw * len(labels), th * len(MAPS)), (20, 10, 40))
    for r, m in enumerate(MAPS):
        for c, lb in enumerate(labels):
            if lb in tiles[m]: sheet.paste(Image.open(tiles[m][lb]).convert('RGB').resize((tw, th), Image.LANCZOS), (c * tw, r * th))
    out = os.path.join(SHOTS, 'visual_sheet_%s.png' % tag); sheet.save(out); print('  sheet ->', out)
    return ok

def main():
    ok = True
    with sync_playwright() as p:
        ok &= run(p, 390, 844, 'portrait', 40)
        if '--landscape' in sys.argv: ok &= run(p, 844, 390, 'landscape', 90)
    print('VISUAL', 'CAPTURED' if ok else 'ERRORS'); sys.exit(0 if ok else 1)
main()
