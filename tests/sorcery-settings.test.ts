import assert from 'node:assert/strict';
import test from 'node:test';
import {createShowdown,showdownRounds,advanceShowdown,validShowdown} from '../server/arcade/sketch_showdown';

test('new quick Sorcery has two rounds and two-minute drawings; long retains three and four minutes',()=>{
 for(const length of ['quick','long'] as const){
  let state=createShowdown({matchId:'mode',players:['a','b','c'],now:1000,rulesVersion:4,sorceryLength:length});
  assert.equal(showdownRounds(state),length==='quick'?2:3);
  assert.equal(state.chains.length,length==='quick'?6:9);
  state=advanceShowdown(state,state.deadline).state;
  state=advanceShowdown(state,state.deadline).state;
  assert.equal(state.phase,'drawing');
  assert.equal(state.deadline-state.showdown!.phaseStartedAt,length==='quick'?120000:240000);
  assert.ok(validShowdown(state));
 }
});
test('legacy rules remain unchanged',()=>{
 assert.equal(showdownRounds(createShowdown({matchId:'old',players:['a','b','c'],now:1,rulesVersion:2})),2);
 assert.equal(showdownRounds(createShowdown({matchId:'old',players:['a','b','c'],now:1,rulesVersion:3})),3);
});
