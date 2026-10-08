import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const root=resolve('.');
const out=resolve(process.env.PAGES_OUTPUT_DIR || '.pages-dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp(join(root,'public'),out,{recursive:true});

const catalog=JSON.parse(await readFile(join(root,'catalog/games.json'),'utf8'));
await mkdir(join(out,'catalog'),{recursive:true});
await cp(join(root,'catalog/games.json'),join(out,'catalog/games.json'));

const games=Array.isArray(catalog.games)?catalog.games:catalog;
for(const game of games){
  if(game?.source?.status!=='imported') continue;
  if(!Array.isArray(game.source.paths) || !game.source.paths.includes('source/index.html')) continue;
  const sourceDir=join(root,'games',game.id,'source');
  const targetDir=join(out,'games',game.id);
  await mkdir(join(out,'games'),{recursive:true});
  await cp(sourceDir,targetDir,{recursive:true});
}
await writeFile(join(out,'.nojekyll'),'');
console.log(`GitHub Pages build ready at ${out}`);
