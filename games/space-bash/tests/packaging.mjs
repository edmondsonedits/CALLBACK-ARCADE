import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const output=await mkdtemp(join(tmpdir(),'space-bash-pages-'));
try{
 execFileSync(process.execPath,['scripts/build-pages.mjs'],{cwd:resolve('.'),env:{...process.env,PAGES_OUTPUT_DIR:output},stdio:'pipe'});
 const entry=new URL('file://'+join(output,'games/space-bash/index.html'));
 const html=await readFile(entry,'utf8'),base=html.match(/img\.src="([^"]+)"\+file/)[1];
 const provenance=JSON.parse(await readFile(new URL('./assets/worlds/provenance.json',entry),'utf8'));
 for(const file of ['star_04.png','smoke_04.png','spark_01.png']){
  const builtPath=new URL(base+file,entry);
  assert.ok(builtPath.pathname.startsWith(join(output,'games/space-bash/')),'runtime URL must remain inside its published game');
  const bytes=await readFile(builtPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.files.find(f=>f.path===file).sha256);
 }
 const license=await readFile(new URL('./assets/worlds/KENNEY-LICENSE.txt',entry),'utf8');
 assert.match(license,/Creative Commons Zero|CC0/i);
 console.log('Space Bash Pages packaging passed: 3 runtime URLs resolve to matching PNGs, with license/provenance shipped.');
}finally{await rm(output,{recursive:true,force:true});}
