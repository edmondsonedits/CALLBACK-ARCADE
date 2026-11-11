import { build } from 'esbuild';
import { readFile,writeFile,mkdir,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build-sumo-online.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/build-sumo-realtime.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/build-imported-online.mjs'],{stdio:'inherit'});
await build({entryPoints:['lib/arcade/touch-bootstrap.ts'],outfile:'public/arcade-games/shared/touch-ui.js',bundle:true,format:'iife',platform:'browser',target:'es2022'});
const registry=[];
function originalSource(dir,file){return readFile(path.join(dir,'original',file))}
const root=process.cwd(),packages=JSON.parse(await readFile('lib/arcade/upgrades/packages.json','utf8'));
async function files(dir){const out=[];for(const d of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())out.push(...await files(p));else if(d.name!=='provenance.json')out.push(p)}return out.sort()}
for(const p of packages){
 if(!/^[a-z-]+$/.test(p.id)||!/^lib\/arcade\/upgrades\/[a-z-]+\.ts$/.test(p.entry)||!/^\w+$/.test(p.exportName))throw Error('Invalid local game package');
 const dir=path.join(root,'public/arcade-games',p.id);await mkdir(dir,{recursive:true});
 await build({entryPoints:[p.entry],outfile:path.join(dir,'simulation.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',legalComments:'inline'});
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#111a39"><title>${p.title}</title><link rel="stylesheet" href="../shared/arena-runtime.css"><link rel="stylesheet" href="../shared/arcade-menu.css"><link rel="stylesheet" href="../shared/arcade-touch.css"></head><body>
 <div class="arena-viewport"></div><header class="arena-hud"><h1>${p.title}</h1><div class="arena-round"></div><div class="arena-status" role="status"></div><div class="arena-scoreboard" aria-label="Crown scores"></div><div class="arena-clock" aria-label="Round clock"></div></header>
 <button class="arena-fullscreen" aria-label="Fullscreen">⛶</button><div class="arena-countdown" role="status"></div><div class="arena-help"></div>
 <div class="arena-controls"><button class="arena-stick" aria-label="Move"><span class="arena-stick-knob"></span></button><div class="arena-actions" aria-label="Game actions"></div></div>
 <dialog class="arena-result" aria-label="Round result"><h2></h2><p></p><button class="next">Next round</button><button class="menu">Main menu</button></dialog>
 <p class="arena-error" role="alert" hidden></p>
 <script type="module">import {${p.exportName} as game} from './simulation.js';import {mountArena} from '../shared/arena-runtime.js';mountArena(game).catch(e=>{const el=document.querySelector('.arena-error');el.hidden=false;el.textContent='The arena could not load. Please reload or return to the Arcade. '+String(e.message||e)});</script><script src="../shared/arcade-menu.js"></script><script src="../shared/online-view.js"></script><script src="../shared/touch-ui.js"></script></body></html>`;
 await writeFile(path.join(dir,'index.html'),html);
 // Original deterministic engine source remains available beside the bundle.
 await mkdir(path.join(dir,'original'),{recursive:true});
 if(p.id==='snow-bash')for(const file of ['jungle-bash-simulation.ts','jungle-bash-config.ts','space-bash-config.ts','snow-bash-config.ts','destructible-floor.ts'])await writeFile(path.join(dir,'original',file),await originalSource(dir,file));
 for(const file of p.originals??[]){if(!/^[a-z-]+\.ts$/.test(file))throw Error('Invalid archived source');await writeFile(path.join(dir,'original',file+'.txt'),await originalSource(dir,file+'.txt'))}
 const exported=(await import(pathToFileURL(path.join(dir,'simulation.js')).href+'?hash='+Date.now()))[p.exportName];
 registry.push({practiceId:p.id,id:p.id,title:p.title,version:p.version,href:'/arcade-games/'+p.id+'/index.html',maxContestants:10,maps:exported.arenas.map(a=>({id:a.id,title:a.name,skill:a.skill}))});
 const recorded=[];for(const f of await files(dir))recorded.push({path:path.relative(dir,f).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(f)).digest('hex')});
 await writeFile(path.join(dir,'provenance.json'),JSON.stringify({origin:'Existing King Prompter local simulation and project-owned upgrade code',baseCommit:'c6f1d3c2cf01a71a6ebeef165712b685e1e5fb2d',version:p.version,source:p.entry,license:'Project-owned source; Three.js dependency is MIT',dependencies:[{path:'../shared/arena-runtime.js',purpose:'Local Three.js presentation and match lifecycle'},{path:'../royal-twisted/vendor/three/three.module.js',license:'MIT',version:'0.180.0'}],files:recorded},null,2)+'\n');
 console.log('Built local arcade package: '+p.id);
}
const shared=path.join(root,'public/arcade-games/shared'),recorded=[];for(const f of await files(shared))recorded.push({path:path.relative(shared,f).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(f)).digest('hex')});
await writeFile(path.join(shared,'provenance.json'),JSON.stringify({origin:'King Prompter Sites integration code',license:'Project-owned source',files:recorded},null,2)+'\n');

await writeFile('lib/arcade/arena-games.ts','// Generated from checked local game packages by scripts/build-arcade.mjs.\nimport type {FullArcadeGame} from "./full-games";\nexport const BUNDLED_ARCADE_GAMES:readonly FullArcadeGame[]='+JSON.stringify(registry,null,2)+';\n');

// Refresh imported worlds, archived online renderers and phone assets together.
execFileSync(process.execPath,['scripts/record-phone-game-provenance.mjs'],{stdio:'inherit'});
