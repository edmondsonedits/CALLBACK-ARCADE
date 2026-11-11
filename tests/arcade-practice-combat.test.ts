import assert from "node:assert/strict";
import test from "node:test";
import type { PracticeGameModule, PracticeInput } from "../lib/arcade/practice/types";

const neutral: PracticeInput = { sequence: 1, x: 0, y: 0, buttons: {} };
const combats = [
  ["jungle-bash", () => import("../lib/arcade/practice/games/jungle-bash")],
  ["space-bash", () => import("../lib/arcade/practice/games/space-bash")],
  ["snow-bash", () => import("../lib/arcade/practice/games/snow-bash")],
  ["drain-bash", () => import("../lib/arcade/practice/games/drain-bash")],
  ["tie-breaker", () => import("../lib/arcade/practice/games/tie-breaker")],
  ["manic-panic", () => import("../lib/arcade/practice/games/manic-panic")],
] as const;

test("combat practice starts as one live human and reaches only its natural reset boundary", async () => {
  for (const [id, load] of combats) {
    const { default: module } = await load() as { default: PracticeGameModule };
    assert.equal(module.id, id);
    let state = module.createState("trainee", 417);
    assert.equal(module.isTerminal(state), false, `${id} must not win just because it has one player`);
    for (let sequence = 1; sequence <= 12_000 && !module.isTerminal(state); sequence++) {
      state = module.step(state, { ...neutral, sequence });
    }
    assert.equal(module.isTerminal(state), true, `${id} should report death or its regular bout endpoint`);
    assert.doesNotThrow(() => structuredClone(module.snapshot(state)), `${id} snapshots should remain serializable`);
  }
});
import { stepJungleBash, createJungleBashState } from "../lib/arcade/practice/games/jungle-bash-simulation";
import { createJungleBashPracticeState, stepJungleBashPractice } from "../lib/arcade/practice/games/jungle-bash";
import { createSpaceBashState } from "../lib/arcade/practice/games/space-bash";
import { createDestructibleFloor, markFloorTile, stepDestructibleFloor } from "../lib/arcade/practice/games/destructible-floor";

test("Jungle Bash practice supports deterministic crate pickup and throw", () => {
  let state = createJungleBashPracticeState("trainee", 81);
  const player = state.players.trainee!;
  player.x = state.crate!.x;
  player.y = state.crate!.y;
  state = stepJungleBashPractice(state, { sequence: 1, x: 0, y: 0, buttons: { action: true }, pressed: ["action"] });
  assert.equal(state.players.trainee!.carriedCrate, true);
  assert.equal(state.crate, null);
  state = stepJungleBashPractice(state, { sequence: 2, x: 0, y: 0, buttons: { action: true }, pressed: ["action"] });
  assert.equal(state.players.trainee!.carriedCrate, false);
  assert.equal(state.projectiles.length, 1);
});

test("crate impacts reduce health through the shared deterministic combat step", () => {
  const state = createJungleBashState(["thrower", "target"], 23);
  const target = state.players.target!;
  target.invulnerableTicks = 0;
  state.projectiles.push({ ownerId: "thrower", kind: "steel", fuseTicks: null,
    x: target.x - 0.2, y: target.y, vx: 9, vy: 0, age: 0 });
  const next = stepJungleBash(state, {});
  assert.equal(next.players.target!.health, target.health - 1);
});

test("Space Bash floor damage advances through warning to destruction and fresh rounds reset it", () => {
  const floor = createDestructibleFloor(8, 8, 3);
  assert.equal(markFloorTile(floor, 0, 0), true);
  assert.equal(floor.tiles[36]!.state, "damaged");
  stepDestructibleFloor(floor);
  assert.equal(floor.tiles[36]!.state, "cracking");
  stepDestructibleFloor(floor);
  stepDestructibleFloor(floor);
  assert.equal(floor.tiles[36]!.state, "destroyed");
  assert.equal(createSpaceBashState("trainee", 123).floor!.tiles.every((tile) => tile.state === "safe"), true);
});
