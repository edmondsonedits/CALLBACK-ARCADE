import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceDriftRacer, createDriftRacerMatch, driftRacerSnapshot, getDriftRacerResult, submitDriftRacerInput,
} from "../server/arcade/drift_racer";

const create = (players = ["amber", "blue", "violet"]) => createDriftRacerMatch({ matchId: "drift-match", players, now: 10_000 });
const submit = (state: ReturnType<typeof create>, playerId: string, input: Parameters<typeof submitDriftRacerInput>[1]["input"], now = state.updatedAt + 1) =>
  submitDriftRacerInput(state, { matchId: state.matchId, turn: state.turn, playerId, input, now });
const succeed = <T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> => {
  assert.equal(result.ok, true); return result as Extract<T, { ok: true }>;
};

test("Drift Racer creates deterministic bounded races and hides other drivers' locked inputs", () => {
  const state = create();
  assert.deepEqual(create(), state);
  assert.equal(state.phase, "racing"); assert.equal(state.turn, 1); assert.equal(state.deadline - state.updatedAt, 5_000);
  const locked = succeed(submit(state, "amber", { throttle: "accelerate", steer: 1, drift: false, boost: false }));
  assert.equal("inputs" in driftRacerSnapshot(locked.state, { role: "host" }), false);
  assert.equal("ownInput" in driftRacerSnapshot(locked.state, { role: "player", playerId: "blue" }), false);
  assert.deepEqual(driftRacerSnapshot(locked.state, { role: "player", playerId: "amber" }).ownInput,
    { throttle: "accelerate", steer: 1, drift: false, boost: false });
  assert.throws(() => driftRacerSnapshot(locked.state, { role: "player", playerId: "outsider" }));
});

test("Drift Racer supports a one-player practice run without a winner", () => {
  let state = create(["solo"]);
  for (let turn = 1; turn <= 8 && state.phase === "racing"; turn += 1) {
    const current = state.drivers.solo!;
    const corner = current.distance < 250 ? { distance: 250, lane: 2 } : current.distance < 500 ? { distance: 500, lane: 0 } : current.distance < 750 ? { distance: 750, lane: 1 } : undefined;
    const projected = current.distance + Math.min(120, current.speed + 15);
    const drift = Boolean(corner && projected >= corner.distance);
    const steer = drift ? (corner!.lane === current.lane ? 0 : corner!.lane > current.lane ? 1 : -1) : 0;
    state = succeed(submit(state, "solo", { throttle: "accelerate", steer, drift, boost: turn === 1 })).state;
    state = succeed(advanceDriftRacer(state, { now: state.deadline })).state;
  }
  assert.equal(state.phase, "results");
  assert.equal(getDriftRacerResult(state).winnerPlayerId, null);
  assert.equal(getDriftRacerResult(state).outcome, "practice");
});

test("simultaneous inputs resolve deterministically, drift rewards corners, and boosts are bounded", () => {
  let state = create(["amber", "blue"]);
  for (let turn = 1; turn <= 8 && state.phase === "racing"; turn += 1) {
    for (const playerId of state.players) {
      const current = state.drivers[playerId]!;
      const corner = current.distance < 250 ? { distance: 250, lane: 2 } : current.distance < 500 ? { distance: 500, lane: 0 } : current.distance < 750 ? { distance: 750, lane: 1 } : undefined;
      const boost = turn === 1;
      const projected = current.distance + Math.min(120, current.speed + 15 + (boost ? 18 : 0)) + (boost ? 22 : 0);
      const drift = Boolean(corner && projected >= corner.distance);
      const steer = drift ? (corner!.lane === current.lane ? 0 : corner!.lane > current.lane ? 1 : -1) : 0;
      const result = submit(state, playerId, { throttle: "accelerate", steer, drift, boost });
      state = succeed(result).state;
    }
    const advanced = advanceDriftRacer(state, { now: Math.max(state.updatedAt, state.deadline) });
    state = succeed(advanced).state;
  }
  assert.ok(state.drivers.amber!.distance > 0);
  assert.ok(state.drivers.amber!.distance <= 800);
  assert.ok(state.drivers.amber!.boosts >= 0 && state.drivers.amber!.boosts <= 3);
  assert.equal(state.phase, "results");
  assert.deepEqual(getDriftRacerResult(state), getDriftRacerResult(JSON.parse(JSON.stringify(state))));
});

test("deadline fills absent controllers with safe coast inputs; late writes are rejected", () => {
  const state = create(["amber", "blue"]);
  const amber = succeed(submit(state, "amber", { throttle: "brake", steer: 0, drift: false, boost: false }));
  const timed = advanceDriftRacer(amber.state, { now: amber.state.deadline });
  const resolved = succeed(timed).state;
  assert.equal(resolved.turnResults[0]?.timedOutPlayers.includes("blue"), true);
  assert.equal(resolved.drivers.blue?.distance, 46);
  assert.deepEqual(resolved.turnResults[0]?.inputs.blue, { throttle: "coast", steer: 0, drift: false, boost: false });
  assert.equal(submitDriftRacerInput(resolved, { matchId: state.matchId, turn: 1, playerId: "blue", input: { throttle: "accelerate", steer: 0, drift: false, boost: false }, now: resolved.updatedAt }).ok, false);
});

test("invalid persisted race progress is rejected before snapshots or mutations", () => {
  const state = create(); const invalid = structuredClone(state); invalid.drivers.amber!.boosts = 99;
  assert.throws(() => driftRacerSnapshot(invalid, { role: "host" }));
  assert.equal(advanceDriftRacer(invalid, { now: state.updatedAt }).ok, false);
  assert.throws(() => createDriftRacerMatch({ matchId: "bad", players: [], now: 0 }));
});

test("persisted winner and turn telemetry must agree with authoritative race state", () => {
  let state = create(["amber", "blue"]);
  for (let turn = 1; turn <= 8 && state.phase === "racing"; turn += 1) {
    for (const playerId of state.players) {
      const submitted = submit(state, playerId, { throttle: "accelerate", steer: 0, drift: false, boost: false });
      state = succeed(submitted).state;
    }
    state = succeed(advanceDriftRacer(state, { now: state.deadline })).state;
  }
  assert.equal(state.phase, "results");
  const forged = structuredClone(state); forged.result!.winnerPlayerId = forged.players[1]!;
  assert.equal(advanceDriftRacer(forged, { now: forged.updatedAt }).ok, false);
  const forgedTurn = structuredClone(state); forgedTurn.turnResults.at(-1)!.drivers.amber!.distance -= 1;
  assert.throws(() => driftRacerSnapshot(forgedTurn, { role: "host" }));
});

test("malformed null turn history is rejected without throwing during mutation", () => {
  const initial = create(["amber", "blue"]);
  let state = initial;
  for (const playerId of state.players) state = succeed(submit(state, playerId, { throttle: "accelerate", steer: 0, drift: false, boost: false })).state;
  state = succeed(advanceDriftRacer(state, { now: state.updatedAt })).state;
  const malformed = structuredClone(state);
  malformed.turnResults[0] = null as unknown as typeof malformed.turnResults[number];
  assert.equal(advanceDriftRacer(malformed, { now: state.deadline }).ok, false);
});

test("persisted race history must replay to the stored drivers and reject forged telemetry", () => {
  const initial = create(["amber", "blue"]);
  let state = initial;
  for (const playerId of state.players) state = succeed(submit(state, playerId, { throttle: "accelerate", steer: 0, drift: false, boost: false })).state;
  state = succeed(advanceDriftRacer(state, { now: state.updatedAt })).state;
  const forged = structuredClone(state);
  forged.turnResults[0]!.inputs.amber = { throttle: "brake", steer: 1, drift: true, boost: false };
  assert.equal(advanceDriftRacer(forged, { now: forged.deadline }).ok, false);
});
