"""Capture deterministic feedback states from a test-only copy of the inline game."""
import argparse,pathlib,json
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--output',default='/tmp/ballistix-feedback');args=ap.parse_args();out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
src=(pathlib.Path(__file__).parent/'../source/index.html').resolve().read_text()
src=src.replace("})();\n</script>","window.fixture={get P(){return P},G,S,pxy,inward,tangent,hitPaddle,draw,hud,startMag,capture,pulse,queueBall};})();\n</script>")
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);p=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 p.set_content(src);p.evaluate('requestAnimationFrame=()=>0');p.wait_for_timeout(100)
 for seats,state in [(2,'contact'),(10,'charge'),(10,'perfect')]:
  p.evaluate('''([seats,state])=>{RoyalBallistix.setPlayerCount(seats);let a=fixture;a.G.phase='fight';a.G.sound=false;document.querySelector('#count').classList.add('hidden');let p=a.P[0];p.life=2;let q=a.pxy(p),n=a.inward(p),t=a.tangent(p);function ball(side=0){return{x:q[0]+n[0]*a.S.size*.04+t[0]*side,y:q[1]+n[1]*a.S.size*.04+t[1]*side,vx:-n[0]*a.S.size,vy:-n[1]*a.S.size,r:a.S.size*.021,held:null,age:0,last:-1}}a.G.balls=[ball(a.S.pad*.6)];if(state==='contact')a.hitPaddle(a.G.balls[0],p);if(state==='charge'){a.startMag(p);for(let i=0;i<4;i++){let b=ball((i-1.5)*a.S.size*.032);a.G.balls.push(b);a.capture(b,p)}p.magT=4.5;for(let i=1;i<seats;i++){a.P[i].aiState=i%2?'DEFEND':'INTERCEPT'}a.startMag(a.P[2]);a.P[2].aim=.5;let other={...ball(),held:2};a.P[2].held=[other]}if(state==='perfect'){a.G.balls=[ball()];a.pulse(p)}a.queueBall();a.G.launch.t=.2;a.draw();a.hud()}''',[seats,state])
  p.screenshot(path=str(out/f'{seats}-{state}.png'))
 b.close()
