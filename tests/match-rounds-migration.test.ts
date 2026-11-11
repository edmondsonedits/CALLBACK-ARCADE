import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {MATCH_ROUNDS_DDL} from '../server/match-rounds-schema';

function legacy() {
  const db=new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE rooms(id TEXT PRIMARY KEY,state_json TEXT);
    CREATE TABLE rounds(id TEXT PRIMARY KEY,room_id TEXT,round_index INTEGER,kind TEXT,prompt_id TEXT,state_json TEXT,started_at INTEGER,completed_at INTEGER,created_at TEXT,UNIQUE(room_id,round_index));
    CREATE TABLE history_matches(id TEXT PRIMARY KEY,archive_json TEXT);
    INSERT INTO history_matches VALUES('old-archive','immutable published content');`);
  db.prepare('INSERT INTO rooms VALUES(?,?)').run('room',JSON.stringify({matchNumber:2,roundIndex:0,currentRound:{id:'current-round'}}));
  db.prepare('INSERT INTO rounds VALUES(?,?,?,?,?,?,?,?,?)').run('original-round','room',0,'OLD_KIND','old-prompt',JSON.stringify({id:'current-round',index:0,kind:'THE_SEED',promptId:'new-prompt',startedAt:20}),10,null,'then');
  db.prepare('INSERT INTO rounds VALUES(?,?,?,?,?,?,?,?,?)').run('stale-future','room',1,'THE_CATCH',null,JSON.stringify({id:'stale-future',index:1,kind:'THE_CATCH'}),10,null,'then');
  return db;
}
const apply=(db:DatabaseSync,statements:readonly string[])=>{db.exec('BEGIN');try{for(const sql of statements)db.exec(sql);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}};

test('legacy replay recovery uses current JSON round IDs, omits stale future rounds and preserves archives',()=>{
  const db=legacy();try{
    apply(db,MATCH_ROUNDS_DDL);
    assert.deepEqual(db.prepare('SELECT id,match_number,kind,prompt_id FROM match_rounds').all().map(r=>({...r})),[{id:'current-round',match_number:2,kind:'THE_SEED',prompt_id:'new-prompt'}]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rounds').get()!.n,2);
    assert.equal(db.prepare('SELECT archive_json FROM history_matches').get()!.archive_json,'immutable published content');
    db.prepare("INSERT INTO match_rounds(id,room_id,match_number,round_index,kind) VALUES('next-round','room',3,0,'COMIC_FRAME')").run();
    apply(db,MATCH_ROUNDS_DDL);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM match_rounds').get()!.n,2);
  }finally{db.close();}
});

test('SQL migration and runtime bootstrap can apply in either order without deleting round data',()=>{
  const migration=readFileSync(new URL('../drizzle/0015_match_scoped_rounds.sql',import.meta.url),'utf8').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
  for(const sqlFirst of [true,false]){const db=legacy();try{
    const order=sqlFirst?[migration,MATCH_ROUNDS_DDL,migration]:[MATCH_ROUNDS_DDL,migration,MATCH_ROUNDS_DDL];
    for(const statements of order)apply(db,statements);
    assert.equal(db.prepare('SELECT id FROM match_rounds').get()!.id,'current-round');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM rounds').get()!.n,2);
  }finally{db.close();}}
});
