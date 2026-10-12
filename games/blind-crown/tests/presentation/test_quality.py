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


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME_BIN', '/usr/bin/chromium'),
                                headless=True, args=['--no-sandbox'])
    records = []
    for width, height in [(1440, 960), (390, 844), (844, 390)]:
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=width != 1440, has_touch=width != 1440)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(HTML)
        for arena in ['citadel', 'orchard', 'glacier']:
            page.locator('#settingsBtn').click()
            page.select_option('#arenaSelect', arena)
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
                records.append({'viewport': [width, height], 'arena': arena, 'view': view})

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
                      'checks': ['private planning', 'Canvas default', 'reachable controls',
                                 'independent fine aim and drag', 'lock/unlock', 'pause/help/settings',
                                 'emulated simultaneous touch and cancellation', 'clean restart'],
                      'scope': 'Headless Chromium, set_content; not physical mobile, HTTP deployment or experimental 3D'}))
