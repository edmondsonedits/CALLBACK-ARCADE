import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = id => readFile(new URL(`../games/${id}/source/index.html`, import.meta.url), 'utf8');
const spaceSource = await read('space-bash');
const scratchSource = await read('royal-scratch-match');
const noop = () => {};
const element = () => ({ classList: { add: noop, remove: noop, toggle: noop }, style: {}, textContent: '' });

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing runtime section: ${start}`);
  return source.slice(from, to);
}

// Execute the real round/physics and keyboard code. Only browser presentation,
// audio and unrelated movement/collision work are stubbed for deterministic tests.
function spaceGame({ wins = [2, 0], health = [100, 90], alive = [true, true] } = {}) {
  const listeners = {};
  const actions = [];
  const results = [];
  const game = {
    Math, paused: false, phase: 'fight', phaseT: 0, timeLeft: .001,
    spawnT: 100, round: 3, playerCount: 2, wins: [...wins],
    joy: { x: 0, z: 0 }, particles: [], flash: 0,
    TUNE: { move: { max: 4, drag: 1, airDrag: 1 }, gravity: 8 },
    rules: { winTarget: 3, name: 'Orbital Breakout' },
    clearInput: noop,
    showResults: (winner, timedOut) => results.push({ winner: winner.id, timedOut }),
    clamp: (n, a, b) => Math.max(a, Math.min(b, n)),
    say: noop, beep: noop, updateHUD: noop, collide: noop,
    updateCrates: noop, ai: noop, tileAlive: () => true, spawnCrate: noop,
    countdown: element(),
    fighters: health.map((hp, id) => ({
      id, name: `P${id}`, alive: alive[id], falling: false, hp,
      stagger: 0, anim: 0, kickCd: 0, jumpCd: 0, boost: 0, slow: 0,
      grounded: true, x: id, z: 0, y: 0, vx: 0, vz: 0, vy: 0,
    })),
    resetRound() { game.phase = 'countdown'; },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    grabThrow: () => actions.push('grab'),
    kick: () => actions.push('kick'),
    jump: () => actions.push('jump'),
  };
  vm.createContext(game);
  vm.runInContext(
    section(spaceSource, 'function checkRound(){', 'function resetRound(){') +
    section(spaceSource, 'function step(dt){', 'function lerpCrowd(){') +
    section(spaceSource, 'const keys={};addEventListener("keydown"', 'setInterval('), game);
  return { game, actions, results, press: code => listeners.keydown({ code, preventDefault: noop }) };
}

for (const winner of [0, 1]) {
  test(`Space Bash ends the match when seat ${winner} earns its third crown on timeout`, () => {
    const { game, results } = spaceGame({ wins: winner ? [0, 2] : [2, 0], health: winner ? [90, 100] : [100, 90] });
    game.step(.01);
    assert.equal(game.wins[winner], 3);
    assert.equal(game.phase, 'match');
    game.step(3);
    assert.equal(game.phase, 'match');
    assert.equal(game.round, 3);
    assert.equal(game.wins[winner], 3, 'Terminal match must not award another crown');
    assert.deepEqual(results, [{ winner, timedOut: true }], 'Results appear exactly once');
  });
}

test('Space Bash timeout ties preserve the existing first-seat health tiebreak', () => {
  const { game } = spaceGame({ health: [100, 100] });
  game.step(.01);
  assert.deepEqual(game.wins, [3, 0]);
  assert.equal(game.phase, 'match');
});

test('Space Bash non-clinching timeout starts another round', () => {
  const { game } = spaceGame({ wins: [0, 0] });
  game.step(.01);
  assert.deepEqual(game.wins, [1, 0]);
  assert.equal(game.phase, 'over');
  game.step(3);
  assert.equal(game.phase, 'countdown');
  assert.equal(game.round, 4);
});

test('Space Bash timeout with no surviving fighter awards no crown', () => {
  const { game } = spaceGame({ alive: [false, false] });
  game.step(.01);
  assert.deepEqual(game.wins, [2, 0]);
  assert.equal(game.phase, 'over');
});

test('Space Bash elimination wins still finish a first-to-three match', () => {
  const { game } = spaceGame({ alive: [true, false] });
  game.checkRound();
  assert.deepEqual(game.wins, [3, 0]);
  assert.equal(game.phase, 'match');
});

for (const [phase, paused] of [['fight', true], ['countdown', false], ['over', false], ['match', false]]) {
  test(`Space Bash keyboard actions are blocked in ${phase}, paused=${paused}`, () => {
    const { game, press, actions } = spaceGame();
    game.phase = phase;
    game.paused = paused;
    for (const code of ['KeyE', 'KeyF', 'Space']) press(code);
    assert.deepEqual(actions, []);
  });
}

test('Space Bash keyboard actions work after resuming an active fight', () => {
  const { game, press, actions } = spaceGame();
  game.paused = true;
  press('KeyE');
  game.paused = false;
  for (const code of ['KeyE', 'KeyF', 'Space']) press(code);
  assert.deepEqual(actions, ['grab', 'kick', 'jump']);
});

function scratchGame() {
  const timers = [];
  const elements = {};
  let fanfares = 0;
  const game = {
    Math, performance: { now: () => 1000 },
    TUNING: { round: { endDelay: .45, maxPhrases: 10 } },
    phase: 'response', phaseClock: 0, players: [{ alive: true }],
    watching: false, runningDemo: false, matchMode: 'match', resize: noop, escapeText: String,
    setControlMode: noop, gameClock: () => 1, gameplayBlocked: () => false,
    bigMsg: element(), smallMsg: element(),
    setTimeout(fn) { timers.push({ fn, cancelled: false }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cancelled = true; },
    initAudio: noop, audioCtx: null,
    initPlayers() {
      game.players = [{ name: 'YOU', alive: true, score: 0, eliminatedAt: null, maxCombo: 0,
        perfect: 0, good: 0, misses: 0, color: '#fff' }];
    },
    notes: [], particles: [], sparks: [], eliminationCounter: 0, phraseIndex: 0,
    totalInputs: 0, totalResolved: 0, countdownAt: 0, countdownStage: 0,
    songTime: 0, lastBeatIndex: 0, screenShake: 0, flash: { a: 0 }, roundStartedAt: 0,
    menu: element(), results: element(), controls: element(), renderPhraseProgress: noop,
    setStatus: noop, ping: noop, document: { documentElement: element(), getElementById: id => elements[id] ??= element() },
    fanfare() { fanfares++; }, ordinal: n => n,
  };
  vm.createContext(game);
  vm.runInContext(
    section(scratchSource, '  let finishQueued=false;', '  let flash=') +
    section(scratchSource, '  function queueRoundEnd(', '  function ordinal('), game);
  return { game, timers, fanfares: () => fanfares };
}

test('Scratch Match cancels a pending round-end timer when restarted', () => {
  const { game, timers } = scratchGame();
  game.queueRoundEnd();
  game.startRound();
  assert.equal(game.phase, 'countdown');
  assert.equal(timers[0].cancelled, true);
});

test('Scratch Match rejects a forced stale round-end callback after restart', () => {
  const { game, timers, fanfares } = scratchGame();
  game.queueRoundEnd();
  game.startRound();
  timers[0].fn(); // Simulate a callback already queued before cancellation.
  assert.equal(game.phase, 'countdown');
  assert.equal(fanfares(), 0);
});

test('Scratch Match old callbacks cannot end a newer round even while it is finishing', () => {
  const { game, timers, fanfares } = scratchGame();
  game.queueRoundEnd();
  game.startRound();
  game.queueRoundEnd();
  game.startRound();
  game.queueRoundEnd();
  timers[0].fn();
  timers[1].fn();
  assert.equal(game.phase, 'finishing');
  assert.equal(fanfares(), 0);
  timers[2].fn();
  assert.equal(game.phase, 'results');
  assert.equal(fanfares(), 1);
  timers[0].fn();
  timers[2].fn();
  assert.equal(fanfares(), 1, 'Repeated callbacks must not render or play results twice');
});

test('Scratch Match queues one timer and finishes normally without a restart', () => {
  const { game, timers, fanfares } = scratchGame();
  game.startRound();
  game.queueRoundEnd();
  game.queueRoundEnd();
  assert.equal(timers.length, 1);
  timers[0].fn();
  assert.equal(game.phase, 'results');
  assert.equal(fanfares(), 1);
});
