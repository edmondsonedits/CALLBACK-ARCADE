import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { sessionAvatarUpdate } from '../server/sessions/avatar';
import { DEFAULT_AVATAR } from '../lib/avatar-runtime';
import { AvatarConfigSchema } from '../lib/contracts';
import { SESSION_DDL } from '../server/sessions/schema';

test('avatar propagation follows the winning child action and authenticated membership',async()=>{
 const sql=new DatabaseSync(':memory:');for(const ddl of SESSION_DDL)sql.exec(ddl);
 sql.exec(`CREATE TABLE rooms(id TEXT,code TEXT,version INTEGER,last_action_id TEXT);
 CREATE TABLE players(id TEXT,room_id TEXT,token_hash TEXT,removed_at INTEGER);
 INSERT INTO rooms VALUES('room','CHLD',2,'avatar');
 INSERT INTO players VALUES('player','room','owner-token',NULL),('other','room','other-token',NULL);
 INSERT INTO callback_sessions(code,host_token_hash,version,stage,active_id,expires_at) VALUES('PRNT','host',2,'PLAYING','game',9999999999999);
 INSERT INTO callback_session_games(id,session_code,child_kind,child_code,active,game_json,created_at) VALUES('game','PRNT','main','CHLD',1,'{}',0);
 INSERT INTO callback_session_members VALUES('member','PRNT',0,'owner-token','Ada','ada','{}','old',0),('other-member','PRNT',1,'other-token','Bo','bo','{}','old',0);`);
 const db={prepare:(query:string)=>({bind:(...values:(string|number|null)[])=>({run:async()=>sql.prepare(query).run(...values)})})} as unknown as D1Database;
 const apply=(action='avatar',actor='player',version=2)=>sessionAvatarUpdate(db,{roomId:'room',actionId:action,actorId:actor,version,avatarConfig:AvatarConfigSchema.parse({...DEFAULT_AVATAR,bodyWidth:1.1}),avatarPreset:null}).run();
 await apply('lost-action');await apply('avatar','nonmember');await apply('avatar','player',3);
 assert.equal(sql.prepare("SELECT avatar_json FROM callback_session_members WHERE id='member'").get()!.avatar_json,'{}');
 await apply();const updated=sql.prepare("SELECT avatar_json,avatar_preset FROM callback_session_members WHERE id='member'").get()!;
 assert.equal(JSON.parse(String(updated.avatar_json)).bodyWidth,1.1);assert.equal(updated.avatar_preset,null);
 assert.equal(sql.prepare("SELECT avatar_json FROM callback_session_members WHERE id='other-member'").get()!.avatar_json,'{}');
 sql.exec("UPDATE callback_session_games SET active=0; UPDATE callback_session_members SET avatar_json='{}'");await apply();
 assert.equal(sql.prepare("SELECT avatar_json FROM callback_session_members WHERE id='member'").get()!.avatar_json,'{}');sql.close();
});
