import assert from "node:assert/strict";
import test from "node:test";
import type { PracticeGameModule, PracticeInput } from "../lib/arcade/practice/types";
import {
  advancePracticeSession,
  createPracticeSession,
  disposePracticeSession,
  resetPracticeSession,
  setPracticeSessionInput,
  setPracticeSessionPaused,
} from "../lib/arcade/practice/runner";

interface FixtureState { ticks: number; x: number; terminal: boolean; resetNo: number }
const fixture: PracticeGameModule<FixtureState, FixtureState> = {
  id: "sumo",
  createState() { return { ticks: 0, x: 0, terminal: false, resetNo: 0 }; },
  step(state: FixtureState, input: PracticeInput) {
    const next = { ...state, ticks: state.ticks + 1, x: state.x + input.x };
    if (next.ticks >= 5) next.terminal = true;
    return next;
  },
  snapshot(state) { return { ...state }; },
  isTerminal(state) { return state.terminal; },
};

test("practice runner accumulates fixed steps, sequences held input, and bounds catch-up", () => {
  const session = createPracticeSession(fixture, { playerId: "practice-player", seed: 17 });
  setPracticeSessionInput(session, { x: 1, y: 0, buttons: {} });
  const first = advancePracticeSession(session, 50);
  assert.equal(first.tick, 1);
  assert.equal(first.inputSequence, 1);
  const stalled = advancePracticeSession(session, 1_000);
  assert.equal(stalled.tick, 4);
  assert.equal(stalled.inputSequence, 4);
  assert.equal(stalled.state.x, 4);
});

test("practice runner quickly resets terminal attempts and resumes without exposing a result", () => {
  const session = createPracticeSession(fixture, { playerId: "practice-player", seed: 17, resetCueMs: 100 });
  advancePracticeSession(session, 3 * (1000 / 30));
  const terminal = advancePracticeSession(session, 2 * (1000 / 30));
  assert.equal(terminal.resetPending, true);
  assert.equal("result" in terminal, false);
  const reset = advancePracticeSession(session, 100);
  assert.equal(reset.resetPending, false);
  assert.equal(reset.state.ticks, 0);
  assert.equal(reset.resetCount, 1);
  assert.equal(advancePracticeSession(session, 1000 / 30).tick, 1);
});

test("manual reset uses a new deterministic seed and disposal clears input and stepping", () => {
  const session = createPracticeSession(fixture, { playerId: "practice-player", seed: 17 });
  setPracticeSessionInput(session, { x: 1, y: 0, buttons: { action: true } });
  advancePracticeSession(session, 1000 / 30);
  const reset = resetPracticeSession(session, 18);
  assert.equal(reset.seed, 18);
  assert.equal(reset.state.ticks, 0);
  assert.equal(reset.inputSequence, 0);
  setPracticeSessionPaused(session, true);
  assert.equal(advancePracticeSession(session, 500).tick, 0);
  setPracticeSessionPaused(session, false);
  disposePracticeSession(session);
  assert.equal(advancePracticeSession(session, 500).tick, 0);
});

test("pausing clears held input and deterministic seeds create identical state", () => {
  const a = createPracticeSession(fixture, { playerId: "practice-player", seed: 123 });
  const b = createPracticeSession(fixture, { playerId: "practice-player", seed: 123 });
  assert.deepEqual(a.state, b.state);
  setPracticeSessionInput(a, { x: 1, y: 0, buttons: {} });
  advancePracticeSession(a, 1000 / 30);
  const xBeforePause = a.state.x;
  setPracticeSessionPaused(a, true);
  setPracticeSessionPaused(a, false);
  assert.equal(advancePracticeSession(a, 1000 / 30).state.x, xBeforePause);
});
