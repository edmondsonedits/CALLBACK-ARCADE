"""Nightfall Canvas privacy/input/lifecycle regressions; no physical-device claim.

Run from repository root: python3 games/blind-crown/tests/presentation/test_quality.py
Requires Python Playwright and Chromium (CHROME_BIN overrides the executable).
No source rewriting, external assets, screenshots or repository evidence writes.
"""
import json
import math
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = (Path(__file__).resolve().parents[2] / 'source/index.html').read_text()


def own(page):
    return page.evaluate('BlindCrownDebug.getState().players.find(p=>p.x!==undefined)')


def unchanged_position(a, b):
    assert a['x'] == b['x'] and a['y'] == b['y'], (a, b)


def angle_delta(a, b):
    return math.atan2(math.sin(b - a), math.cos(b - a))


def tap_world(page, x, y, tactical=False):
    at = page.evaluate('''([x,y,tactical])=>{
        const c=document.querySelector(tactical?'#tacticalMap':'#scene'),r=c.getBoundingClientRect();
        const k=Math.min(r.width/c.width,r.height/c.height);
        let p={x:x+100,y:y+60};
        if(tactical)p={x,y};else if(BlindCrownDebug.view==='isometric')p=CrownPerspective.mapToIso(p.x,p.y);
        return {x:r.left+(r.width-c.width*k)/2+p.x*k,y:r.top+(r.height-c.height*k)/2+p.y*k};
    }''', [x, y, tactical])
    page.mouse.click(at['x'], at['y'])


def placement_checks(page):
    page.locator('#overlayStart').click()
    assert page.locator('#planStatus').count() == 1, 'Missing private planning status'
    assert page.get_attribute('#planStatus', 'aria-live') == 'polite'
    for view in ['overhead', 'isometric', 'first', 'third']:
        page.select_option('#quickView', view)
        tactical = view in ['first', 'third']
        tap_world(page, 500, 320, tactical)
        assert page.locator('#planStatus').inner_text() == 'Adjusted to a legal position — leave room around cover and the boundary.'
        assert page.evaluate('''()=>{const s=BlindCrownDebug.getState(),p=s.players.find(p=>p.x!==undefined);return BlindCrown.canPlace(p,s.round,s.settings.arena)}''')
        tap_world(page, 400, 390, tactical)
        assert page.locator('#planStatus').inner_text() == 'Position set. Aim, then lock your shot.'
    page.locator('#aimBtn').click()
    assert 'Position set' not in page.locator('#planStatus').inner_text()
    page.locator('#lockBtn').click()
    assert 'Locked' in page.locator('#planStatus').inner_text()
    page.locator('#lockBtn').click()
    page.locator('#placeBtn').click()
    tap_world(page, 500, 320, True)
    page.locator('#settingsBtn').click()
    page.locator('#startBtn').click()
    assert 'Adjusted' not in page.locator('#planStatus').inner_text()


def label_checks(page):
    assert page.locator('#lockBtn').inner_text() == 'Begin a tournament', 'Lobby label implies editable shot'
    page.locator('#overlayStart').click()
    # UI fixtures use the real app's state consumer; engine outcomes have separate tests.
    page.evaluate('''()=>{const original=BlindCrown.Match.prototype.state;
        BlindCrown.Match.prototype.state=function(...args){const s=original.apply(this,args),f=window.uiFixture;
            if(f){s.phase=f.phase;s.round=f.round||1;s.clock=3;s.players.forEach((p,i)=>p.alive=i<f.alive);
                if(f.phase==='planning'&&f.alive===0)s.players.forEach(p=>{delete p.x;delete p.y;delete p.a});
            }return s;};}''')
    for phase, label in [('reveal', 'Plan frozen'), ('volley', 'Volley in progress'),
                         ('results', 'Round complete'), ('final', 'Tournament complete'), ('planning', 'Spectating')]:
        page.evaluate('(f)=>window.uiFixture=f', {'phase': phase, 'alive': 0 if phase == 'planning' else 2})
        page.wait_for_timeout(40)
        assert page.locator('#lockBtn').inner_text() == label, phase
        assert page.locator('#lockBtn').is_disabled()
        assert page.locator('#planStatus').is_hidden()
    for alive, round_number, label in [(1, 1, 'Last survivor claims the crown'), (0, 1, 'Total wipe — points decide'),
                                       (2, 14, 'Round limit — points decide'), (2, 1, 'Survivors advance')]:
        page.evaluate('(f)=>window.uiFixture=f', {'phase': 'results', 'alive': alive, 'round': round_number})
        page.wait_for_timeout(40)
        assert page.locator('#annDetail').inner_text() == label


def connection_feedback_checks(page):
    page.route('http://blind-crown.test/', lambda route: route.fulfill(body=HTML, content_type='text/html'))
    page.goto('http://blind-crown.test/')
    page.locator('#overlayStart').click()
    # Disconnected room fixture, without opening a socket or hosting a service.
    page.evaluate('''()=>{CrownRoomClient.prototype.connect=function(){this.connected=false;this.cb.status('Connection lost · input paused')};}''')
    page.locator('#settingsBtn').click()
    page.locator('#onlineTab').click()
    page.locator('#createBtn').click()
    page.locator('#settingsClose').click()
    assert page.locator('#instructionText').is_visible(), 'Private status hid connection-loss instructions'
    assert 'Connection lost' in page.locator('#instructionText').inner_text()
    assert page.locator('#planStatus').is_hidden()


def marker_checks(page):
    result = page.evaluate('''()=>{
        const E=BlindCrown,m=new E.Match({bots:1},{seed:17});m.addPlayer('You');m.addBots(1);m.begin();
        const c=document.createElement('canvas');c.width=1200;c.height=760;c.style.width='372px';c.style.height='235.6px';document.body.append(c);
        const r=CrownArena.create(c),ctx=c.getContext('2d'),stroke=ctx.strokeRect.bind(ctx),sizes=[];
        ctx.strokeRect=(x,y,w,h)=>{if(x<0&&y<0)sizes.push(w);stroke(x,y,w,h)};
        const s=m.state(1),opts={view:'overhead',reducedMotion:true,clock:30};
        r.render(s,1,0,0,opts);const classic=sizes.splice(0),before=c.toDataURL();
        s.settings={...s.settings,ruleset:'precision'};r.render(s,1,0,0,opts);const precision=sizes.splice(0);
        const snapshots=[];
        for(const view of ['overhead','isometric','first','third'])for(const viewer of [1,null]){
            const raw=m.state(1);raw.settings={...raw.settings,ruleset:'classic'};raw.players=m.players.map(p=>({...p}));
            r.clear();r.render(raw,viewer,0,0,{...opts,view});const a=c.toDataURL();
            raw.players[1].x=101;raw.players[1].y=99;raw.players[1].a=2;
            raw.shots=[{id:2,x:101,y:99,dx:1,dy:0,dist:200,finish:.3,hit:1}];
            r.clear();r.render(raw,viewer,0,0,{...opts,view});snapshots.push(a===c.toDataURL());
        }
        c.remove();return {classic,precision,privatePixels:snapshots};
    }''')
    assert result['classic'] and max(result['classic']) * .31 >= 9, 'Classic endpoint too small at mobile scale'
    assert result['precision'] == [], 'Precision exposes a traced endpoint'
    assert all(result['privatePixels']), 'Rival planning data changes player or public spectator pixels'


def restart_shots_checks(page):
    page.locator('#overlayStart').click()
    page.evaluate('''()=>{const update=BlindCrown.Match.prototype.update;
        BlindCrown.Match.prototype.update=function(dt){
            if(window.advanceTo){const phase=window.advanceTo;window.advanceTo=null;this.fire();
                for(let i=0;i<40&&this.phase!==phase;i++)update.call(this,.2);
            }else update.call(this,dt);
        };}''')
    for phase in ['reveal', 'volley', 'results']:
        page.evaluate('(phase)=>window.advanceTo=phase', phase)
        page.wait_for_function('(phase)=>BlindCrownDebug.getState().phase===phase', arg=phase)
        assert page.evaluate('BlindCrownDebug.getState().shots.length') > 0
        assert page.locator('#planStatus').is_hidden()
        page.select_option('#quickView', 'first')
        page.select_option('#quickView', 'overhead')
        page.locator('#settingsBtn').click()
        page.locator('#startBtn').click()
        state = page.evaluate('BlindCrownDebug.getState()')
        assert state['phase'] == 'planning' and not state['shots'] and not state['eliminated']
        assert len([p for p in state['players'] if 'x' in p]) == 1
        assert page.evaluate('BlindCrownDebug.getStats().particles') == 0


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    records = []
    failures = []
    for check in [placement_checks, label_checks, marker_checks, connection_feedback_checks, restart_shots_checks]:
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        page = context.new_page(); page.set_content(HTML)
        try:
            check(page)
        except AssertionError as error:
            failures.append(f'{check.__name__}: {error}')
        finally:
            context.close()
    assert not failures, '\n'.join(failures)
    for width, height in [(1440, 960), (390, 844), (844, 390)]:
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=width != 1440, has_touch=width != 1440)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(HTML)
        for ruleset in ['classic', 'precision']:
            for arena in ['citadel', 'orchard', 'glacier']:
                page.locator('#settingsBtn').click()
                page.select_option('#arenaSelect', arena)
                page.select_option('#rulesetSelect', ruleset)
                page.select_option('#timeSelect', '30')
                page.locator('#botSlider').fill('9')
                page.locator('#startBtn').click()
                for view in ['overhead', 'isometric', 'first', 'third']:
                    page.select_option('#quickView', view)
                    page.wait_for_timeout(100)
                    result = page.evaluate('''() => {
                        const s=BlindCrownDebug.getState(), box=document.querySelector('#lockBtn').getBoundingClientRect();
                        return {phase:s.phase, visible:s.players.filter(p=>'x' in p || 'y' in p || 'a' in p).length,
                            shots:s.shots.length, overflow:document.documentElement.scrollWidth>innerWidth,
                            lockReachable:box.bottom<=innerHeight, stats:BlindCrownDebug.getStats()};
                    }''')
                    assert result['phase'] == 'planning' and result['visible'] == 1 and result['shots'] == 0, result
                    assert not result['overflow'] and result['lockReachable'], result
                    assert result['stats']['backend'] == 'canvas', result
                    records.append({'viewport': [width, height], 'arena': arena, 'view': view, 'ruleset': ruleset})
                    if os.environ.get('BLIND_CROWN_SCREENSHOTS'):
                        destination = Path(os.environ['BLIND_CROWN_SCREENSHOTS'])
                        destination.mkdir(parents=True, exist_ok=True)
                        page.screenshot(path=str(destination / f'{width}x{height}-{arena}-{view}-{ruleset}.png'))

        # Fine adjustments affect bearing alone, independently of Place/Aim mode.
        for mode in ['placeBtn', 'aimBtn']:
            page.locator('#' + mode).click()
            before = own(page)
            page.locator('#fineRight').click()
            after = own(page)
            unchanged_position(before, after)
            assert abs(angle_delta(before['a'], after['a']) - math.pi / 180) < 1e-8
            page.locator('#fineLeft').click()
            assert abs(angle_delta(before['a'], own(page)['a'])) < 1e-8

        # Drag aiming also leaves position unchanged in both perspective views.
        for view in ['first', 'third']:
            page.select_option('#quickView', view)
            box = page.locator('#scene').bounding_box()
            before = own(page)
            page.mouse.move(box['x'] + box['width'] * .55, box['y'] + box['height'] * .4)
            page.mouse.down()
            page.mouse.move(box['x'] + box['width'] * .65, box['y'] + box['height'] * .4)
            page.mouse.up()
            after = own(page)
            unchanged_position(before, after)
            assert abs(angle_delta(before['a'], after['a'])) > .01

        page.locator('#lockBtn').click()
        assert own(page)['locked']
        locked = own(page)
        page.keyboard.press('w')
        page.wait_for_timeout(100)
        unchanged_position(locked, own(page))
        assert page.evaluate('BlindCrownDebug.getState().phase') == 'planning'
        page.locator('#lockBtn').click()
        assert not own(page)['locked']

        # Pause survives nested help/settings; clock restarts only on Resume.
        page.locator('#pauseBtn').click()
        clock = page.evaluate('BlindCrownDebug.getState().clock')
        for opener, closer in [('howBtn', 'helpClose'), ('settingsBtn', 'settingsClose')]:
            page.locator('#' + opener).click()
            page.wait_for_timeout(150)
            page.locator('#' + closer).click()
            assert page.locator('#pausedShade').is_visible()
            assert page.evaluate('BlindCrownDebug.getState().clock') == clock
        page.locator('#pauseBtn').click()
        page.wait_for_timeout(150)
        assert page.evaluate('BlindCrownDebug.getState().clock') < clock

        if width != 1440:
            # Chromium-emulated simultaneous two-finger move/aim and cancellation.
            page.select_option('#quickView', 'first')
            page.locator('#settingsBtn').click()
            page.locator('#startBtn').click()
            before = own(page)
            scene = page.locator('#scene').bounding_box()
            stick = page.locator('#moveStick').bounding_box()
            sx, sy = stick['x'] + stick['width'] * .75, stick['y'] + stick['height'] * .5
            ax, ay = scene['x'] + scene['width'] * .55, scene['y'] + scene['height'] * .4
            cdp = context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': sx, 'y': sy, 'id': 1}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': sx, 'y': sy, 'id': 1}, {'x': ax, 'y': ay, 'id': 2}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': sx, 'y': sy, 'id': 1}, {'x': ax + 25, 'y': ay, 'id': 2}]})
            page.wait_for_timeout(150)
            after = own(page)
            assert math.hypot(after['x'] - before['x'], after['y'] - before['y']) > .1
            assert abs(angle_delta(before['a'], after['a'])) > .01
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchCancel', 'touchPoints': []})
            cancelled = own(page)
            page.wait_for_timeout(150)
            unchanged_position(cancelled, own(page))
            cdp.detach()

        # Restart is a new private round with no old shots or results.
        page.locator('#settingsBtn').click()
        page.locator('#startBtn').click()
        state = page.evaluate('BlindCrownDebug.getState()')
        assert state['round'] == 1 and state['phase'] == 'planning'
        assert not state['shots'] and not state['winners'] and not state['log']
        assert all(q['points'] == 0 and q['kills'] == 0 for q in state['players'])
        assert page.locator('#resultStandings').is_hidden()
        assert not errors, errors
        context.close()
    browser.close()
    print(json.dumps({'result': 'passed', 'matrix': records,
                      'checks': ['private placement feedback and clearing', 'phase and aftermath labels',
                                 'mobile aim endpoint', 'Precision no endpoint', 'rival-independent player/TV pixels',
                                 'connection-loss instructions', 'private planning', 'Canvas default', 'reachable controls',
                                 'independent fine aim and drag', 'lock/unlock', 'pause/help/settings',
                                 'emulated simultaneous touch and cancellation', 'clean restart'],
                      'scope': 'Headless Chromium, set_content; not physical mobile, HTTP deployment or experimental 3D'}))
