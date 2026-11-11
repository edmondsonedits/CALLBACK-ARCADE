import assert from "node:assert/strict";
import test from "node:test";
import {
  AIR_HOCKEY_STEP_MS,
  airHockeyGame,
  applyAirHockeyInput,
  createAirHockeyState,
  pauseAirHockey,
  resumeAirHockey,
  stepAirHockey,
  toAirHockeySnapshot,
} from "../arcade-worker/src/games/air-hockey";
import { getArcadeGame } from "../arcade-worker/src/games/registry";

const players = ["player-a", "player-b"] as const;

test("creates deterministic server state for the same seed", () => {
  assert.deepEqual(createAirHockeyState("match-1", 1_000, players), createAirHockeyState("match-1", 1_000, players));
});

test("accepts bounded input only from a match player", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  applyAirHockeyInput(state, players[0], { seq: 1, x: 1, y: 0 }, 1_001);
  assert.equal(state.paddles[0].x, 468);
  assert.equal(state.paddles[0].y, 32);
  assert.throws(() => applyAirHockeyInput(state, "spectator", { seq: 1, x: 0, y: 0 }, 1_002), /WRONG_PLAYER/);
});

test("rejects non-finite, out-of-range, stale, and over-rate inputs", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  assert.throws(() => applyAirHockeyInput(state, players[0], { seq: 1, x: Number.NaN, y: 0.5 }, 1_010), /INVALID_INPUT/);
  assert.throws(() => applyAirHockeyInput(state, players[0], { seq: 1, x: 1.1, y: 0.5 }, 1_010), /INVALID_INPUT/);
  applyAirHockeyInput(state, players[0], { seq: 3, x: 0.5, y: 0.5 }, 1_020);
  assert.throws(() => applyAirHockeyInput(state, players[0], { seq: 2, x: 0.4, y: 0.5 }, 1_060), /STALE_INPUT/);
  assert.throws(() => applyAirHockeyInput(state, players[0], { seq: 4, x: 0.4, y: 0.5 }, 1_040), /INPUT_RATE_LIMITED/);
  state.deadlineAt = 1_030;
  assert.throws(() => applyAirHockeyInput(state, players[0], { seq: 4, x: 0.4, y: 0.5 }, 1_030), /MATCH_COMPLETE/);
});

test("keeps each paddle inside its bounded half of the table", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  applyAirHockeyInput(state, players[0], { seq: 1, x: 1, y: 1 }, 1_050);
  applyAirHockeyInput(state, players[1], { seq: 1, x: 0, y: 0 }, 1_050);
  assert.ok(state.paddles[0].x <= 470 && state.paddles[0].x >= 50);
  assert.ok(state.paddles[0].y <= 568 && state.paddles[0].y >= 32);
  assert.ok(state.paddles[1].x <= 950 && state.paddles[1].x >= 530);
  assert.ok(state.paddles[1].y <= 568 && state.paddles[1].y >= 32);
});

test("reflects the puck from the wall and paddle", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  state.puck = { x: 500, y: 17, vx: 0, vy: -240, serveTicks: 0 };
  stepAirHockey(state, 1000 / 60, 1_020);
  assert.ok(state.puck.vy > 0);

  state.puck = { x: 175, y: 300, vx: -240, vy: 0, serveTicks: 0 };
  stepAirHockey(state, 1000 / 60, 1_040);
  assert.ok(state.puck.vx > 0);
});

test("scores a goal once, resets the puck, and emits a stable goal event", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  const events: Record<string, unknown>[] = [];
  state.puck = { x: 2, y: 300, vx: -240, vy: 0, serveTicks: 0 };
  stepAirHockey(state, 1000 / 60, 1_050, (event) => events.push(event));
  assert.deepEqual(state.score, { [players[0]]: 0, [players[1]]: 1 });
  assert.equal(state.puck.x, 500);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, "match-1:goal:1");
  stepAirHockey(state, 1000 / 60, 1_066, (event) => events.push(event));
  assert.equal(events.length, 1);
});

test("finishes at the deadline and reports a tie without choosing a winner", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  state.score[players[0]] = 2;
  state.score[players[1]] = 2;
  state.deadlineAt = 2_000;
  const events: Record<string, unknown>[] = [];
  stepAirHockey(state, 1000 / 60, 2_000, (event) => events.push(event));
  assert.equal(state.status, "complete");
  assert.deepEqual(airHockeyGame.finalResult(state), { winners: [], tied: true, score: { [players[0]]: 2, [players[1]]: 2 } });
  assert.equal(events.filter((event) => event.type === "result").length, 1);
});

test("a long pause preserves the remaining deadline when the match resumes", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  const remaining = state.deadlineAt - 2_000;
  pauseAirHockey(state, 2_000);
  const pausedPuck = structuredClone(state.puck);
  stepAirHockey(state, AIR_HOCKEY_STEP_MS, 300_000);
  assert.deepEqual(state.puck, pausedPuck);
  assert.throws(() => applyAirHockeyInput(state, players[0], { seq: 1, x: 0.5, y: 0.5 }, 2_001), /MATCH_PAUSED/);
  resumeAirHockey(state, 602_000);
  assert.equal(state.deadlineAt - 602_000, remaining);
  assert.equal(state.pausedAt, null);
});

test("a rematch seed produces distinct deterministic final event IDs", () => {
  const first = createAirHockeyState("match-1", 1_000, players);
  const rematch = createAirHockeyState("match-2", 2_000, players);
  first.deadlineAt = 1_001;
  rematch.deadlineAt = 2_001;
  const firstEvents: Record<string, unknown>[] = [];
  const rematchEvents: Record<string, unknown>[] = [];
  stepAirHockey(first, AIR_HOCKEY_STEP_MS, first.deadlineAt, (event) => firstEvents.push(event));
  stepAirHockey(rematch, AIR_HOCKEY_STEP_MS, rematch.deadlineAt, (event) => rematchEvents.push(event));
  assert.equal(firstEvents[0]?.eventId, "match-1:final");
  assert.equal(rematchEvents[0]?.eventId, "match-2:final");
});

test("uses match-stable event IDs across duplicate result callbacks", () => {
  const state = createAirHockeyState("stable-seed", 1_000, players);
  state.deadlineAt = 1_001;
  const ids: string[] = [];
  stepAirHockey(state, 1000 / 60, 1_002, (event) => ids.push(String(event.eventId)));
  stepAirHockey(state, 1000 / 60, 1_020, (event) => ids.push(String(event.eventId)));
  assert.deepEqual(ids, ["stable-seed:final"]);
});

test("publishes only the public compact state and registers Air Hockey", () => {
  const state = createAirHockeyState("match-1", 1_000, players);
  const snapshot = toAirHockeySnapshot(state, 12);
  assert.equal(snapshot.gameId, "air-hockey");
  assert.equal(snapshot.tick, 12);
  assert.equal("seed" in (snapshot.state as object), false);
  assert.equal("lastInput" in (snapshot.state as object), false);
  assert.equal(getArcadeGame("air-hockey"), airHockeyGame);
});
