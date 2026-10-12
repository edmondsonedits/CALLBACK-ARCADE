import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../source/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const context = vm.createContext({});
for (const marker of ['deterministic, authoritative match rules', 'Blind Crown perspective adapter']) {
  const script = scripts.find(s => s.includes(marker));
  assert.ok(script, `Missing ${marker}`);
  vm.runInContext(script, context, { timeout: 5000 });
}
const E = context.BlindCrown, P = context.CrownPerspective;
const plain = value => JSON.parse(JSON.stringify(value));
function match(settings = {}, count = 2) {
  const game = new E.Match({ bots: 0, time: 8, ...settings }, { seed: 1729 });
  for (let i = 0; i < count; i++) game.addPlayer(`Seat ${i + 1}`);
  assert.equal(game.begin(), true);
  return game;
}
function until(game, phase, limit = 1000) {
  for (let i = 0; i < limit && game.phase !== phase; i++) game.update(.2);
  assert.equal(game.phase, phase, `Did not reach ${phase}`);
}
function privateState(game) {
  for (const viewer of [null, ...game.players.map(p => p.id)]) {
    for (const tv of [false, true]) {
      const state = game.state(viewer, tv);
      assert.equal(state.phase, 'planning');
      assert.deepEqual(plain(state.shots), []);
      assert.deepEqual(plain(state.eliminated), []);
      for (const player of state.players) {
        const visible = !tv && player.id === viewer;
        for (const key of ['x', 'y', 'a']) assert.equal(Object.hasOwn(player, key), visible);
      }
      for (const view of ['first', 'third']) {
        const camera = P.camera(state, tv ? null : viewer, view, E);
        const own = state.players.find(p => p.id === viewer && p.alive);
        assert.equal(camera.target, !tv && own ? viewer : null);
      }
    }
  }
}

test('privacy survives lock/unlock, eliminated viewers, next round and rematch', () => {
  const game = match({}, 4);
  privateState(game);
  game.players[3].alive = false;
  for (const p of game.players.filter(p => p.alive)) {
    assert.equal(game.lock(p.id, true), true);
    assert.equal(game.lock(p.id, false), true);
    game.lock(p.id, true);
  }
  game.update(.2);
  assert.equal(game.phase, 'planning');
  privateState(game);
  game.fire();
  assert.equal(game.shots.length, 3);
  game.advance();
  privateState(game);
  game.begin();
  privateState(game);
  assert.ok(game.players.every(p => p.alive && !p.locked));
});

test('all seats locking cannot skip the deadline; committed plans freeze at reveal', () => {
  const game = match();
  for (const p of game.players) game.lock(p.id, true);
  for (let i = 0; i < 39; i++) game.update(.2);
  assert.equal(game.phase, 'planning');
  assert.ok(game.clock > 0);
  until(game, 'reveal');
  const snapshot = JSON.stringify(game.state());
  assert.equal(game.position(1, 200, 390, 1), false);
  assert.equal(game.lock(1, false), false);
  game.fire();
  assert.equal(JSON.stringify(game.state()), snapshot);
});

for (const arena of Object.keys(E.MAPS)) {
  test(`${arena}: cover faces stop shots at the displayed footprint`, () => {
    const walls = E.shotWalls(arena);
    for (const [i, wall] of E.MAPS[arena].walls.entries()) {
      const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
      const cases = [
        [{ x: wall.x - 40, y: cy, a: 0 }, walls[i].x, 'x'],
        [{ x: wall.x + wall.w + 40, y: cy, a: Math.PI }, walls[i].x + walls[i].w, 'x'],
        [{ x: cx, y: wall.y - 40, a: Math.PI / 2 }, walls[i].y, 'y'],
        [{ x: cx, y: wall.y + wall.h + 40, a: -Math.PI / 2 }, walls[i].y + walls[i].h, 'y'],
      ];
      for (const [position, expected, axis] of cases) {
        assert.equal(E.canPlace(position, 1, arena), true);
        const shot = E.traceShot({ id: 1, ...position }, [], 1, arena);
        assert.equal(shot.material, 'stone');
        assert.equal(shot.hit, null);
        const endpoint = axis === 'x' ? shot.x + shot.dx * shot.dist : shot.y + shot.dy * shot.dist;
        assert.ok(Math.abs(endpoint - expected) < 1e-7);
      }
      assert.equal(E.canPlace({ x: wall.x - 26.9, y: cy }, 1, arena), false);
      assert.equal(E.canPlace({ x: wall.x - 27, y: cy }, 1, arena), true);
      const swept = E.movePosition({ x: wall.x - 40, y: cy }, wall.w + 80, 0, 1, arena);
      assert.ok(swept.x <= wall.x - 27, 'Movement tunneled through cover');
      assert.equal(E.canPlace(swept, 1, arena), true);
    }
  });

  test(`${arena}: retained camera geometry and placements track shrinking rounds`, () => {
    let previous = null;
    for (const round of [1, 4, 8, 13]) {
      const game = match({ arena }); game.round = round;
      const state = game.state(1);
      const geometry = P.geometry(state, E).filter(r => r.kind === 'cover').map(({ x, y, w, h }) => ({ x, y, w, h }));
      assert.deepEqual(plain(geometry), plain(E.shotWalls(arena)));
      const bounds = E.shotBounds(round);
      assert.deepEqual(plain(P.world(state, E).bounds), plain(bounds));
      if (previous) assert.ok(bounds.minX > previous.minX && bounds.maxX < previous.maxX);
      previous = bounds;
      for (const [x, y] of [[0, 0], [1000, 640], [500, 320], [250, 155], [700, 440]]) {
        const position = E.closestPosition(x, y, round, arena);
        assert.equal(E.canPlace(position, round, arena), true);
        assert.equal(E.canPlace(E.movePosition(position, 1500, -1500, round, arena), round, arena), true);
      }
    }
  });
}

test('mutual elimination preserves both committed shots, awards once and breaks a wipe tie by seat', () => {
  const game = match();
  Object.assign(game.players[0], { x: 200, y: 390, a: 0 });
  Object.assign(game.players[1], { x: 800, y: 390, a: Math.PI });
  game.fire();
  assert.deepEqual(plain(game.shots.map(s => s.hit)), [2, 1]);
  assert.ok(game.players.every(p => p.alive && p.kills === 1 && p.points === 110));
  game.fire();
  assert.ok(game.players.every(p => p.kills === 1 && p.points === 110));
  until(game, 'results');
  assert.ok(game.players.every(p => !p.alive));
  until(game, 'final');
  assert.deepEqual(plain(game.winners), [1]);
  const snapshot = JSON.stringify(game.state());
  for (let i = 0; i < 100; i++) game.update(.2);
  assert.equal(JSON.stringify(game.state()), snapshot);
});

test('three-way simultaneous wipe fires every committed shot', () => {
  const game = match({}, 3);
  const spots = [[370, 350], [430, 350], [400, 400]];
  for (let i = 0; i < 3; i++) {
    const [x, y] = spots[i], [tx, ty] = spots[(i + 1) % 3];
    assert.ok(E.canPlace({ x, y }, 1, 'citadel'));
    Object.assign(game.players[i], { x, y, a: Math.atan2(ty - y, tx - x) });
  }
  game.fire();
  assert.deepEqual(plain(game.shots.map(s => s.hit)), [2, 3, 1]);
  until(game, 'final');
  assert.ok(game.players.every(p => !p.alive && p.points === 110));
  assert.deepEqual(plain(game.winners), [1]);
});

test('last survivor beats eliminated higher scorer; round limit uses living points then seat order', () => {
  for (const scenario of ['last-survivor', 'living-score', 'equal-score', 'wipe-score']) {
    const game = match({ roundLimit: 4 }, 3);
    game.phase = 'results'; game.clock = 0; game.round = 4;
    game.players[0].points = 330;
    game.players[1].points = 220;
    game.players[2].points = 110;
    let expected;
    if (scenario === 'last-survivor') {
      game.players[0].alive = game.players[1].alive = false; expected = 3;
    } else if (scenario === 'living-score') {
      game.players[0].alive = false; expected = 2;
    } else if (scenario === 'equal-score') {
      game.players[0].alive = false; game.players[2].points = 220; expected = 2;
    } else {
      game.players.forEach(p => p.alive = false); expected = 1;
    }
    game.update(.2);
    assert.equal(game.phase, 'final');
    assert.deepEqual(plain(game.winners), [expected], scenario);
  }
});

for (const count of [2, 4, 10]) {
  test(`${count} contestants: seeded bot matches finish and rematch discards prior plans/results`, () => {
    for (const arena of Object.keys(E.MAPS)) for (const ruleset of ['classic', 'precision']) for (const seed of [1, 17, 1729]) {
      const game = new E.Match({ bots: count - 1, time: 8, arena, ruleset }, { seed });
      game.addPlayer('Human'); game.addBots(count - 1); game.begin();
      assert.equal(game.players.length, count);
      until(game, 'final', 2500);
      assert.equal(game.winners.length, 1);
      const snapshot = JSON.stringify(game.state());
      game.update(.2);
      assert.equal(JSON.stringify(game.state()), snapshot);
      game.begin();
      privateState(game);
      assert.equal(game.round, 1);
      assert.deepEqual(plain(game.winners), []);
      assert.deepEqual(plain(game.shots), []);
      assert.deepEqual(plain(game.log), []);
      assert.ok(game.players.every(p => p.alive && p.kills === 0 && p.points === 0));
    }
  });
}
