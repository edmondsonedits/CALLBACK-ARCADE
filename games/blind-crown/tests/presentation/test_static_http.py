"""Check the real Pages output via HTTP in connected CI, not set_content."""
from pathlib import Path
import hashlib,json,os,subprocess,tempfile,time,urllib.request
from playwright.sync_api import sync_playwright
ROOT=Path.cwd();game=ROOT/'games/blind-crown';out=game/'tests/evidence';out.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
 Path(tmp,'CALLBACK-ARCADE').symlink_to(ROOT/'.pages-dist',target_is_directory=True)
 server=subprocess.Popen(['python','-m','http.server','8192','--bind','127.0.0.1','--directory',tmp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  url='http://127.0.0.1:8192/CALLBACK-ARCADE/'
  for _ in range(60):
   try:urllib.request.urlopen(url,timeout=.2);break
   except Exception:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
   page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(url);page.wait_for_selector('.game-card');assert page.locator('.game-card').count()==7
   card=page.locator('.game-card').filter(has=page.get_by_role('heading',name='Blind Crown — Nightfall',exact=True))
   card.get_by_role('link',name='Play',exact=True).click();page.wait_for_selector('#overlayStart')
   assert page.title()=='Blind Crown — Nightfall'
   assert page.evaluate('BlindCrownDebug.version')=='1.5.0'
   records=[]
   for mobile,w,h in [(False,1440,960),(True,390,844),(True,844,390)]:
    ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=mobile,has_touch=mobile)
    tab=ctx.new_page();page_errors=[];external=[]
    tab.on('pageerror',lambda e:page_errors.append(str(e)))
    tab.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://127.0.0.1:8192/') else (external.append(r.request.url),r.abort()))
    response=tab.goto(url+'games/blind-crown/');assert response.status==200
    assert hashlib.sha256(response.body()).hexdigest()==hashlib.sha256((game/'source/index.html').read_bytes()).hexdigest()
    tab.locator('#settingsBtn').click();tab.select_option('#timeSelect','30');tab.locator('#botSlider').fill('9');tab.locator('#settingsClose').click();tab.locator('#overlayStart').click()
    assert tab.evaluate('BlindCrownDebug.getState().players.length')==10
    for view in ['overhead','isometric','first','third']:
     tab.select_option('#quickView',view);tab.wait_for_timeout(100)
    assert tab.evaluate('BlindCrownDebug.getState().players.filter(p=>p.x!==undefined).length')==1
    tab.locator('#lockBtn').click();assert tab.evaluate('BlindCrownDebug.getState().players.find(p=>p.x!==undefined).locked')
    assert tab.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    box=tab.locator('#lockBtn').bounding_box();assert box['y']+box['height']<=h
    assert not page_errors,page_errors
    assert not external,external
    records.append({'viewport':f'{w}x{h}','mobileEmulation':mobile,'result':'passed','pageErrors':page_errors,'externalRequests':external})
    ctx.close()
   assert not errors,errors
   browser.close()
  (out/'static-http.json').write_text(json.dumps({'result':'passed','scope':'Connected CI HTTP-served Pages output; not physical devices or hosted multiplayer','sevenGameCatalog':True,'records':records},indent=2)+'\n')
  print('PASS: seven-game catalog Play navigation and exact v1.5 HTTP bytes; three viewports/four views/private planning/lock; no runtime exceptions or external game requests.')
 finally:server.terminate();server.wait(timeout=5)
