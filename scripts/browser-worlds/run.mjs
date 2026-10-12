// Real production entries, UI-driven sessions, and screenshots from Chromium.
// This checks emulated layouts, never claims physical phone/GPU/audio feel.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ballistix} from './royal-ballistix.mjs';
import {scratchMatch} from './royal-scratch-match.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(root, '.browser-worlds');
await mkdir(out, {recursive:true});
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ogg':'audio/ogg','.wav':'audio/wav','.svg':'image/svg+xml'};
const server = createServer(async(req,res)=>{
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root.endsWith(sep)?root:root+sep)) throw new Error('Outside repository');
    const data = await readFile(path);
    res.writeHead(200, {'Content-Type':mime[extname(path)] || 'application/octet-stream'}); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
const allGames = [ballistix,scratchMatch];
const requested = process.env.BROWSER_GAMES?.split(',').map(s=>s.trim()).filter(Boolean);
const games = requested && !requested.includes('all') ? allGames.filter(g=>requested.includes(g.id)) : allGames;
if (!games.length || requested?.some(id=>id!=='all'&&!allGames.some(g=>g.id===id))) throw new Error('Unknown BROWSER_GAMES selection');
const profiles = [{name:'desktop',width:1440,height:900,touch:false},{name:'portrait',width:390,height:844,touch:true},{name:'landscape',width:844,height:390,touch:true}];
const report = {commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),date:new Date().toISOString(),browser:null,checks:[],errors:[],sources:[],limits:['Headless Chromium and emulated touch dimensions; no physical phone, gamepad or audio-by-ear verification.']};
let browser;
try {
  browser=await chromium.launch(); report.browser=browser.version();
  for(const game of games) {
    const source=await readFile(resolve(root,game.entry));
    report.sources.push({path:game.entry,sha256:createHash('sha256').update(source).digest('hex')});
    for(const profile of profiles) {
      const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:1,hasTouch:profile.touch,isMobile:profile.touch});
      const page=await context.newPage();page.setDefaultTimeout(10000);
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      page.on('console',m=>{if(m.type()==='error'&&!m.location().url?.endsWith('/favicon.ico'))errors.push(`Console error at ${m.location().url}: ${m.text()}`)});
      page.on('requestfailed',r=>errors.push(`Request failed: ${r.url()}: ${r.failure()?.errorText}`));
      page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`HTTP ${r.status()}: ${r.url()}`)});
      const check=(name,ok,detail)=>{const item={game:game.id,profile:profile.name,name,passed:!!ok};if(detail!==undefined)item.detail=detail;report.checks.push(item);if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
      const capture=async(name)=>{const file=`${game.id}-${profile.name}-${name}.png`;await page.screenshot({path:resolve(out,file),fullPage:false});return file;};
      try {
        await page.goto(`${base}/${game.entry}`,{waitUntil:'networkidle'});
        await game.exercise({page,check,capture,profile});
      } catch(e) {report.errors.push({game:game.id,profile:profile.name,error:String(e)});await capture('failure').catch(()=>{});}
      if(errors.length)report.errors.push({game:game.id,profile:profile.name,runtime:errors});
      await context.close();
    }
  }
} finally {
  if(browser)await browser.close();await new Promise(r=>server.close(r));
  await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
if(report.errors.length||report.checks.some(c=>!c.passed))process.exitCode=1;
