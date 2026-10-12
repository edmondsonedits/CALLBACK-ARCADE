import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const out=await mkdtemp(join(tmpdir(),'royal-sumo-build-'));
try{
  const run=spawnSync(process.execPath,[join(root,'project/build.js'),'--out',out],{stdio:'inherit'});
  if(run.status!==0)throw new Error('Royal Sumo build failed');
  const html=await readFile(join(out,'index.html'),'utf8');
  const adapter=await readFile(join(root,'callback-camera.js'),'utf8');
  const online=await readFile(join(root,'online/host.js'),'utf8');
  const entry=html.replace('<body>','<body data-pause-flow="manual-resume">')
    .replace('</body>',`<script id="callback-camera-adapter">\n${adapter}</script><script id="sumo-online-adapter">\n${online}</script></body>`);
  await writeFile(join(root,'index.html'),entry);
  console.log('Built CALLBACK entry with preserved camera controls.');
}finally{await rm(out,{recursive:true,force:true})}
