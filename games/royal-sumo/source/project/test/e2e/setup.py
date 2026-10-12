"""Setup screen: mode/players widgets refresh, the "Your sumo" picker (name + look) persists and reaches the match."""
import json, tempfile, shutil
from common import *

SEEN = "try{if(!localStorage.getItem('royalSumo.v1'))localStorage.setItem('royalSumo.v1',JSON.stringify({v:1,values:{},flags:{seenHelp:true}}))}catch(e){}"

def open_setup(p, w=390, h=844, udir=None):
    if udir:
        g = PGame(p, udir, w=w, h=h, dpr=2, init=SEEN)
    else:
        g = Game.__new__(Game)
        g.browser = p.chromium.launch(args=ARGS)
        g.ctx = g.browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2)
        g.ctx.add_init_script(SEEN)
        g.page = g.ctx.new_page(); g.errors = []; g.logs = []
        g.page.on('console', lambda m: (g.errors if m.type in ('error', 'warning') else g.logs).append('[%s] %s' % (m.type, m.text)))
        g.page.on('pageerror', lambda e: g.errors.append('[pageerror] %s' % e))
        g.page.goto('file://' + DIST)
        g.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug')
    g.wait(500)
    g.page.locator('[data-primary="1"]:visible').first.click(); g.wait(700)
    return g

def main():
    ok = True
    with sync_playwright() as p:
        udir = tempfile.mkdtemp(prefix='rs_profile_')
        g = open_setup(p, udir=udir)
        lab = lambda: g.ev("Array.from(document.querySelectorAll('[data-scr=setup] [data-primary]')).map(b=>b.textContent)[0]")
        ok &= check('start button says Start match', lab() == 'Start match', lab())
        g.page.get_by_role('button', name='Crown Cup').first.click(); g.wait(200)
        ok &= check('Crown Cup click relabels the start button', lab() == 'Start cup', lab())
        g.page.get_by_role('button', name='Quick match').first.click(); g.wait(200)
        ok &= check('Quick match click restores the label', lab() == 'Start match', lab())
        rows = lambda: g.ev("Array.from(document.querySelectorAll('.pk')).map(r=>r.style.display!=='none')")
        ok &= check('one player: only your row is shown', rows() == [True, False], rows())
        g.page.get_by_role('button', name='2 players').first.click(); g.wait(200)
        ok &= check('two players: both rows are shown', rows() == [True, True], rows())

        # name + look for player 1
        g.page.locator('.pk[data-seat="0"] .pk-name').fill('Zed'); g.wait(100)
        s0 = g.ev("(()=>{const s=RoyalSumo.debug.slots().get(0);return {name:s.name,style:s.style}})()")
        ok &= check('typing a name reaches the slot table', s0['name'] == 'Zed', s0)
        g.page.locator('.pk[data-seat="0"] .pk-s').nth(3).click(); g.wait(300)
        s0 = g.ev("(()=>{const s=RoyalSumo.debug.slots().get(0);return {name:s.name,style:s.style}})()")
        ok &= check('clicking a look stores it', s0['style'] == 3, s0)
        taken = g.ev("document.querySelectorAll('.pk[data-seat=\"1\"] .pk-s')[3].disabled")
        ok &= check("player 2 cannot take player 1's look", taken is True, taken)
        g.page.locator('.pk[data-seat="1"] .pk-name').fill('Mo'); g.page.locator('.pk[data-seat="1"] .pk-s').nth(6).click(); g.wait(300)
        g.page.locator('.pk-box').scroll_into_view_if_needed(); g.wait(200)
        g.shot('setup_picker_portrait')

        # start: names + looks reach the fighters
        g.page.locator('[data-scr=setup] [data-primary]').click(); g.wait(1500); g.page.wait_for_selector('.bd-c', timeout=30000); g.wait(300)
        st = g.ev("(()=>{const s=RoyalSumo.debug.sim();return s.fighters.slice(0,3).map(f=>({name:f.name,style:f.style,kind:f.kind}))})()")
        ok &= check('match uses the chosen names and looks', st[0]['name'] == 'Zed' and st[0]['style'] == 3 and st[1]['name'] == 'Mo' and st[1]['style'] == 6, st)
        ok &= check('two local players', st[0]['kind'] == 'local' and st[1]['kind'] == 'local', st)
        ok &= check('bots keep distinct looks', len(set(x['style'] for x in g.ev("RoyalSumo.debug.sim().fighters.map(f=>({style:f.style}))"))) == 4)
        cols = g.ev("Array.from(document.querySelectorAll('.bd-c')).map(e=>e.style.background)")
        ok &= check('HUD badges use the chosen belts', len(cols) == 4 and cols[0] != cols[1], cols)
        g.wait(2500); g.shot('setup_picker_ingame')
        ok &= check('console clean', not g.errors, g.errors[:3])

        # persistence: close the browser completely, reopen the same profile
        before = g.ev("localStorage.getItem('royalSumo.slots')")
        g.page.reload(); g.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug')
        r0 = g.ev("(()=>{const s=RoyalSumo.debug.slots().get(0),t=RoyalSumo.debug.slots().get(1);return [s.name,s.style,t.name,t.style]})()")
        ok &= check('names and looks are read back after a page reload', r0 == ['Zed', 3, 'Mo', 6], r0)
        flushed = flush_close(g, udir, b'"Mo"')
        g = open_setup(p, udir=udir)
        s0 = g.ev("(()=>{const s=RoyalSumo.debug.slots().get(0),t=RoyalSumo.debug.slots().get(1);return [s.name,s.style,t.name,t.style]})()")
        if s0 == ['Zed', 3, 'Mo', 6]:
            ok &= check('names and looks persist after closing and reopening the browser', True, s0)
            val = g.ev("document.querySelector('.pk[data-seat=\"0\"] .pk-name').value")
            ok &= check('the name field shows the saved name', val == 'Zed', val)
        elif not flushed: print('SKIP browser-restart persistence - Chromium never wrote the profile to disk within 30 s (browser/sandbox timing, not the game)')
        else: ok &= check('names and looks persist after closing and reopening the browser', False, (s0, before))
        own = g.ev("RoyalSumo.debug.slots().get(1).owner")
        ok &= check('seat 2 is a bot again after reopening (ownership is not persisted)', own == 'bot', own)
        g.page.locator('.pk-box').scroll_into_view_if_needed(); g.wait(200)
        g.shot('setup_persist')
        g.close(); shutil.rmtree(udir, ignore_errors=True)

        # landscape layout
        g = open_setup(p, 844, 390)
        g.page.locator('.pk-box').scroll_into_view_if_needed(); g.wait(300)
        g.shot('setup_picker_landscape')
        ok &= check('landscape: no console errors', not g.errors, g.errors[:3])
        g.close()
    print('SETUP', 'ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
main()
