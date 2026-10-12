"""Browser-only geometry, multi-touch and camera checks. Requires Playwright Python + Chromium.
Run against a local HTTP server rooted at the checkout; no product dependencies.
"""
import argparse,json,pathlib,time
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8766/games/royal-ballistix/source/index.html');ap.add_argument('--output',default='/tmp/ballistix-browser');args=ap.parse_args()
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
report={'browser':'','errors':[],'checks':[],'layout':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);report['browser']=b.version
 p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,has_touch=True)
 p.on('pageerror',lambda e:report['errors'].append(str(e)))
 p.goto(args.url)
 for w,h in [(390,844),(844,390)]:
  p.set_viewport_size({'width':w,'height':h})
  for seats in [2,4,10]:
   for scale in [80,135]:
    p.evaluate('([n,s])=>{RoyalBallistix.setPlayerCount(n);RoyalBallistix.setArenaSize(s)}',[seats,scale]);p.wait_for_timeout(100)
    rects=p.evaluate("Object.fromEntries(['#track','#magnet','#pulse','.top','#roster'].map(s=>{let r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,w:r.width,h:r.height}]}))")
    visible=all(r['x']>=0 and r['y']>=0 and r['x']+r['w']<=w+1 and r['y']+r['h']<=h+1 for r in rects.values())
    report['layout'].append({'viewport':[w,h],'seats':seats,'scale':scale,'rects':rects,'controlsVisible':visible})
    report['checks'].append({'name':f'layout {w}x{h} seats={seats} scale={scale}','passed':visible})
    # Countdown removed only from screenshot presentation, simulation unchanged.
    p.locator('#count').evaluate("el=>el.style.visibility='hidden'")
    p.screenshot(path=str(out/f'{w}x{h}-{seats}-{scale}.png'))
 p.set_viewport_size({'width':390,'height':844});p.evaluate('RoyalBallistix.setPlayerCount(2)');p.wait_for_timeout(3400)
 cdp=p.context.new_cdp_session(p)
 track=p.locator('#track').bounding_box();mag=p.locator('#magnet').bounding_box()
 stick={'x':track['x']+track['width']*.77,'y':track['y']+track['height']/2,'id':1}
 magnet={'x':mag['x']+mag['width']/2,'y':mag['y']+mag['height']/2,'id':2}
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[stick,magnet]});p.wait_for_timeout(160)
 state=p.evaluate('RoyalBallistix.getState().players[0]')
 report['checks'].append({'name':'simultaneous emulated stick and Magnet','passed':state['pos']>0 and state['magnet']})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});p.wait_for_timeout(200)
 state=p.evaluate('RoyalBallistix.getState().players[0]');report['checks'].append({'name':'cancel releases Magnet','passed':not state['magnet'] and state['held']==0})
 p.locator('#pause').click();p.locator('#pauseSettings').click();p.locator('#close').click();before=p.evaluate('RoyalBallistix.getState()');p.wait_for_timeout(150);after=p.evaluate('RoyalBallistix.getState()')
 report['checks'].append({'name':'settings return to pause','passed':p.locator('#pauseOv').is_visible() and before['balls']==after['balls']})
 camera=p.evaluate("()=>{const b=JSON.stringify(RoyalBallistix.getState());CallbackCamera.set({rotate:15,zoom:1.1,tilt:10});const code=CallbackCamera.code();CallbackCamera.reset();CallbackCamera.load(code,false);return b===JSON.stringify(RoyalBallistix.getState())&&code===CallbackCamera.code()}")
 report['checks'].append({'name':'CAM round-trip leaves simulation unchanged','passed':camera});p.evaluate('CallbackCamera.reset()');p.locator('#resume').click()
 # Rendering frame interval is measured in this headless environment only.
 timings=p.evaluate("()=>new Promise(resolve=>{let last=performance.now(),a=[];function f(t){a.push(t-last);last=t;if(a.length<120)requestAnimationFrame(f);else resolve(a.slice(1))}requestAnimationFrame(f)})")
 timings.sort();report['frameIntervalsMs']={'median':timings[len(timings)//2],'p95':timings[int(len(timings)*.95)],'samples':len(timings),'condition':'headless Chromium, 390x844, DPR 1, 2 seats; not real GPU/phone'}
 p.screenshot(path=str(out/'touch-play.png'));b.close()
(out/'results.json').write_text(json.dumps(report,indent=2))
failed=[x['name'] for x in report['checks'] if not x['passed']];print(json.dumps({'checks':len(report['checks']),'failed':failed,'errors':report['errors'],'frameIntervalsMs':report['frameIntervalsMs']},indent=2));raise SystemExit(bool(failed or report['errors']))
