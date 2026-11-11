import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import { arcadeFinalizeRoomCasGuard } from "../server/arcade/room";

const start = (code = "MAGA", count = 2) => {
  const room = createRoomState(code, { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "magic-arena" }, 50_000);
  for (let seat = 1; seat <= count; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 50_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-magic-arena", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
};
const act = (room: ReturnType<typeof start>, playerId: string, action: "strike" | "guard" | "focus", now: number, round = room.magicArena!.round) => applyPlayerAction(room, playerId, { type: "SUBMIT_MAGIC_ARENA_ACTION", actionId: `move-${playerId}-${round}-unique`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.magicArena!.matchId, round, action } } as never, now).next;
const hostMove = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_MAGIC_ARENA", actionId: `host-move-${room.magicArena!.round}-${transition}-unique`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.magicArena!.matchId, round: room.magicArena!.round, transition } } as never, now).next;

test("Magic Arena preserves its two-player duel, private simultaneous choices, and supports full-round tied replay", () => {
  let room = start(); const matchId = room.magicArena!.matchId; assert.equal(room.magicArena!.players.length, 2); assert.deepEqual(room.magicArena!.players, ["player-1", "player-2"]);
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-magic-arena", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 50_002).next;
  room = applyHostAction(paused, { type: "RESUME", actionId: "resume-magic-arena", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 55_000).next;
  assert.equal(room.magicArena?.deadline, 84_999);
  room = act(room, "player-1", "focus", 55_002);
  const own = playerSnapshot(room, room.participants[0]!, 55_002).magicArena!;
  assert.equal(own.ownAction, "focus");
  const other = playerSnapshot(room, room.participants[1]!, 55_002).magicArena!;
  assert.equal("ownAction" in other, false);
  assert.equal("ownAction" in (hostSnapshot(room, 55_002).magicArena ?? {}), false);
  const audience = audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, 55_002).magicArena!;
  assert.equal("ownAction" in audience, false);
  assert.throws(() => act(room, "player-1", "guard", 55_003), /ALREADY_LOCKED/);
  assert.throws(() => act(room, "player-3", "focus", 55_003), /UNAUTHORIZED/);
  assert.throws(() => act(room, "player-2", "focus", 55_003, 2), /ROUND_MISMATCH/);
  room = act(room, "player-2", "focus", 55_004);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).magicArena, room.magicArena);
  room = hostMove(room, "reveal", 55_005);
  assert.deepEqual(hostSnapshot(room, 55_005).magicArena?.roundResults[0]?.actions, { "player-1": "focus", "player-2": "focus" });
  let now = 55_005;
  for (let round = 2; round <= 5; round += 1) {
    room = hostMove(room, "next", ++now);
    room = act(room, "player-1", "focus", ++now);
    room = act(room, "player-2", "focus", ++now);
    room = hostMove(room, "reveal", ++now);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.magicArena?.result?.outcome, "draw"); assert.equal(room.magicArena?.roundResults.length, 5);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).magicArena, room.magicArena);
  const replay = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "replay-magic-arena", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, 56_000).next;
  assert.equal(replay.code, "MAGA"); assert.equal(replay.phase, "LOBBY"); assert.equal(replay.magicArena, null);
  assert.equal(matchId, room.arcadeMatch?.id);
});

test("Magic Arena timeout fills every missing move with Focus and recovers from D1 deadline without a live client", async () => {
  const room = start("MGTI"); const match = room.magicArena!;
  assert.equal((await advanceState(room, match.deadline + 1_999)).changed, false);
  const recovered = await advanceState(room, match.deadline + 2_000);
  assert.equal(recovered.changed, true); assert.equal(recovered.next.phase, "ARCADE_ACTIVE");
  assert.equal(recovered.next.magicArena?.roundResults[0]?.outcome, "timeout");
  assert.deepEqual(recovered.next.magicArena?.roundResults[0]?.actions, { "player-1": "focus", "player-2": "focus" });
  assert.deepEqual(deserializeRoomState(serializeRoomState(recovered.next)).magicArena, recovered.next.magicArena);
});

test("Magic Arena winner result satisfies the D1 finalization guard", () => {
  let room = start("MAGW"); let now = 60_000; let finalEffects: ReturnType<typeof applyHostAction>["effects"] = [];
  const firstMoves = ["strike", "focus", "strike", "focus", "strike"] as const;
  for (let round = 1; round <= 5; round += 1) {
    room = act(room, "player-1", firstMoves[round - 1]!, ++now);
    room = act(room, "player-2", "focus", ++now);
    const revealed = applyHostAction(room, { type: "ADVANCE_MAGIC_ARENA", actionId: `winner-reveal-${round}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.magicArena!.matchId, round, transition: "reveal" } } as never, ++now);
    room = revealed.next;
    if (round === 5) finalEffects = revealed.effects;
    else room = hostMove(room, "next", ++now);
  }
  assert.equal(room.magicArena?.result?.winnerPlayerId, "player-1");
  assert.doesNotThrow(() => arcadeFinalizeRoomCasGuard(finalEffects, room.id));
});
