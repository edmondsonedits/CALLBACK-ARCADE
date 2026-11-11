import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {PRACTICE_GAMES} from '../lib/arcade/practice/catalog';
import {ARCADE_GAMES,getArcadeControllerCapacity,getArcadeLaunchHref} from '../lib/arcade/catalog';
import {FULL_ARCADE_GAMES} from '../lib/arcade/online/full-games';
import {ONLINE_ENGINE_IDS,getOnlineEngine} from '../lib/arcade/online/engines';
import {ONLINE_HOSTED_GAME_IDS,onlineLaunchHref} from '../lib/arcade/online/catalog';
import {isArchivedArcadeGame} from '../lib/arcade/archived-games';
test('every retained Arcade title has a ten-seat launch path while persisted engines remain available',()=>{
 assert.equal(PRACTICE_GAMES.length+ARCADE_GAMES.length,25);
 assert.deepEqual(ONLINE_ENGINE_IDS.filter(id=>!isArchivedArcadeGame(id)).sort(),[...ONLINE_HOSTED_GAME_IDS].sort());
 const ids=Array.from({length:10},(_,i)=>String(i).padStart(2,'0'));
 for(const game of PRACTICE_GAMES)assert.equal(onlineLaunchHref(game.id),`/arcade/online/new?game=${game.id}`);
 for(const game of ARCADE_GAMES){assert.equal(getArcadeControllerCapacity(game.id),10);assert.ok(getArcadeLaunchHref(game));}
 for(const id of ONLINE_ENGINE_IDS){const game=getOnlineEngine(id)!;assert.ok(game.publicState(game.create(ids,42,{},[])).view,id);assert.throws(()=>game.create([...ids,'10'],42,{},[]),/INVALID_ONLINE_ROSTER/,id);}
 for(const game of FULL_ARCADE_GAMES){const html=readFileSync(new URL('../public'+game.href,import.meta.url),'utf8');assert.match(html,/shared\/online-view\.js/,game.id);}
 assert.equal(getOnlineEngine('invented-game'),null);
});
test('renderer transport accepts only its same-origin parent and does not simulate',()=>{
 const parent={postMessage(){}},applied:unknown[]=[],events=new Map<string,(e:unknown)=>void>();
 const window={CallbackOnlineView:{apply:(s:unknown)=>applied.push(s)},addEventListener:(n:string,f:(e:unknown)=>void)=>events.set(n,f)};
 vm.runInNewContext(readFileSync(new URL('../public/arcade-games/shared/online-view.js',import.meta.url),'utf8'),{window,parent,location:{search:'?online=1',origin:'https://arcade.test'},URLSearchParams,requestAnimationFrame:(f:()=>void)=>f()});
 const data={type:'callback:online-view',snapshot:{matchId:'current',version:2,view:{kind:'arena'}}};
 const message=events.get('message')!;message({source:parent,origin:'https://evil.test',data});message({source:{},origin:'https://arcade.test',data});assert.equal(applied.length,0);
 message({source:parent,origin:'https://arcade.test',data});assert.equal(applied.length,1);
});
test('appended online migration preserves all existing migrated tables and rows',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 const dir=new URL('../drizzle/',import.meta.url),files=readdirSync(dir).filter(f=>/^000[0-6]_.*\.sql$/.test(f)).sort();
 const newest=files.pop()!;assert.equal(newest,'0006_chubby_menace.sql');
 for(const file of files)db.exec(readFileSync(new URL(file,dir),'utf8'));
 const before=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[];
 db.exec('CREATE TABLE migration_sentinel(id TEXT PRIMARY KEY,value TEXT);INSERT INTO migration_sentinel VALUES(\'keep\',\'unchanged\')');
 db.exec(readFileSync(new URL(newest,dir),'utf8'));
 const after=new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(x=>x.name));
 for(const t of before)assert.ok(after.has(t.name),t.name);
 assert.equal(db.prepare("SELECT value FROM migration_sentinel WHERE id='keep'").get()!.value,'unchanged');
 for(const table of ['online_arcade_rooms','online_arcade_seats','online_arcade_results'])assert.ok(after.has(table));db.close();
});
