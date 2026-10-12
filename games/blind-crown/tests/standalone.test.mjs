import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const html = await readFile(new URL('../source/index.html', import.meta.url));
const scripts = [...html.toString('utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const expected = '9de02410af76047081cdfff3fe19a0e70641c75a31ae9ded5f7eef0831b0f681';
function engine() {
  const entry = scripts.find(([, , code]) => code.includes('deterministic, authoritative match rules'));
  assert.ok(entry, 'Complete engine must be embedded in standalone');
  const context = vm.createContext({});
  vm.runInContext(entry[2], context, { timeout: 5000 });
  return context.BlindCrown;
}
function match() {
  const { Match } = engine();
  const game = new Match({ time: 8, bots: 0 });
  const a = game.addPlayer('A');
  const b = game.addPlayer('B');
  game.begin();
  return { game, a, b };
}

test('Nightfall v1.6 tactical HTML matches the verified active-build bytes exactly', () => {
  assert.equal(html.length, 188322);
  assert.equal(createHash('sha256').update(html).digest('hex'), expected);
});
test('Embedded classic scripts compile without rewriting source', () => {
  assert.ok(scripts.length > 3);
  for (const [, attrs, code] of scripts) {
    if (/type\s*=\s*["'](?:module|importmap|application\/json)["']/i.test(attrs)) continue;
    new vm.Script(code);
  }
});
test('Planning remains private and locking does not skip countdown', () => {
  const { game, a, b } = match();
  const privateState = game.state(a.id);
  assert.ok('x' in privateState.players.find(p => p.id === a.id));
  assert.ok(!('x' in privateState.players.find(p => p.id === b.id)));
  assert.ok(game.state(null, true).players.every(p => !('x' in p) && !('a' in p)));
  game.lock(a.id, true); game.lock(b.id, true); game.update(0.1);
  assert.equal(game.phase, 'planning');
});
test('Cover blocks both shots and open-lane simultaneous kills survive import', () => {
  const blocked = match();
  Object.assign(blocked.a, { x:150, y:320, a:0 });
  Object.assign(blocked.b, { x:820, y:320, a:Math.PI });
  blocked.game.fire();
  assert.equal(blocked.game.shots.length, 2);
  assert.ok(blocked.game.shots.every(s => s.hit === null));
  const open = match();
  Object.assign(open.a, { x:200, y:390, a:0 });
  Object.assign(open.b, { x:800, y:390, a:Math.PI });
  open.game.fire();
  assert.ok(open.game.shots.every(s => s.hit !== null));
  for(let i=0; i<22; i++) open.game.update(.15);
  assert.equal(open.game.players.filter(p => p.alive).length, 0);
});
test('Default Classic match supports ten contestants including bots', () => {
  const { Match } = engine();
  const game = new Match({ bots:9 });
  game.addPlayer('Player'); game.addBots(9); game.begin();
  assert.equal(game.players.length, 10);
  assert.equal(game.state().settings.ruleset, 'classic');
});

test('Original v1.4 remains recoverable and deterministic engine is unchanged', async () => {
  const original = await readFile(new URL('../source/original/blind-crown-v1.4.html', import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'), '496131ad8031a58b8b2ec78cc1aace73f57ab1ca0646271b383bf48bb108c462');
  const originalScripts = [...original.toString('utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const select = list => list.find(([, , code]) => code.includes('deterministic, authoritative match rules'))[2];
  assert.equal(select(scripts), select(originalScripts));
});
