import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import ts from 'typescript';

const source=ts.createSourceFile('database.ts',readFileSync(new URL('../server/database.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const fn=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='addParticipant');assert.ok(fn);
let guard='';
function visit(node:ts.Node){if(ts.isStringLiteral(node)&&node.text.startsWith('UPDATE rooms SET version = ?'))guard=node.text;ts.forEachChild(node,visit);}
visit(fn);assert.ok(guard);

test('parent admission cannot reattach a removed child token during revocation, but a fresh deliberate join works',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(`CREATE TABLE rooms(id TEXT,code TEXT,version INTEGER,last_action_id TEXT,state_json TEXT,updated_at INTEGER,expires_at INTEGER);
   CREATE TABLE callback_session_games(id TEXT,session_code TEXT,child_kind TEXT,child_code TEXT,active INTEGER);
   CREATE TABLE callback_session_members(id TEXT,session_code TEXT,token_hash TEXT);
   CREATE TABLE callback_sessions(code TEXT,active_id TEXT,stage TEXT,expires_at INTEGER);
   CREATE TABLE players(room_id TEXT,token_hash TEXT,removed_at INTEGER);
   INSERT INTO rooms VALUES('room','ABCD',1,NULL,'{}',0,1000);
   INSERT INTO callback_session_games VALUES('game','PART','main','ABCD',1);
   INSERT INTO callback_sessions VALUES('PART','game','PLAYING',1000);
   INSERT INTO callback_session_members VALUES('old-member','PART','old-token');
   INSERT INTO players VALUES('room','old-token',50);`);
  const join=(member:string,token:string)=>db.prepare(guard).run(2,'join','{"joined":true}',100,1000,'room',1,100,member,token);
  assert.equal(join('old-member','old-token').changes,0,'still-existing parent membership cannot resurrect a removed token');
  assert.deepEqual({...db.prepare('SELECT version,state_json FROM rooms').get()},{version:1,state_json:'{}'});
  db.exec("DELETE FROM callback_session_members; INSERT INTO callback_session_members VALUES('new-member','PART','new-token');");
  assert.equal(join('old-member','old-token').changes,0,'old credentials remain revoked');
  assert.equal(join('new-member','new-token').changes,1,'a deliberate rejoin with fresh credentials remains supported');
 }finally{db.close();}
});
