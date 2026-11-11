import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import type { SchattenjagdMatch } from "../server/arcade/schattenjagd";

const matchOf = (room: ReturnType<typeof createRoomState>) => (room as unknown as { schattenjagd: SchattenjagdMatch | null }).schattenjagd;
const start = (code = "SHAD") => {
  const room = createRoomState(code, { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "schattenjagd" }, 70_000);
  for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `shadow-${seat}`, nickname: `Shadow ${seat}`, nicknameNormalized: `shadow ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 70_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-shadow", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 70_001).next;
};
const vote = (room: ReturnType<typeof start>, playerId: string, suspectId: string, now: number) => applyPlayerAction(room, playerId, { type: "SUBMIT_SCHATTENJAGD_VOTE", actionId: `shadow-vote-${matchOf(room)!.round}-${playerId}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: matchOf(room)!.matchId, round: matchOf(room)!.round, suspectId } } as never, now).next;
const host = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_SCHATTENJAGD", actionId: `shadow-host-${matchOf(room)!.round}-${transition}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: matchOf(room)!.matchId, round: matchOf(room)!.round, transition } } as never, now).next;

test("Schattenjagd uses role-filtered D1 snapshots and round-trips its private match state", () => {
  let room = start(); const match = matchOf(room)!; const scenario = match.cases[0]!;
  room = vote(room, "shadow-1", scenario.targetId, 70_002);
  const player = playerSnapshot(room, room.participants[0]!, 70_002).schattenjagd!;
  assert.equal(player.ownClue?.id, scenario.clues[0]!.id);
  assert.equal(player.ownSuspectId, scenario.targetId);
  const hostView = hostSnapshot(room, 70_002).schattenjagd!;
  assert.equal("targetId" in hostView, false); assert.equal("clues" in hostView, false); assert.equal("votes" in hostView, false);
  const audience = audienceSnapshot(room, { ...room.participants[0]!, id: "audience-shadow", role: "audience" }, 70_002).schattenjagd!;
  assert.equal("ownClue" in audience, false);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).schattenjagd, matchOf(room));
});

test("Schattenjagd resolves four cases, records scores, recovers timeouts, pauses, and replays in the same room", async () => {
  let room = start("SHAR"); const code = room.code; let now = 70_001;
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-shadow", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, ++now).next;
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-shadow", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, now + 100).next;
  assert.equal(resumed.paused, false); room = resumed; now += 100;
  for (let round = 1; round <= 4; round += 1) {
    const target = matchOf(room)!.cases[round - 1]!.targetId;
    for (const playerId of matchOf(room)!.players) room = vote(room, playerId, target, ++now);
    room = host(room, "reveal", ++now);
    if (round < 4) room = host(room, "next", ++now);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(matchOf(room)?.result?.casesPlayed, 4);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).schattenjagd, matchOf(room));
  const replay = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "replay-shadow", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, ++now).next;
  assert.equal(replay.code, code); assert.equal(replay.phase, "LOBBY"); assert.equal(matchOf(replay), null);

  const pending = start("SHAT"); const deadline = matchOf(pending)!.deadline;
  assert.equal((await advanceState(pending, deadline + 1_999)).changed, false);
  const recovered = await advanceState(pending, deadline + 2_000);
  assert.equal(recovered.changed, true); assert.equal(matchOf(recovered.next)?.caseResults[0]?.timedOut, true);
});

