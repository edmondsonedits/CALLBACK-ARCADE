import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { authorizePhotoFace } from '../server/profile-faces/authorize';
import { PROFILE_FACE_DDL } from '../server/profile-faces/schema';
import { sha256Hex } from '../server/crypto';

test('photo authorization accepts the owner cookie and rejects a copied ID or missing cookie', async () => {
 const sqlite=new DatabaseSync(':memory:');
 const prepare=(sql:string) => {
  let values:unknown[]=[];
  const statement={bind(...args:unknown[]){values=args;return statement;},async first(){return sqlite.prepare(sql).get(...values as never[])??null;},async run(){sqlite.prepare(sql).run(...values as never[]);return {success:true,meta:{changes:1}};}};
  return statement;
 };
 const db={prepare,async batch(statements:ReturnType<typeof prepare>[]){return Promise.all(statements.map(statement=>statement.run()));}} as unknown as D1Database;
 try {
  await db.batch(PROFILE_FACE_DDL.map(sql=>db.prepare(sql)));
  const faceId='ba11958b-767c-4e45-a92d-b6a59ad3346c',owner='o'.repeat(48);
  sqlite.prepare('INSERT INTO profile_faces VALUES(?,?,?,?,?,?)').run(faceId,await sha256Hex(owner),`profile-faces/${faceId}.png`,'image/png',100,Date.now());
  const request=(token?:string)=>new Request('https://game.test/join',{headers:token?{Cookie:`callback_profile=${token}`}:{}});
  assert.equal(await authorizePhotoFace(request(owner),faceId,db),null);
  assert.equal((await authorizePhotoFace(request('x'.repeat(48)),faceId,db))?.status,422);
  assert.equal((await authorizePhotoFace(request(),faceId,db))?.status,422);
  assert.equal(await authorizePhotoFace(request(),undefined,db),null);
 } finally {sqlite.close();}
});
