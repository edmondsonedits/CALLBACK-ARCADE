import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const games=['royal-ballistix','royal-roller-ruckus','royal-scratch-match','royal-sumo','royal-twisted','space-bash'];

test('Pages build publishes every imported game at a clean /games/<id>/ path',async()=>{
  const out=await mkdtemp(join(tmpdir(),'callback-arcade-pages-'));
  const run=spawnSync(process.execPath,['scripts/build-pages.mjs'],{cwd:process.cwd(),env:{...process.env,PAGES_OUTPUT_DIR:out},encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  for(const id of games) await access(join(out,'games',id,'index.html'));
  await access(join(out,'games','royal-sumo','vendor','three.module.js'));
  await access(join(out,'catalog','games.json'));
  await access(join(out,'.nojekyll'));
});

test('Pages homepage uses repository-relative assets and offers Play links',async()=>{
  const html=await readFile('public/index.html','utf8');
  const js=await readFile('public/catalog.js','utf8');
  assert.match(html,/href="styles\.css"/);
  assert.match(html,/src="catalog\.js"/);
  assert.match(js,/fetch\('catalog\/games\.json'\)/);
  assert.match(js,/games\/\$\{encodeURIComponent\(game\.id\)\}\//);
  assert.match(js,/textContent = 'Play'/);
});

test('GitHub Pages workflow builds and deploys the static arcade',async()=>{
  const workflow=await readFile('.github/workflows/pages.yml','utf8');
  assert.match(workflow,/pages: write/);
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/npm run pages:build/);
  assert.match(workflow,/actions\/upload-pages-artifact@v4/);
  assert.match(workflow,/actions\/deploy-pages@v4/);
});
