import test from 'node:test';
import assert from 'node:assert/strict';
import { ONLINE_HOSTED_GAMES } from '../lib/arcade/online/catalog';
import { getOnlineEngine } from '../lib/arcade/online/engines';
import { restoreSumoSim, type PackedSumoSim } from '../lib/arcade/online/sumo-codec';

type View = { fighters?: unknown[]; racers?: unknown[]; players?: unknown[]; sim?: PackedSumoSim; snapshot?: { players?: Record<string, unknown>; state?: { players?: unknown[]; riders?: Record<string, unknown> } } };
for (const game of ONLINE_HOSTED_GAMES) test(`${game.id} has exactly the selected sparse contestants with zero or partial bots`, () => {
  const engine = getOnlineEngine(game.id)!;
  for (const bots of [[], ['07']]) {
    let state = engine.create(['02', '07'], 123, { players: 2 }, bots);
    for (let tick = 0; tick < 30; tick++) state = engine.step(state, {}, bots);
    const result = engine.publicState(state); const view = result.view as View;
    const count = game.id === 'sumo' ? restoreSumoSim(view.sim!).fighters.length : view.fighters?.length ?? view.racers?.length ?? view.players?.length ?? view.snapshot?.state?.players?.length ?? Object.keys(view.snapshot?.players ?? view.snapshot?.state?.riders ?? {}).length;
    assert.equal(count, 2); assert.deepEqual(Object.keys(result.scores).sort(), ['02', '07']);
    assert.ok(result.winners.every(id => ['02', '07'].includes(id)));
  }
});
