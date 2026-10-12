// Cross-platform unit-test runner: `node test/run.mjs [filter]`  (npm test). Node's own runner, explicit file list (no shell globbing needed).
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';
const dir=path.join(path.dirname(new URL(import.meta.url).pathname),'unit');
const filter=process.argv[2]||'';
const files=fs.readdirSync(dir).filter(f=>f.endsWith('.test.js')&&f.includes(filter)).sort().map(f=>path.join(dir,f));
if(!files.length){console.error('no unit tests match "'+filter+'"');process.exit(1)}
const r=spawnSync(process.execPath,['--test','--test-reporter=spec',...files],{stdio:'inherit'});
process.exit(r.status===null?1:r.status);
