import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../source/',import.meta.url));
const original=await readFile(join(root,'original/royal_sumo_crownfall_v1.3.0.html'),'utf8');
assert.equal(createHash('sha256').update(original).digest('hex'),'86bcf200c457a9b3da5cb222bcd5e22a46cc95d229b98edf53354eb503589c7e');
const out=await mkdtemp(join(tmpdir(),'sumo-verify-'));
try{
 const run=spawnSync(process.execPath,[join(root,'project/build.js'),'--out',out],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 assert.equal(await readFile(join(out,'index.html'),'utf8'),original,'Editable project must reproduce the exact supplied game');
 const online=await readFile(join(root,'online/host.js'),'utf8');
 const active=await readFile(join(root,'index.html'),'utf8');
 const adapter=await readFile(join(root,'callback-camera.js'),'utf8');
 assert.equal(active,original.replace('<body>','<body data-pause-flow="manual-resume">').replace('</body>',`<script id="callback-camera-adapter">\n${adapter}</script><script id="sumo-online-adapter">\n${online}</script></body>`),'Only the documented camera/room adapters and metadata may differ');
 console.log('Royal Sumo v1.3.0 provenance, reproducible build and entry integrity passed.');
}finally{await rm(out,{recursive:true,force:true})}
