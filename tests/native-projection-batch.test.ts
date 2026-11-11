import assert from 'node:assert/strict';
import test from 'node:test';
import { projectNativeBatch } from '../server/arcade-native/projection-batch';

test('one batch loads and advances once while projecting and revoking individual actors', async () => {
  let loads=0, advances=0;
  const entries=[{ticket:'host',nonce:'h',version:1},{ticket:'player',nonce:'p',version:1},{ticket:'removed',nonce:'r',version:1}];
  const result=await projectNativeBatch(entries, {
    load:async()=>{loads++;return {version:1};},
    authenticate:async(entry)=>{if(entry.ticket==='removed')throw Error('revoked');return {role:entry.ticket};},
    advance:async(context)=>{advances++;return {...context,version:2};},
    project:async(entry,context,auth)=>({nonce:entry.nonce,version:context.version,snapshot:{role:auth.role}}),
  });
  assert.equal(loads,1);assert.equal(advances,1);
  assert.deepEqual(result,[{nonce:'h',version:2,snapshot:{role:'host'}},{nonce:'p',version:2,snapshot:{role:'player'}},{nonce:'r',version:0,snapshot:null,revoked:true}]);
});

test('a transient load failure rejects the batch rather than revoking every valid socket', async()=>{
  await assert.rejects(projectNativeBatch([{ticket:'host',nonce:'h',version:1}],{
    load:async()=>{throw Error('temporary D1 failure');},authenticate:async()=>({}),advance:async()=>({}),project:async()=>({nonce:'h',version:1,snapshot:null}),
  }), /temporary D1/);
});

test('one failed private projection does not block healthy actors or revoke authentication', async()=>{
  const result=await projectNativeBatch([{ticket:'host',nonce:'h',version:1},{ticket:'phone',nonce:'p',version:1}],{
    load:async()=>({}),authenticate:async entry=>entry.ticket,advance:async context=>context,
    project:async (entry)=>{if(entry.ticket==='phone')throw Error('temporary presence failure');return {nonce:entry.nonce,version:2,snapshot:{role:'host'}};},
  });
  assert.deepEqual(result,[{nonce:'h',version:2,snapshot:{role:'host'}},{nonce:'p',version:1,snapshot:null,retry:true}]);
});
