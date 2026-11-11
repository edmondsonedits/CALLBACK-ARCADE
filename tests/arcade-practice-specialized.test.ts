import assert from "node:assert/strict";
import test from "node:test";
import type { PracticeControl, PracticeGameModule, PracticeInput } from "../lib/arcade/practice/types";
import dragonDrop from "../lib/arcade/practice/games/dragon-drop";
import jungleFox from "../lib/arcade/practice/games/jungle-fox";
import metalFox from "../lib/arcade/practice/games/metal-fox";
import paintPanic from "../lib/arcade/practice/games/paint-panic";

const neutral: PracticeInput = { sequence: 1, x: 0, y: 0, buttons: {} };

function getPhase(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || !("phase" in snapshot)) return null;
  return typeof snapshot.phase === "string" ? snapshot.phase : null;
}

function assertNoCompetitiveFields(value: unknown): void {
  if (Array.isArray(value)) { for (const child of value) assertNoCompetitiveFields(child); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!["winnerId", "winners", "draw", "result"].includes(key), `snapshot must omit ${key}`);
    assertNoCompetitiveFields(child);
  }
}

async function runChart<State, Snapshot>(id: string, game: PracticeGameModule<State, Snapshot>): Promise<Set<string>> {
  assert.equal(game.id, id);
  let state = game.createState("trainee", 904);
  assert.equal(game.isTerminal(state), false);
  const phases = new Set<string>();
  for (let tick = 1; tick <= 8_000 && !game.isTerminal(state); tick++) {
    state = game.step(state, { ...neutral, sequence: tick });
    const snapshot = game.snapshot(state);
    const phase = getPhase(snapshot);
    if (phase) phases.add(phase);
  }
  assert.equal(game.isTerminal(state), true, `${id} should loop/end its training chart`);
  const finalSnapshot = game.snapshot(state);
  assertNoCompetitiveFields(finalSnapshot);
  assert.doesNotThrow(() => structuredClone(finalSnapshot));
  return phases;
}

async function runActionGame<State, Snapshot>(id: string, game: PracticeGameModule<State, Snapshot>): Promise<void> {
  assert.equal(game.id, id);
  let state = game.createState("trainee", 905);
  const start = structuredClone(game.snapshot(state));
  const actionControls: readonly PracticeControl[] = ["action", "fire", "spray", "special"];
  for (let tick = 1; tick <= 8_000 && !game.isTerminal(state); tick++) {
    const press = tick % 35 === 1;
    const buttons = Object.fromEntries(actionControls.map((control) => [control, press])) as PracticeInput["buttons"];
    state = game.step(state, { sequence: tick, x: 0.5, y: -0.25, buttons, pressed: press ? actionControls : [] });
  }
  assert.equal(game.isTerminal(state), true, `${id} should expose death or its normal end`);
  assert.notDeepEqual(game.snapshot(state), start, `${id} should advance under training input`);
  assertNoCompetitiveFields(game.snapshot(state));
  assert.doesNotThrow(() => structuredClone(game.snapshot(state)));
}

test("rhythm practice preserves its mode flow and automatically ends without awarding results", async () => {
  const scratch = await runChart("scratch-match", (await import("../lib/arcade/practice/games/scratch-match")).default);
  const mystery = await runChart("mystery-beat", (await import("../lib/arcade/practice/games/mystery-beat")).default);
  const rhythm = await runChart("rhythm", (await import("../lib/arcade/practice/games/rhythm")).default);
  assert.equal(scratch.size, 0);
  assert.equal(rhythm.size, 0);
  assert.deepEqual([...mystery].sort(), ["compose", "perform", "preview"]);
});

test("target and tank practice accept movement/actions and reach a reset boundary", async () => {
  await runActionGame("dragon-drop", dragonDrop);
  await runActionGame("jungle-fox", jungleFox);
  await runActionGame("metal-fox", metalFox);
  await runActionGame("paint-panic", paintPanic);
});

test("Dragon Drop moves its target and Paint Panic sprays only on a pressed edge", () => {
  let targetState = dragonDrop.createState("trainee", 111);
  const initialTargetX = targetState.target.x;
  targetState = dragonDrop.step(targetState, neutral);
  assert.notEqual(targetState.target.x, initialTargetX);

  let paintState = paintPanic.createState("trainee", 112);
  paintState = paintPanic.step(paintState, { sequence: 1, x: 0, y: 0, buttons: { spray: true }, pressed: ["spray"] });
  assert.equal(paintState.players.trainee!.sprays, 1);
});

test("both tank practice variants move and fire from discrete control presses", () => {
  for (const game of [jungleFox, metalFox]) {
    let state = game.createState("trainee", 113);
    const startX = state.players.trainee!.x;
    state = game.step(state, { sequence: 1, x: 1, y: 0, buttons: { fire: true }, pressed: ["fire"] });
    assert.ok(state.players.trainee!.x !== startX || state.players.trainee!.vx !== 0);
    assert.equal(state.players.trainee!.shots, 1);
  }
});
