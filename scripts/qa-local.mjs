import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,rm,copyFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {localOrigin,qaBindings,qaProcessEnv} from './qa-config.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const appPort=Number(process.env.CALLBACK_QA_APP_PORT??3017),partyPort=Number(process.env.CALLBACK_QA_PARTY_PORT??8789);
for(const port of [appPort,partyPort])if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose valid local QA ports');
if(appPort===partyPort)throw Error('QA ports must differ');
const appOrigin=localOrigin('http://127.0.0.1:'+appPort),partyOrigin=localOrigin('http://127.0.0.1:'+partyPort);
const secret=randomBytes(32).toString('hex'),bindings=qaBindings(partyOrigin,secret);
async function free(port){await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
await free(appPort);await free(partyPort);
await mkdir('.wrangler',{recursive:true});
const scratch=await mkdtemp(path.join(root,'.wrangler','qa-'));
const config=path.join(scratch,'wrangler.json');
// Match the repository's bundled workerd binary; production keeps its own date.
await writeFile(config,JSON.stringify({name:'callback-disposable-qa',compatibility_date:'2026-08-22'}));
const env={...qaProcessEnv(process.env,bindings),CALLBACK_QA_EPHEMERAL:'1',CALLBACK_QA_MANAGED:'1',CALLBACK_QA_CONFIG_PATH:config,CALLBACK_TEST_BASE_URL:appOrigin,CALLBACK_QA_PARTY_SECRET:secret,MINIFLARE_REGISTRY_PATH:path.join(scratch,'registry'),WRANGLER_LOG_PATH:path.join(scratch,'wrangler.log')};
let party,app,closed=false;
const appLog=path.join(scratch,'app.log'),stream=createWriteStream(appLog);
async function close(){
  if(closed)return;closed=true;
  if(app?.pid&&app.exitCode===null){
    if(process.platform==='win32')await new Promise(resolve=>{const killer=spawn('taskkill',['/PID',String(app.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('exit',resolve);killer.on('error',resolve);});
    else {app.kill('SIGTERM');await Promise.race([new Promise(resolve=>app.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);}
  }
  await party?.dispose().catch(()=>{});stream.end();
  await mkdir('.logs/qa-local',{recursive:true});
  await copyFile(appLog,path.join(root,'.logs/qa-local','last-app.log')).catch(()=>{});
  const safeRoot=path.resolve(root,'.wrangler')+path.sep;
  if(!path.resolve(scratch).startsWith(safeRoot)||!path.basename(scratch).startsWith('qa-'))throw Error('Unsafe QA cleanup path');
  await rm(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:100}).catch(()=>{});
}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void close().then(()=>process.exit(0));});
async function ready(url){
  for(let i=0;i<120;i++){
    if(app&&app.exitCode!==null)throw Error('QA app exited; inspect .logs/qa-local/last-app.log');
    try{const r=await fetch(url,{signal:AbortSignal.timeout(3000)});if(r.ok)return;}catch{ /* Retry until local services are ready. */ }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('QA readiness timed out: '+url);
}
async function command(args){
  const child=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit',windowsHide:true});
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  if(code!==0)throw Error('QA check failed with exit '+code);
}
try{
  const bundle=await build({entryPoints:['party-worker/src/index.ts'],bundle:true,platform:'browser',format:'esm',target:'es2022',write:false});
  party=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,host:'127.0.0.1',port:partyPort,compatibilityDate:'2026-08-22',bindings:{PARTY_SECRET:secret,SITE_ORIGIN:appOrigin},durableObjects:Object.fromEntries(['PartyRoom','PartyAdmission','NativeArcadeRoom','OnlineArcadeRoom','SessionRoom'].map(className=>[{PartyRoom:'PARTY_ROOM',PartyAdmission:'PARTY_ADMISSION',NativeArcadeRoom:'NATIVE_ARCADE_ROOM',OnlineArcadeRoom:'ONLINE_ARCADE_ROOM',SessionRoom:'SESSION_ROOM'}[className],{className,useSQLite:true}])),log:new Log(LogLevel.ERROR)}));
  await party.ready;await ready(partyOrigin+'/health');
  app=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(appPort),'--strictPort'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  app.stdout.pipe(stream);app.stderr.pipe(stream);
  await ready(appOrigin+'/');
  console.log('Disposable QA ready: '+appOrigin+' (party Worker '+partyOrigin+'); paid providers disabled.');
  const args=process.argv.slice(2);
  if(args[0]==='--api')await command(['--import','tsx','--test','tests/api.integration.test.ts','tests/review-regressions.integration.test.ts']);
  else if(args[0]==='--browser')await command(['node_modules/@playwright/test/cli.js','test',...args.slice(1)]);
  else if(args[0]==='--benchmark')await command(['scripts/qa-latency.mjs']);
  else if(args.length)throw Error('Use --api, --browser [Playwright arguments], --benchmark, or no arguments');
  else await new Promise(resolve=>app.once('exit',resolve));
}catch(error){console.error(error.message);process.exitCode=1;}finally{await close();}
