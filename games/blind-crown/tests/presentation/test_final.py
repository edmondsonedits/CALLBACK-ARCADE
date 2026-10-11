import os
"""A seeded two-contestant match played through real UI controls to final standings."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, math
R=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content((R/'source/index.html').read_text())
 page.evaluate('Math.random=()=>0.123456')
 page.locator('#settingsBtn').click();page.locator('#botSlider').fill('1');page.select_option('#timeSelect','8');page.locator('#settingsClose').click();page.locator('#soundBtn').click();page.locator('#overlayStart').click()
 plan=page.evaluate('''()=>{
 const E=BlindCrown,m=new E.Match({time:8,bots:1},{seed:Math.floor(.123456*4294967296)});m.addPlayer('Royal Archer',E.COLOR[0]);m.addBots(1);m.begin();const bot=m.players[1];
 for(let i=0;i<32;i++) {const a=i*Math.PI/16,p={...m.players[0],x:bot.x+Math.cos(a)*80,y:bot.y+Math.sin(a)*80,a:a+Math.PI};if(E.canPlace(p,1,'citadel')&&E.traceShot(p,[bot],1,'citadel').hit===bot.id&&E.traceShot(bot,[p],1,'citadel').hit===null)return {x:p.x,y:p.y,bx:bot.x,by:bot.y};} throw new Error('Seeded shot fixture unavailable');
 }''')
 def tap(x,y):
  at=page.evaluate('''([x,y])=>{const c=document.querySelector('#scene'),r=c.getBoundingClientRect(),k=Math.min(r.width/c.width,r.height/c.height);return {x:r.left+(r.width-c.width*k)/2+(x+100)*k,y:r.top+(r.height-c.height*k)/2+(y+60)*k}}''',[x,y]);page.mouse.click(at['x'],at['y'])
 tap(plan['x'],plan['y']);page.locator('#aimBtn').click();tap(plan['bx'],plan['by']);page.locator('#lockBtn').click()
 page.wait_for_function("BlindCrownDebug.getState().phase==='reveal'",timeout=12000)
 state=page.evaluate('BlindCrownDebug.getState()');assert state['shots'][0]['hit']==2,state
 assert page.locator('#lockBtn').is_disabled()
 page.wait_for_function("BlindCrownDebug.getState().phase==='final'",timeout=10000)
 assert page.locator('#resultStandings').is_visible();assert page.locator('.standing').count()==2
 assert 'Royal Archer' in page.locator('#welcomeTitle').inner_text()
 assert '1 hit · 110 points · 1 round.' in page.locator('#welcomeCopy').inner_text()
 page.screenshot(path=str(R/'tests/evidence/final-nightfall.png'),full_page=True)
 page.locator('#overlayStart').click();assert page.evaluate('BlindCrownDebug.getState().phase')=='planning';assert page.locator('#resultStandings').is_hidden()
 assert not errors,errors
 print(json.dumps({'result':'passed','checks':['real seeded UI placement and aim','simultaneous volley result','frozen reveal controls','ranked final standings','rematch clears final UI','audio opt-in has no runtime exceptions'],'pageErrors':errors}))
 b.close()
