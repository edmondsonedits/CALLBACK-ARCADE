import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Execute the shared HTTP/realtime action service with isolated persistence.
const source=readFileSync(new URL('../server/room-actions.ts',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'').replace(/^export /gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const action={type:'REMOVE_PLAYER',actionId:'remove-once',payload:{playerId:'child-player'}};
function harness({prior=false,reject=false,cleanupFails=false,role='host'}={}){
 const events:string[]=[];
 const state={id:'room-id',code:'ABCD',gameLength:'pictures',phase:'LOBBY',version:1};
 const scope={Response,setTimeout,Math,console,blocksNewArchivedGame:()=>false,isArchivedGamePack:()=>false,
  processedAction:async()=>prior?{ok:true,version:2}:null,
  applyHostAction:()=>{events.push('apply');if(reject)throw Error('Invalid player');return {next:{...state,version:2},effects:[]};},
  persistMutation:async()=>{events.push('commit');return true;},
  sessionService:async()=>({removeSessionMemberForChild:async(code:string,id:string)=>{events.push(`revoke:${code}:${id}`);if(cleanupFails)throw Error('Membership busy');}}),
  noStoreHeaders:()=>({}),apiError:(_code:string,message:string,status:number)=>Response.json({error:message},{status}),
  errorResponse:()=>Response.json({error:'retry'},{status:503}),
 };
 const execute=runInNewContext(compiled+'\nexecuteHostRoomAction;',scope) as (auth:()=>Promise<unknown>,input:unknown)=>Promise<Response>;
 return {events,run:()=>execute(async()=>({role,state}),action)};
}
test('successful shared host removal revokes parent membership after the child commit',async()=>{
 const h=harness();assert.equal((await h.run()).status,200);assert.deepEqual(h.events,['apply','commit','revoke:ABCD:child-player']);
});
test('idempotent host removal retries unfinished parent revocation without another child mutation',async()=>{
 const h=harness({prior:true});const response=await h.run();assert.equal(response.status,200);assert.deepEqual(h.events,['revoke:ABCD:child-player']);
});
test('unauthorized and rejected child removals cannot revoke parent membership',async()=>{
 const denied=harness({role:'player'});assert.equal((await denied.run()).status,401);assert.deepEqual(denied.events,[]);
 const rejected=harness({reject:true});assert.equal((await rejected.run()).status,503);assert.deepEqual(rejected.events,['apply']);
});
test('a failed parent revocation reports failure after commit so the same action can retry',async()=>{
 const h=harness({cleanupFails:true});assert.equal((await h.run()).status,503);assert.deepEqual(h.events,['apply','commit','revoke:ABCD:child-player']);
});
