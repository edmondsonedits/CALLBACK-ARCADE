import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import type { DriftRacerMatch } from "../server/arcade/drift_racer";
import type { HostAction, PlayerAction } from "../lib/contracts";

const matchOf = (room: ReturnType<typeof createRoomState>) => room.driftRacer as DriftRacerMatch;
const start = () => {
  const room = createRoomState("DRIFT", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "drift-racer" }, 120_000);
  for (const [seat, id] of ["drift-a", "drift-b"].entries()) room.participants.push({ id, nickname: `Driver ${seat + 1}`, nicknameNormalized: `driver ${seat + 1}`, role: "player", seat: seat + 1, avatar: seat, color: "#d6e783", active: true, pendingActivation: false, bot: false, lastSeenAt: 120_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-drift", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 120_001).next;
};
const input = (room: ReturnType<typeof start>, id: string, now: number) => applyPlayerAction(room, id, { type: "SUBMIT_DRIFT_RACER_INPUT", actionId: `input-${id}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: matchOf(room).matchId, turn: matchOf(room).turn, throttle: "coast", steer: 0, drift: false, boost: false } } satisfies PlayerAction, now).next;
const advance = (room: ReturnType<typeof start>, now: number) => applyHostAction(room, { type: "ADVANCE_DRIFT_RACER", actionId: `advance-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: matchOf(room).matchId, turn: matchOf(room).turn } } satisfies HostAction, now).next;

test("Drift Racer starts fixed controller seats, filters submitted inputs, and serializes the race", () => {
  let room = start();
  assert.deepEqual(matchOf(room).players, ["drift-a", "drift-b"]);
  room = input(room, "drift-a", 120_002);
  assert.equal("inputs" in hostSnapshot(room, 120_002).driftRacer!, false);
  assert.equal("ownInput" in playerSnapshot(room, room.participants[1]!, 120_002).driftRacer!, false);
  assert.deepEqual(playerSnapshot(room, room.participants[0]!, 120_002).driftRacer?.ownInput, { throttle: "coast", steer: 0, drift: false, boost: false });
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).driftRacer, matchOf(room));
});

test("Drift Racer starts for one human and remains a no-winner practice run", () => {
  const room = createRoomState("SOLO", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "drift-racer" }, 120_000);
  room.participants.push({ id: "solo-driver", nickname: "Solo Driver", nicknameNormalized: "solo driver", role: "player", seat: 1, avatar: 0, color: "#d6e783", active: true, pendingActivation: false, bot: false, lastSeenAt: 120_000, removedAt: null });
  let active = applyHostAction(room, { type: "START_GAME", actionId: "start-solo-drift", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 120_001).next;
  assert.deepEqual(matchOf(active).players, ["solo-driver"]);
  for (let turn = 1; turn <= 8 && active.phase === "ARCADE_ACTIVE"; turn += 1) active = advance(active, matchOf(active).deadline);
  assert.equal(active.phase, "ARCADE_RESULTS");
  assert.equal(matchOf(active).result?.winnerPlayerId, null);
  assert.equal(matchOf(active).result?.outcome, "practice");
});

test("Drift Racer pauses, resumes, resolves timeout turns, completes, and replays in the same room", async () => {
  let room = start();
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-drift", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 120_002).next;
  room = applyHostAction(paused, { type: "RESUME", actionId: "resume-drift", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 120_500).next;
  assert.equal(room.paused, false);
  room = input(room, "drift-a", 120_501);
  room = input(room, "drift-b", 120_502);
  room = advance(room, 120_503);
  assert.equal(matchOf(room).turn, 2);
  for (let turn = 2; turn <= 8; turn += 1) {
    const deadline = matchOf(room).deadline;
    assert.equal((await advanceState(room, deadline + 1_999)).changed, false);
    const resolved = await advanceState(room, deadline + 2_000);
    assert.equal(resolved.changed, true);
    room = resolved.next;
  }
  assert.equal(room.phase, "ARCADE_RESULTS");
  assert.equal(matchOf(room).phase, "results");
  assert.ok(matchOf(room).result);
  assert.equal(deserializeRoomState(serializeRoomState(room)).driftRacer?.result?.matchId, matchOf(room).matchId);
  room = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "again-drift", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, matchOf(room).updatedAt + 1).next;
  assert.equal(room.phase, "LOBBY");
  assert.equal(room.driftRacer, null);
  assert.equal(room.arcadeMatch, null);
});
