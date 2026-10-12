"""Desktop keyboard play, Esc pause/resume, and settings persistence across a browser restart (persistent profile).
The software renderer in this sandbox runs a few frames per second, so game time is driven with RoyalSumo.debug.advance
while the real keyboard is held down; wall-clock waits are only used to let the page process events."""
import tempfile, shutil
from common import *

LONE = "{map:'keep',fighters:4,seed:21,hazard:'off',difficulty:'rookie',owners:{1:'remote',2:'remote',3:'remote'}}"   # rivals stand still

def main():
    ok = True
    udir = tempfile.mkdtemp(prefix='rs_desk_')
    with sync_playwright() as p:
        g = PGame(p, udir, '', w=800, h=500, init=SEEN_HELP)
        g.ev("RoyalSumo.scenario(%s)" % LONE); g.wait(300)
        adv(g, 3.6)
        f = fighter(g)
        ok &= check('match reaches the fight phase', f['phase'] == 'fight', f['phase'])
        ok &= check('rivals standing still are remote-owned, the player is local', f['kind'] == 'local' and fighter(g, 1)['kind'] == 'remote', (f['kind'], fighter(g, 1)['kind']))
        ok &= check('desktop hint is visible, no touch buttons', g.ev("(()=>{const c=document.querySelector('.ct');return c.classList.contains('desk')&&!c.classList.contains('show')})()"))

        # WASD moves the player
        x0 = fighter(g)['x']
        g.page.keyboard.down('KeyD'); frames(g, 2); adv(g, 0.5)
        f = fighter(g); g.page.keyboard.up('KeyD'); frames(g, 2)
        ok &= check('holding D runs east', f['vx'] > 2.0 and f['x'] > x0 + 0.8, {'vx': round(f['vx'], 2), 'dx': round(f['x'] - x0, 2)})
        adv(g, 1.0)
        g.page.keyboard.down('ArrowUp'); frames(g, 2); adv(g, 0.4)
        f = fighter(g); g.page.keyboard.up('ArrowUp'); frames(g, 2)
        ok &= check('arrow up runs north (screen up = -z) for a single player', f['vz'] < -1.5, round(f['vz'], 2))
        adv(g, 1.0)

        # Space charges and releases a bash
        b0 = fighter(g)['bashes']
        g.page.keyboard.down('Space'); frames(g, 2); adv(g, 0.45)
        f = fighter(g); g.page.keyboard.up('Space'); frames(g, 2); adv(g, 0.4)
        b1 = fighter(g)['bashes']
        ok &= check('holding Space charges BASH', f['charging'] and f['charge'] > 0.4, round(f['charge'], 2))
        ok &= check('releasing Space strikes', b1 == b0 + 1, (b0, b1))
        adv(g, 1.2)
        # Shift dashes
        d0 = fighter(g)['dashes']
        g.page.keyboard.press('ShiftLeft'); frames(g, 2); adv(g, 0.3)
        d1 = fighter(g)['dashes']
        ok &= check('Shift dashes', d1 == d0 + 1, (d0, d1))

        # Esc pauses (sim time stops) and Esc resumes
        adv(g, 0.5)
        g.page.keyboard.press('Escape')
        paused = wait_js(g, "RoyalSumo.debug.stats().paused === true")
        resume_visible = g.ev("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Resume'&&b.offsetParent!==null)")
        t0 = fighter(g)['t']; frames(g, 3); t1 = fighter(g)['t']
        ok &= check('Esc opens the pause menu', paused is True and resume_visible, (paused, resume_visible))
        ok &= check('the simulation is frozen while paused', abs(t1 - t0) < 0.01, (round(t0, 3), round(t1, 3)))
        g.page.keyboard.press('Escape')
        paused = not wait_js(g, "RoyalSumo.debug.stats().paused === false")
        ok &= check('Esc again resumes (and does not toggle straight back)', paused is False, paused)
        frames(g, 4); paused = g.ev("RoyalSumo.debug.stats().paused")
        ok &= check('still running a few frames later', paused is False, paused)

        # Restart match from the pause menu starts a fresh round 1
        g.page.keyboard.press('Escape'); g.wait(300)
        g.page.get_by_role('button', name='Restart match').click(); g.wait(500)
        rd = g.ev("RoyalSumo.debug.sim().round")
        ok &= check('Restart match starts again at round 1', rd == 1, rd)

        # change a setting from the pause menu, and check it was stored
        g.page.keyboard.press('Escape'); g.wait(300)
        g.page.get_by_role('button', name='Settings').first.click(); g.wait(300)
        g.page.locator('button.tab', has_text='Graphics').click(); g.wait(200)
        g.page.locator('button.tog[aria-label="Show advanced options"]').click(); g.wait(200)
        g.ev("(()=>{const r=Array.from(document.querySelectorAll('.row')).find(r=>r.textContent.includes('Show FPS'));r.querySelector('button.tog').click()})()"); g.wait(300)
        stored = g.ev("JSON.parse(localStorage.getItem('royalSumo.v1')||'{}')")
        ok &= check('a toggled setting is written to storage', (stored.get('values') or {}).get('gfx.fps') is True, stored.get('values'))
        g.shot('desk_settings')
        ok &= check('console clean (desktop session)', not g.errors, g.errors[:3])
        # the game's own persistence code, every run: reload the page in the same browser and read the setting back
        g.page.reload(); g.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug')
        back = g.ev("RoyalSumo.debug.settings().get('gfx.fps')")
        ok &= check('settings are read back after a page reload', back is True, (back, g.ev("localStorage.getItem('royalSumo.v1')")))
        flushed = flush_close(g, udir, b'gfx.fps')

        # then a full browser restart on the same profile (needs Chromium to have flushed its own storage first)
        g = PGame(p, udir, '', w=800, h=500, init=SEEN_HELP)
        v = g.ev("JSON.parse(localStorage.getItem('royalSumo.v1')||'{}').values")
        if (v or {}).get('gfx.fps') is True: ok &= check('settings survive a browser restart', True, v)
        elif not flushed: print('SKIP settings survive a browser restart - Chromium never wrote the profile to disk within 30 s (browser/sandbox timing, not the game)')
        else: ok &= check('settings survive a browser restart', False, v)
        g.close()
    shutil.rmtree(udir, ignore_errors=True)
    print('DESK', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
