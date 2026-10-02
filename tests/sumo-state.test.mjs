import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
test('Sumo updates the public snapshot with debug display disabled',async()=>{
 const html=await readFile('games/royal-sumo/source/index.html','utf8');const body=html.slice(html.indexOf('function updateDebug(){'),html.indexOf('function applyScenario(name){'));
 const context=vm.createContext({debugOn:false,fighters:[],VERSION:'test',scenarioMode:null,phase:'fight',round:1,roundTime:90,fps:60,camera:{fov:50,position:{toArray:()=>[0,0,0]}},cameraDebug:{},currentArenaRadius:10,BASE_ARENA_RADIUS:10,crowdArenaScale:()=>({radiusBonus:0}),shrinkStage:0,shrinkProgress:0,MAX_PLAYERS:10,configuredFighterCount:10,humanSlots:new Set([0]),crowns:Array(10).fill(0),window:{},debugPanel:{set textContent(x){throw Error('hidden panel rendered');}}});
 vm.runInContext(body+'\nupdateDebug();',context);assert.equal(context.window.__ROYAL_SUMO_STATE__?.multiplayer.fighterCount,10);context.roundTime=89;vm.runInContext('updateDebug();',context);assert.equal(context.window.__ROYAL_SUMO_STATE__.time,89);
});
