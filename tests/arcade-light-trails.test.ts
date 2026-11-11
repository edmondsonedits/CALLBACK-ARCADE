import assert from "node:assert/strict";
import test from "node:test";
import {
  LIGHT_TRAILS_HEIGHT, LIGHT_TRAILS_STEP_MS, LIGHT_TRAILS_WIDTH, lightTrailsGame,
  createLightTrailsState, stepLightTrails,
} from "../arcade-worker/src/games/light-trails";
import { getArcadeGame } from "../arcade-worker/src/games/registry";

const players = ["p1", "p2"] as const;
const noEmit = () => undefined;

test("Light Trails creates the same bounded board and spawn layout for the same match", () => {
  const first = createLightTrailsState("seed", 1_000, players);
  const second = createLightTrailsState("seed", 1_000, players);
  assert.deepEqual(first, second);
  assert.equal(first.trail.length, LIGHT_TRAILS_WIDTH * LIGHT_TRAILS_HEIGHT);
  assert.equal(lightTrailsGame.minPlayers, 2);
  assert.equal(lightTrailsGame.maxPlayers, 10);
  assert.deepEqual(lightTrailsGame.inputKinds, ["position"]);
  assert.equal(lightTrailsGame.inputCooldownMs, 100);
  assert.equal((lightTrailsGame as typeof lightTrailsGame & { persistInputImmediately?: boolean }).persistInputImmediately, false);
  assert.equal((lightTrailsGame as typeof lightTrailsGame & { snapshotEveryTicks?: number }).snapshotEveryTicks, 6);
  assert.equal((lightTrailsGame as typeof lightTrailsGame & { persistEveryTicks?: number }).persistEveryTicks, 6);
  assert.equal((lightTrailsGame as typeof lightTrailsGame & { restoreLatestInputOnLoad?: boolean }).restoreLatestInputOnLoad, true);
  assert.equal(getArcadeGame("light-trails"), lightTrailsGame);
  assert.throws(() => createLightTrailsState("bad", 0, ["p1", "p1"]), /INVALID_MATCH/);
});

test("normalized phone positions choose discrete steering and reject reverse or malformed input", () => {
  const state = createLightTrailsState("steer", 1_000, players);
  const input = { kind: "position" as const, playerId: "p1", seq: 1, x: 0.5, y: 0.1, receivedAt: 1_100 };
  assert.equal(lightTrailsGame.validateInput?.(state, input, 1_100), true);
  lightTrailsGame.applyInput(state, input, { now: 1_100, emit: noEmit });
  assert.equal(state.riders[0]?.direction, "up");
  assert.equal(lightTrailsGame.validateInput?.(state, { ...input, seq: 2, x: 0.5, y: 0.95 }, 1_200), false);
  assert.equal(lightTrailsGame.validateInput?.(state, { ...input, seq: 2, x: 2, y: 0.5 }, 1_200), false);
  assert.equal(lightTrailsGame.validateInput?.(state, { ...input, seq: 2, x: 0.5, y: 0.1 }, 1_120), false);
  assert.equal(lightTrailsGame.validateInput?.(state, { ...input, playerId: "spectator", seq: 2 }, 1_200), false);
});

test("fixed-step simulation is deterministic, bounded, and detects simultaneous collisions", () => {
  const first = createLightTrailsState("collision", 1_000, players);
  const second = createLightTrailsState("collision", 1_000, players);
  for (const state of [first, second]) {
    const [a, b] = state.riders;
    assert.ok(a && b);
    a.x = 57; a.y = 31; a.direction = "right";
    b.x = 59; b.y = 31; b.direction = "left";
    state.trail[31 * LIGHT_TRAILS_WIDTH + 57] = 1;
    state.trail[31 * LIGHT_TRAILS_WIDTH + 59] = 2;
    stepLightTrails(state, LIGHT_TRAILS_STEP_MS, { now: 1_200, emit: noEmit });
    assert.equal(a.alive, false);
    assert.equal(b.alive, false);
    assert.equal(state.status, "complete");
  }
  assert.deepEqual(first, second);
  assert.deepEqual(lightTrailsGame.finalResult?.(first), { winners: ["p1", "p2"], tied: true, distance: { p1: 0, p2: 0 } });
});

test("shared 60 Hz Worker frames move trails at a smooth bounded 10 Hz grid rate", () => {
  const state = createLightTrailsState("worker-cadence", 1_000, players);
  const initial = state.riders.map(({ x, y }) => ({ x, y }));
  for (let frame = 1; frame <= 5; frame += 1) stepLightTrails(state, 1000 / 60, { now: 1_000 + frame * (1000 / 60), emit: noEmit });
  assert.equal(state.tick, 0);
  assert.deepEqual(state.riders.map(({ x, y }) => ({ x, y })), initial);
  stepLightTrails(state, 1000 / 60, { now: 1_100, emit: noEmit });
  assert.equal(state.tick, 1);
  assert.deepEqual(state.riders.map(({ x, y }) => ({ x, y })), [{ x: 5, y: 4 }, { x: 58, y: 31 }]);
});

test("wall collision completes with the surviving rider as winner and emits one final result", () => {
  const state = createLightTrailsState("winner", 1_000, players);
  const rider = state.riders[0]!;
  rider.x = LIGHT_TRAILS_WIDTH - 1;
  rider.y = 1;
  rider.direction = "right";
  state.trail[rider.y * LIGHT_TRAILS_WIDTH + rider.x] = 1;
  const events: Record<string, unknown>[] = [];
  stepLightTrails(state, LIGHT_TRAILS_STEP_MS, { now: 1_200, emit: (event) => events.push(event) });
  assert.equal(rider.alive, false);
  assert.deepEqual(lightTrailsGame.finalResult?.(state), { winners: ["p2"], tied: false, distance: { p1: 0, p2: 1 } });
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventId, "winner:final");
  assert.equal(events[0]?.playerId, null);
});

test("deadline ranks surviving riders by distance and reports a tie only for equal rides", () => {
  const state = createLightTrailsState("deadline-rank", 1_000, players);
  state.riders[0]!.distance = 25;
  state.riders[1]!.distance = 24;
  const events: Record<string, unknown>[] = [];
  stepLightTrails(state, LIGHT_TRAILS_STEP_MS, { now: state.deadlineAt, emit: (event) => events.push(event) });
  assert.deepEqual(lightTrailsGame.finalResult?.(state), { winners: ["p1"], tied: false, distance: { p1: 25, p2: 24 } });
  assert.equal(events.length, 1);
});

test("snapshots expose only public board state and the completion result", () => {
  const state = createLightTrailsState("snapshot", 1_000, players);
  const host = lightTrailsGame.snapshot(state, 4, { role: "host", playerId: null });
  const player = lightTrailsGame.snapshot(state, 4, { role: "player", playerId: "p1" });
  assert.deepEqual((host.state as { viewer: unknown }).viewer, { role: "host", playerId: null });
  assert.deepEqual((player.state as { viewer: unknown }).viewer, { role: "player", playerId: "p1" });
  assert.equal("lastInput" in (player.state as object), false);
  assert.equal("matchId" in (player.state as object), false);
  const encodedTrail = (host.state as { trail?: unknown }).trail;
  assert.equal(typeof encodedTrail, "string");
  assert.equal((encodedTrail as string).length, LIGHT_TRAILS_WIDTH * LIGHT_TRAILS_HEIGHT);
  assert.equal((encodedTrail as string)[4 * LIGHT_TRAILS_WIDTH + 4], "1");
  state.riders[0]!.x = 63; state.riders[0]!.y = 0; state.riders[0]!.direction = "right";
  stepLightTrails(state, LIGHT_TRAILS_STEP_MS, { now: 1_200, emit: noEmit });
  const completed = lightTrailsGame.snapshot(state, 5, { role: "spectator", playerId: null });
  assert.ok((completed.state as { result?: unknown }).result);
});

test("pause preserves the remaining duration, freezes movement, and malformed persisted states fail closed", () => {
  const state = createLightTrailsState("pause", 1_000, players);
  const originalDeadline = state.deadlineAt;
  lightTrailsGame.pause?.(state, 2_000);
  const frozen = structuredClone(state);
  stepLightTrails(state, LIGHT_TRAILS_STEP_MS, { now: 500_000, emit: noEmit });
  assert.deepEqual(state, frozen);
  assert.equal(lightTrailsGame.validateInput?.(state, { kind: "position", playerId: "p1", seq: 1, x: 0, y: 0, receivedAt: 2_001 }, 2_001), false);
  lightTrailsGame.resume?.(state, 602_000);
  assert.equal(state.deadlineAt, 602_000 + (originalDeadline - 2_000));
  const invalid = structuredClone(state);
  invalid.trail.pop();
  assert.throws(() => lightTrailsGame.snapshot(invalid, 1, { role: "host", playerId: null }), /INVALID_STATE/);
});
