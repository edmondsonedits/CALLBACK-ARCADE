import os
"""Acceptance of presentation-only changes in a real Chromium Canvas renderer."""
from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
HTML=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'source/index.html'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('CHROME_BIN','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':960}); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML.read_text(),wait_until='domcontentloaded');page.wait_for_timeout(100)
 result=page.evaluate('''() => {
   const assert=(x,m)=>{if(!x)throw new Error(m)};
   assert(window.CrownArt?.version==='1.5.0','Missing coherent v1.5 art pipeline');
   const E=BlindCrown, art=CrownArt, m=new E.Match({bots:9},{seed:171});
   m.addPlayer('You');m.addBots(9);m.begin();
   const c=document.createElement('canvas');c.width=1200;c.height=760;const r=CrownArena.create(c);
   const options={view:'overhead',quality:'normal',fov:75,reducedMotion:false,clock:12,backend:'canvas'};
   const raw=m.state(1); raw.players=m.players.map(p=>({...p}));
   const saved=JSON.stringify(raw);
   r.render(raw,1,1,1/60,options);
   assert(JSON.stringify(raw)===saved,'Renderer mutated simulation snapshot');
   assert(JSON.stringify(r.getStats().visibleActorIds)==='[1]','Planning exposed a rival');
   r.render(raw,null,1,1/60,options);
   assert(r.getStats().visibleActorIds.length===0,'TV renderer exposed hidden rivals');
   for(const theme of ['citadel','orchard','glacier']){
     assert(JSON.stringify(art.coverFootprints(theme,E))===JSON.stringify(E.shotWalls(theme)),'Cover footprint drift');
   }
   r.render(raw,1,1,1/60,options); const builds=r.getStats().staticSceneBuilds;
   for(let i=0;i<12;i++)r.render(raw,1,2+i*.016,1/60,options);
   assert(r.getStats().staticSceneBuilds===builds,'Static scene rebuilt each frame');
   m.fire();m.phase='volley';m.clock=1.1;const volley=m.state(1);
   volley.shots=[{id:1,x:200,y:200,dx:1,dy:0,dist:100,finish:.18,hit:2,material:'player'}];
   r.clear();r.render(volley,1,3,1/60,{...options,clock:1.1});const bursts=r.getStats().impactBursts;
   assert(bursts===1,'Impact did not emit exactly once on arrival');
   for(let i=0;i<50;i++)r.render(volley,1,3+i*.016,1/60,{...options,clock:1.1});
   assert(r.getStats().impactBursts===bursts,'Impact repeated each frame');
   assert(r.getStats().particles<=160,'Unbounded particles');
   r.clear();r.render(volley,1,4,0,{...options,clock:1.1});
   assert(r.getStats().particles>0,'Impact scenario must contain live particles');
   for(let i=0;i<12;i++)r.render(volley,1,4+i*.08,.08,{...options,clock:1.1,view:'first'});
   assert(r.getStats().particles===0,'Switching camera leaves stale particles frozen');
   r.render(volley,1,8,1/60,{...options,clock:1.1,reducedMotion:true});
   assert(r.getStats().particles===0,'Reduced motion retained moving particles');
   r.clear();r.render(raw,1,1,0,{...options,reducedMotion:true});const a=c.toDataURL();
   r.render(raw,1,5,0,{...options,reducedMotion:true});assert(c.toDataURL()===a,'Reduced motion still animates');
   return {result:'passed',snapshotImmutable:true,planningActorIds:[1],spectatorActorIds:[],sharedCoverFootprints:3,staticSceneCached:true,oneShotImpacts:true,reducedMotionFrozen:true};
 }''')
 assert not errors,errors
 print(json.dumps(result,indent=2));b.close()
