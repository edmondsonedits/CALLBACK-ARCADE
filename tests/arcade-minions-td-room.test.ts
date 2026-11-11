import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import type { MinionsTdMatch } from "../server/arcade/minions_td";
import type { HostAction, PlayerAction } from "../lib/contracts";

const matchOf = (room: ReturnType<typeof createRoomState>) => room.minionsTd as MinionsTdMatch;
const start = () => {
  const room = createRoomState("MINION", { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "minions-td" }, 90_000);
  for (const [seat, id] of ["minion-a", "minion-b"].entries()) room.participants.push({ id, nickname: `Commander ${seat + 1}`, nicknameNormalized: `commander ${seat + 1}`, role: "player", seat: seat + 1, avatar: seat, color: "#d6e783", active: true, pendingActivation: false, bot: false, lastSeenAt: 90_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-minions", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 90_001).next;
};
const playerOrder = (room: ReturnType<typeof start>, id: string, order: { type: "deploy"; unitId: "runner" | "brute" | "siege" } | { type: "upgrade" | "brace" | "hold" }, now: number) => applyPlayerAction(room, id, { type: "SUBMIT_MINIONS_TD_ORDER", actionId: `order-${id}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: matchOf(room).matchId, round: matchOf(room).round, order } } satisfies PlayerAction, now).next;
const hostTransition = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_MINIONS_TD", actionId: `host-${transition}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: matchOf(room).matchId, round: matchOf(room).round, transition } } satisfies HostAction, now).next;

test("Minions TD starts exactly two seats, keeps submitted orders private, and serializes the match", () => {
  let room = start();
  assert.deepEqual(matchOf(room).players, ["minion-a", "minion-b"]);
  room = playerOrder(room, "minion-a", { type: "deploy", unitId: "runner" }, 90_002);
  assert.equal("choices" in hostSnapshot(room, 90_002).minionsTd!, false);
  assert.equal("ownOrder" in playerSnapshot(room, room.participants[1]!, 90_002).minionsTd!, false);
  assert.deepEqual(playerSnapshot(room, room.participants[0]!, 90_002).minionsTd?.ownOrder, { type: "deploy", unitId: "runner" });
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).minionsTd, matchOf(room));
});

test("Minions TD pauses and resumes its deadline, recovers missing orders, completes, and replays in the room", async () => {
  let room = start();
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-minions", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 90_002).next;
  room = applyHostAction(paused, { type: "RESUME", actionId: "resume-minions", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 90_500).next;
  assert.equal(room.paused, false);
  room = playerOrder(room, "minion-a", { type: "deploy", unitId: "runner" }, 90_501);
  room = playerOrder(room, "minion-b", { type: "deploy", unitId: "runner" }, 90_502);
  room = hostTransition(room, "reveal", 90_503);
  assert.equal(matchOf(room).roundResults[0]?.timedOut, false);
  room = hostTransition(room, "next", 90_504);
  for (let round = 2; round <= 6; round += 1) {
    const deadline = matchOf(room).deadline;
    assert.equal((await advanceState(room, deadline + 1_999)).changed, false);
    const resolved = await advanceState(room, deadline + 2_000);
    assert.equal(resolved.changed, true);
    room = resolved.next;
    assert.equal(matchOf(room).roundResults.at(-1)?.timedOut, true);
    if (round < 6 && room.phase === "ARCADE_ACTIVE") room = hostTransition(room, "next", matchOf(room).updatedAt + 1);
  }
  assert.equal(room.phase, "ARCADE_RESULTS");
  assert.equal(matchOf(room).phase, "complete");
  assert.ok(matchOf(room).result);
  assert.equal(deserializeRoomState(serializeRoomState(room)).minionsTd?.result?.matchId, matchOf(room).matchId);
  room = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "again-minions", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, matchOf(room).updatedAt + 1).next;
  assert.equal(room.phase, "LOBBY");
  assert.equal(room.minionsTd, null);
  assert.equal(room.arcadeMatch, null);
});
