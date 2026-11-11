import assert from "node:assert/strict";
import test from "node:test";
import type { PracticeGameModule, PracticeInput } from "../lib/arcade/practice/types";
import sumo from "../lib/arcade/practice/games/sumo";
import roller from "../lib/arcade/practice/games/roller-ruckus";
import { createSkyBallsState, stepSkyBalls } from "../lib/arcade/practice/games/sky-balls";
import { SKY_BALLS_CONFIG } from "../lib/arcade/practice/games/sky-balls-config";
import twisted from "../lib/arcade/practice/games/twisted-system";
import rubble from "../lib/arcade/practice/games/rubble-alliance";
import tailblazer from "../lib/arcade/practice/games/tailblazer";
import volt from "../lib/arcade/practice/games/volt-vault";

const neutral: PracticeInput = { sequence: 0, x: 0, y: 0, buttons: {} };
const games = [
  ["sumo", () => import("../lib/arcade/practice/games/sumo")],
  ["roller-ruckus", () => import("../lib/arcade/practice/games/roller-ruckus")],
  ["sky-balls", () => import("../lib/arcade/practice/games/sky-balls")],
  ["twisted-system", () => import("../lib/arcade/practice/games/twisted-system")],
  ["rubble-alliance", () => import("../lib/arcade/practice/games/rubble-alliance")],
  ["tailblazer", () => import("../lib/arcade/practice/games/tailblazer")],
  ["volt-vault", () => import("../lib/arcade/practice/games/volt-vault")],
] as const;

test("movement practice games start without a one-player win and reach a natural reset boundary", async () => {
  for (const [id, load] of games) {
    const { default: module } = await load() as { default: PracticeGameModule };
    assert.equal(module.id, id);
    let state = module.createState("trainee", 1927);
    assert.equal(module.isTerminal(state), false, `${id} should start alive`);
    for (let sequence = 0; sequence < 20_000 && !module.isTerminal(state); sequence++) {
      state = module.step(state, { ...neutral, sequence });
    }
    assert.equal(module.isTerminal(state), true, `${id} should report death or normal attempt completion`);
    assert.doesNotThrow(() => structuredClone(module.snapshot(state)), `${id} snapshots should be serializable`);
  }
});

test("Sumo and Roller Ruckus apply seeded movement input to momentum", () => {
  const sumoState = sumo.step(sumo.createState("trainee", 7), { sequence: 1, x: 1, y: 0, buttons: {} });
  const rollerState = roller.step(roller.createState("trainee", 7), { sequence: 1, x: 1, y: 0, buttons: {} });
  assert.ok(sumoState.players.trainee!.vx > 0);
  assert.ok(rollerState.players.trainee!.vx > 0);
});

test("Sky Balls bounces off unattended solo arena walls", () => {
  const state = createSkyBallsState(["trainee"], 31);
  state.balls = [{ id: 1, x: SKY_BALLS_CONFIG.halfSize - SKY_BALLS_CONFIG.ballRadius - 0.01, y: 0, vx: 5, vy: 0 }];
  const next = stepSkyBalls(state, {});
  assert.ok(next.balls[0]!.vx < 0);
  assert.equal(next.players.trainee!.health, state.players.trainee!.health);
});

test("Twisted System reveals the first action cue at its deterministic cue tick", () => {
  let state = twisted.createState("trainee", 71);
  const initial = twisted.snapshot(state) as { cueSequence: Array<{ requiredAction: string | null; cueTick: number }> };
  assert.equal(initial.cueSequence[0]!.requiredAction, null);
  const cueTick = initial.cueSequence[0]!.cueTick;
  for (let sequence = 1; sequence <= cueTick; sequence++) state = twisted.step(state, { ...neutral, sequence });
  const revealed = twisted.snapshot(state) as typeof initial;
  assert.ok(revealed.cueSequence[0]!.requiredAction === "jump" || revealed.cueSequence[0]!.requiredAction === "duck");
});

test("Rubble Alliance damages the floor, terminates on a gap, and resets to a fresh floor", () => {
  let state = rubble.createState("trainee", 51);
  state = rubble.step(state, { ...neutral, sequence: 1 });
  assert.ok(state.floor.tiles.some((tile) => tile.state === "damaged"));
  for (let sequence = 2; sequence < 200 && !rubble.isTerminal(state); sequence++) state = rubble.step(state, { ...neutral, sequence });
  assert.equal(rubble.isTerminal(state), true);
  const fresh = rubble.createState("trainee", 52);
  assert.ok(fresh.floor.tiles.every((tile) => tile.state === "safe"));
});

test("Tailblazer collision ends the attempt and a new state restores its trail", () => {
  let state = tailblazer.createState("trainee", 93);
  for (let sequence = 0; sequence < 500 && !tailblazer.isTerminal(state); sequence++) state = tailblazer.step(state, { ...neutral, sequence });
  assert.equal(tailblazer.isTerminal(state), true);
  const fresh = tailblazer.createState("trainee", 93);
  assert.equal(fresh.players.trainee!.alive, true);
  assert.equal(fresh.trails[0]!.segments.length, 1);
});

test("Volt Vault ends on its survival endpoint and resets its hazard telegraph", () => {
  let state = volt.createState("trainee", 123);
  for (let sequence = 1; sequence < 3_000 && !volt.isTerminal(state); sequence++) state = volt.step(state, { ...neutral, sequence });
  assert.equal(volt.isTerminal(state), true);
  const fresh = volt.createState("trainee", 124);
  assert.equal(fresh.hazard.phase, "warning");
  assert.equal(fresh.players.trainee!.lives, 3);
});
