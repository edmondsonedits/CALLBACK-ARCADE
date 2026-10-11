import os
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys
ROOT=Path(__file__).resolve().parents[2]
HTML=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'source/index.html'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 for w,h,mobile in [(1440,960,False),(390,844,True),(844,390,True)]:
  ctx=b.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(HTML.read_text());page.wait_for_timeout(80)
  assert page.locator('.arenaChoice').count()==3,'Missing visual arena selection'
  assert page.locator('#resultStandings').is_hidden(),'Results visible before final'
  page.locator('#settingsBtn').click();page.locator('.arenaChoice[data-arena="orchard"]').click();assert page.input_value('#arenaSelect')=='orchard';page.locator('#settingsClose').click();page.locator('#overlayStart').click();page.wait_for_timeout(100)
  assert page.get_attribute('#app','data-phase')=='planning'
  assert page.locator('#rosterList .avatarDot svg').count()==6
  assert page.locator('#resultStandings').is_hidden()
  assert page.locator('#lockBtn').bounding_box()['y']+page.locator('#lockBtn').bounding_box()['height']<=h
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('#settingsBtn').click();page.locator('#reducedMotion').check();page.locator('#settingsClose').click();page.wait_for_timeout(80);assert page.locator('body').evaluate('(b)=>b.classList.contains("reduced-motion")')
  assert not errors,errors;ctx.close()
 b.close()
 print('PASS: visual arena picker, synchronized HUD, portrait icons, private final standings, reduced-motion CSS, reachable controls at three sizes')
