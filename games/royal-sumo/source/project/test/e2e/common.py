"""Shared helpers for the browser (Playwright + SwiftShader) tests. Run with: python3 test/e2e/<name>.py"""
import os, sys, json, time
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DIST = os.environ.get('RS_HTML') or os.path.join(ROOT, 'dist', 'index.html')
ARGS = ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
SHOTS = os.path.join(ROOT, 'test', 'shots'); os.makedirs(SHOTS, exist_ok=True)

class Game:
    """One page with console capture. `errors` collects console errors/warnings and uncaught exceptions."""
    def __init__(self, p, query='', w=390, h=844, dpr=1, touch=False, extra_args=(), init=None):
        self.browser = p.chromium.launch(args=ARGS + list(extra_args))
        self.ctx = self.browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=touch, is_mobile=touch)
        if init: self.ctx.add_init_script(init)
        self.page = self.ctx.new_page()
        self.errors = []; self.logs = []
        self.page.on('console', lambda m: (self.errors if m.type in ('error', 'warning') else self.logs).append('[%s] %s' % (m.type, m.text)))
        self.page.on('pageerror', lambda e: self.errors.append('[pageerror] %s' % e))
        self.page.goto('file://' + DIST + ('?' + query if query else ''))
        self.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug', timeout=30000)
    def ev(self, js, arg=None):
        return self.page.evaluate(js, arg) if arg is not None else self.page.evaluate(js)
    def wait(self, ms): self.page.wait_for_timeout(ms)
    def shot(self, name): 
        path = os.path.join(SHOTS, name + '.png'); self.page.screenshot(path=path); return path
    def close(self):
        self.ctx.close(); self.browser.close()

SEEN_HELP = "try{if(!localStorage.getItem('royalSumo.v1'))localStorage.setItem('royalSumo.v1',JSON.stringify({v:1,values:{},flags:{seenHelp:true}}))}catch(e){}"

def init_values(values=None, flags=None):
    """init script that seeds the settings blob once (never overwrites what the game saved itself)"""
    return ("try{if(!localStorage.getItem('royalSumo.v1'))localStorage.setItem('royalSumo.v1',JSON.stringify({v:1,values:%s,flags:%s}))}catch(e){}"
            % (json.dumps(values or {}), json.dumps(flags if flags is not None else {'seenHelp': True})))

class PGame(Game):
    """Like Game, but in a persistent browser profile (a real on-disk localStorage that survives close + reopen)."""
    def __init__(self, p, udir, query='', w=390, h=844, dpr=1, touch=False, init=None, extra_args=()):
        self.browser = None
        self.ctx = p.chromium.launch_persistent_context(udir, args=ARGS + list(extra_args), viewport={'width': w, 'height': h},
                                                        device_scale_factor=dpr, has_touch=touch, is_mobile=touch)
        if init: self.ctx.add_init_script(init)
        self.page = self.ctx.pages[0] if self.ctx.pages else self.ctx.new_page()
        self.errors = []; self.logs = []
        self.page.on('console', lambda m: (self.errors if m.type in ('error', 'warning') else self.logs).append('[%s] %s' % (m.type, m.text)))
        self.page.on('pageerror', lambda e: self.errors.append('[pageerror] %s' % e))
        self.page.goto('file://' + DIST + ('?' + query if query else ''))
        self.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug')
    def close(self): self.ctx.close()

def frames(g, n=2):
    """wait for n animation frames (the headless software renderer is slow, so wall-clock waits are unreliable)"""
    g.page.evaluate("n=>new Promise(r=>{let k=0;(function f(){if(++k>=n)r();else requestAnimationFrame(f)})()})", n)

def adv(g, sec):
    """advance the simulation by sec seconds of game time, routing input exactly like the live loop"""
    g.page.evaluate("s=>RoyalSumo.debug.advance(s)", sec)

def fighter(g, i=0):
    return g.page.evaluate("i=>{const f=RoyalSumo.debug.sim().fighters[i],s=RoyalSumo.debug.sim();return {x:f.x,z:f.z,vx:f.vx,vz:f.vz,charge:f.charge,charging:f.charging,state:f.state,stab:f.stab,alive:f.alive,kind:f.kind,"
                           "bashes:s.stats[i].bashes||0,dashes:s.stats[i].dashes||0,name:f.name,style:f.style,t:s.t,phase:s.phase}}", i)

def persisted(udir, needle):
    """True once `needle` (bytes) is on disk in the profile's localStorage store (leveldb .log/.ldb files)."""
    import glob
    for f in glob.glob(os.path.join(udir, '**', 'Local Storage', 'leveldb', '*'), recursive=True):
        try:
            if needle in open(f, 'rb').read(): return True
        except OSError: pass
    return False

def flush_close(g, udir=None, needle=None, settle_ms=6500):
    """Close a persistent profile the way a user would. Chromium commits localStorage to disk in batches, so instead of a blind sleep
    wait until `needle` is really in the profile on disk (falls back to a fixed wait when no needle is given)."""
    try: g.page.goto('about:blank')
    except Exception: pass
    flushed = True
    if udir and needle:
        for _ in range(120):
            if persisted(udir, needle): break
            g.wait(250)
        else:
            flushed = False; print('WARN: %r never reached the profile on disk (the browser did not flush its storage in time)' % needle)
        g.wait(300)
    else:
        g.wait(settle_ms)
    g.close()
    return flushed

def wait_js(g, expr, timeout=8000):
    """Poll a JS expression until it is truthy (slow software-GL frames make fixed sleeps flaky). Returns its last value."""
    try: g.page.wait_for_function(expr, timeout=timeout)
    except Exception: pass
    return g.ev(expr)

class Fingers:
    """Multi-touch through CDP Input.dispatchTouchEvent. Same convention as Puppeteer: each call names only the finger(s) that changed."""
    def __init__(self, g):
        self.cdp = g.ctx.new_cdp_session(g.page); self.pos = {}
    def _send(self, kind, pts):
        self.cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'x': x, 'y': y, 'id': i} for (i, x, y) in pts]})
    def down(self, i, x, y): self.pos[i] = (x, y); self._send('touchStart', [(i, x, y)])
    def move(self, i, x, y): self.pos[i] = (x, y); self._send('touchMove', [(i, x, y)])
    def up(self, i):
        x, y = self.pos.pop(i); self._send('touchEnd', [(i, x, y)])
    def up_all(self):
        for i in list(self.pos): self.up(i)

def ready(g, timeout=30000):
    g.page.wait_for_function('window.RoyalSumo!==undefined&&RoyalSumo.debug', timeout=timeout)

def check(name, cond, detail=''):
    print(('PASS ' if cond else 'FAIL ') + name + (('  - ' + str(detail)) if detail != '' else ''))
    return bool(cond)
