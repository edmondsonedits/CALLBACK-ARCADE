import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import { CHAOS_MISSIONS } from "../server/arcade/chaos_kommando";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";

const start = () => {
  const room = createRoomState("CHAO", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "chaos-kommando" }, 10_000);
  for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 10_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-chaos", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 10_001).next;
};
const submit = (room: ReturnType<typeof start>, playerId: string, toolId: string, now: number) => applyPlayerAction(room, playerId, { type: "SUBMIT_CHAOS_TOOL", actionId: `choose-${playerId}-${room.chaosKommando!.missionNumber}-lock`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.chaosKommando!.matchId, missionNumber: room.chaosKommando!.missionNumber, toolId } }, now).next;
const host = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_CHAOS_KOMMANDO", actionId: `advance-${room.chaosKommando!.missionNumber}-${transition}-lock`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.chaosKommando!.matchId, missionNumber: room.chaosKommando!.missionNumber, transition } }, now).next;

test("Chaos-Kommando enforces three players, locks private tools, resolves four missions, and replays in the same room", () => {
  let room = start(); const matchId = room.chaosKommando!.matchId;
  assert.equal(room.phase, "ARCADE_ACTIVE"); assert.equal(PlayerActionSchema.safeParse({ type: "SUBMIT_CHAOS_TOOL", actionId: "schema-action", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, missionNumber: 1, toolId: "grid-kit" } }).success, true);
  assert.equal(HostActionSchema.safeParse({ type: "ADVANCE_CHAOS_KOMMANDO", actionId: "schema-host-action", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, missionNumber: 1, transition: "reveal" } }).success, true);
  const first = room.chaosKommando!; room = submit(room, "player-1", first.mission.tools[0]!.id, 10_002);
  assert.equal(playerSnapshot(room, room.participants[1]!, 10_002).chaosKommando?.ownToolId, undefined);
  assert.equal(hostSnapshot(room, 10_002).chaosKommando?.submissionCount, 1);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).chaosKommando, room.chaosKommando);
  for (let missionNumber = 1; missionNumber <= 4; missionNumber += 1) {
    const mission = room.chaosKommando!.mission;
    const toolsFor = mission.requiredTags.map((tag) => mission.tools.find((item) => item.tags.some((candidate) => candidate === tag))!);
    room = submit(room, "player-1", toolsFor[0]!.id, 10_010 + missionNumber * 10);
    room = submit(room, "player-2", toolsFor[1]!.id, 10_011 + missionNumber * 10);
    const other = mission.tools.find((item) => !toolsFor.some((tool) => tool.id === item.id))!;
    room = submit(room, "player-3", other.id, 10_012 + missionNumber * 10);
    room = host(room, "reveal", 10_013 + missionNumber * 10);
    if (missionNumber < 4) room = host(room, "next", 10_014 + missionNumber * 10);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.chaosKommando?.missionResults.length, 4); assert.equal(room.chaosKommando?.result?.score, 4_000); assert.equal(room.arcadeMatch?.status, "COMPLETE");
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).chaosKommando, room.chaosKommando);
  const replay = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "replay-chaos", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, 11_000).next;
  assert.equal(replay.phase, "LOBBY"); assert.equal(replay.chaosKommando, null); assert.equal(replay.code, "CHAO");
  const tooFew = createRoomState("SMAL", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "chaos-kommando" }, 10_000);
  for (let seat = 1; seat <= 2; seat += 1) tooFew.participants.push({ id: `p-${seat}`, nickname: `P${seat}`, nicknameNormalized: `p${seat}`, role: "player", seat, avatar: 0, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 10_000, removedAt: null });
  assert.throws(() => applyHostAction(tooFew, { type: "START_GAME", actionId: "small-start", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 10_001), /CHAOS_KOMMANDO_NEEDS_THREE/);
  assert.equal(CHAOS_MISSIONS.length, 4);
});

test("timeout recovery records missing phones as uncovered work and cannot award a full clear", async () => {
  let room = start(); const match = room.chaosKommando!;
  room = submit(room, "player-1", "grid-kit", 10_002);
  assert.equal((await advanceState(room, match.deadline + 1_999)).changed, false);
  const recovered = await advanceState(room, match.deadline + 2_000);
  assert.equal(recovered.changed, true); assert.equal(recovered.next.phase, "ARCADE_ACTIVE"); assert.equal(recovered.next.deadlineAt, null);
  const result = recovered.next.chaosKommando!.missionResults[0]!;
  assert.equal(result.outcome, "timeout"); assert.equal(result.score, 0); assert.deepEqual(result.missingTags, ["power"]); assert.equal(result.submissions.filter((entry) => entry.toolId === null).length, 2);
  assert.deepEqual(deserializeRoomState(serializeRoomState(recovered.next)).chaosKommando, recovered.next.chaosKommando);
});
