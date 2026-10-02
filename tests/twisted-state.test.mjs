import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
test('Twisted publishes a current state with the debug panel disabled', async () => {
  const html = await readFile('games/royal-twisted/source/index.html', 'utf8');
  const body = html.slice(html.indexOf('function updateDebug(){'), html.indexOf('function resize(){'));
  const fighter = { lives: 7, score: 0, jumpY: 0, duck: false, alive: true, trackT: .5, recoverDelay: 0, input: {}, controller: 'ai' };
  const context = vm.createContext({ debugOn: false, fighters: Array.from({length:10},()=>({...fighter})), hazards: [], currentSpeed:()=>1, speedMult:()=>1, PLAYER_T:.5, TUNING:{hit:{recoverSpeed:1}}, VERSION:'test', phase:'fight', round:1, roundTime:90, fps:60, playerCount:10, activePattern:'test', patternQueue:[], choreographyStats:{spawned:0,clamped:0,minGap:99,lastGap:0}, window:{}, debugPanel:{set textContent(value){throw Error('hidden panel must not render');}} });
  vm.runInContext(`${body}\nupdateDebug();`, context);
  assert.equal(context.window.__ROYAL_TWISTED_STATE__?.players, 10);
  assert.equal(context.window.__ROYAL_TWISTED_STATE__?.phase, 'fight');
  context.roundTime = 89;
  vm.runInContext('updateDebug();',context);
  assert.equal(context.window.__ROYAL_TWISTED_STATE__.time, 89);
});
