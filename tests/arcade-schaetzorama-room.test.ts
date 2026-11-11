import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import { getSchaetzoramaResult } from "../server/arcade/schaetzorama";

const base = { contentMode: "party", timerAccessibility: false } as const;

function started(now = 1_000) {
  const room = createRoomState("ESTM", { ...base, gameLength: "arcade", arcadeGameId: "schaetzorama" }, now);
  for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-estimates", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 1).next;
}

function playerAction(playerId: string, estimate: number, _version: number, round: number, actionId = `${playerId}-estimate-${round}`, matchId = "") {
  return { type: "SUBMIT_SCHAETZORAMA_ESTIMATE", actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { estimate, round, matchId } } as const;
}

function hostAdvance(actionId: string, matchId: string, round: number, transition: "reveal" | "advance") {
  return { type: "ADVANCE_ARCADE", actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round, transition } } as const;
}

test("Schaetzorama setup creates a typed active match and persists through room serialization", () => {
  const room = started();
  assert.equal(room.phase, "ARCADE_ACTIVE");
  assert.equal(room.arcadeMatch?.gameId, "schaetzorama");
  assert.equal(room.schaetzorama?.matchId, room.arcadeMatch?.id);
  assert.equal(room.deadlineAt, room.schaetzorama?.deadline);
  const restored = deserializeRoomState(serializeRoomState(room));
  assert.deepEqual(restored.schaetzorama, room.schaetzorama);
  assert.equal(HostActionSchema.safeParse(hostAdvance("host-advance-round-1", room.schaetzorama!.matchId, 1, "reveal")).success, true);
});

test("estimates require a strict valid action, active human player, current round and current match", () => {
  const active = started();
  const match = active.schaetzorama!;
  const prompt = match.prompts[0]!;
  assert.equal(PlayerActionSchema.safeParse(playerAction("player-1", prompt.min, 0, 1, undefined, match.matchId)).success, true);
  assert.equal(PlayerActionSchema.safeParse({ ...playerAction("player-1", prompt.min, 0, 1, undefined, match.matchId), payload: { estimate: prompt.min, round: 1, matchId: match.matchId, extra: true } }).success, false);
  assert.throws(() => applyPlayerAction(active, "player-1", playerAction("player-1", prompt.min - 1, match.version, 1, undefined, match.matchId) as never, active.schaetzorama!.updatedAt + 1), /INVALID_INPUT/);
  assert.throws(() => applyPlayerAction(active, "outsider", playerAction("outsider", prompt.min, match.version, 1, undefined, match.matchId) as never, match.updatedAt + 1), /UNAUTHORIZED/);
  const inactive = structuredClone(active);
  inactive.participants[0]!.active = false;
  assert.throws(() => applyPlayerAction(inactive, "player-1", playerAction("player-1", prompt.min, match.version, 1, undefined, match.matchId) as never, match.updatedAt + 1), /UNAUTHORIZED/);
  const submitted = applyPlayerAction(active, "player-1", playerAction("player-1", prompt.min, match.version - 1, 1, "stale-ui-version", match.matchId) as never, match.updatedAt + 1).next;
  assert.equal(submitted.schaetzorama?.rounds[0]?.submissions["player-1"], prompt.min);
  assert.throws(() => applyPlayerAction(submitted, "player-1", playerAction("player-1", prompt.max, match.version - 1, 1, "locked-player", match.matchId) as never, match.updatedAt + 2), /ALREADY_LOCKED/);
  assert.throws(() => applyPlayerAction(active, "player-1", playerAction("player-1", prompt.min, match.version, 2, undefined, match.matchId) as never, match.updatedAt + 1), /ROUND_CLOSED/);
});

test("players can submit from the same round snapshot and old match actions are rejected after Play Again", () => {
  const active = started();
  const initial = active.schaetzorama!;
  const firstEstimate = applyPlayerAction(active, "player-1", playerAction("player-1", initial.prompts[0]!.min, initial.version, 1, "same-snapshot-p1", initial.matchId) as never, initial.updatedAt + 1).next;
  const secondEstimate = applyPlayerAction(firstEstimate, "player-2", playerAction("player-2", initial.prompts[0]!.max, initial.version, 1, "same-snapshot-p2", initial.matchId) as never, initial.updatedAt + 2).next;
  assert.equal(Object.keys(secondEstimate.schaetzorama!.rounds[0]!.submissions).length, 2);

  let finished = secondEstimate;
  let now = initial.updatedAt + 2;
  for (const player of finished.participants.filter((participant) => participant.id === "player-3")) {
    const match = finished.schaetzorama!;
    finished = applyPlayerAction(finished, player.id, playerAction(player.id, match.prompts[0]!.answer, match.version, 1, "same-round-p3", match.matchId) as never, now + 1).next;
    now += 1;
  }
  finished = applyHostAction(finished, hostAdvance("finish-next-1", finished.schaetzorama!.matchId, finished.schaetzorama!.round, "advance"), now + 1).next;
  now += 1;
  for (let round = 2; round <= 5; round += 1) {
    for (const player of finished.participants.filter((participant) => participant.role === "player")) {
      const match = finished.schaetzorama!;
      finished = applyPlayerAction(finished, player.id, playerAction(player.id, match.prompts[round - 1]!.answer, match.version, round, `finish-${player.id}-${round}`, match.matchId) as never, now + 1).next;
      now += 1;
    }
    if (round < 5) { finished = applyHostAction(finished, hostAdvance(`finish-next-${round}`, finished.schaetzorama!.matchId, finished.schaetzorama!.round, "advance"), now + 1).next; now += 1; }
  }
  finished = applyHostAction(finished, hostAdvance("finish-finalize", finished.schaetzorama!.matchId, finished.schaetzorama!.round, "advance"), now + 1).next;
  const oldMatchId = finished.arcadeMatch!.id;
  const lobby = applyHostAction(finished, { type: "PLAY_AGAIN", actionId: "play-again-old-match-test", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, now + 2).next;
  const nextMatch = applyHostAction(lobby, { type: "START_GAME", actionId: "start-new-match-test", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 3).next;
  const next = nextMatch.schaetzorama!;
  assert.notEqual(next.matchId, oldMatchId);
  assert.throws(() => applyPlayerAction(nextMatch, "player-1", playerAction("player-1", next.prompts[0]!.min, next.version, 1, "late-old-match", oldMatchId) as never, now + 4), /ARCADE_MATCH_MISMATCH/);
});

test("host and display hide every estimate before reveal while each player sees only their own", () => {
  let room = started();
  const match = room.schaetzorama!;
  const estimate = match.prompts[0]!.min;
  room = applyPlayerAction(room, "player-1", playerAction("player-1", estimate, match.version, 1, undefined, match.matchId) as never, match.updatedAt + 1).next;
  const host = hostSnapshot(room, room.updatedAt) as typeof hostSnapshot extends (...args: never[]) => infer R ? R & { schaetzorama?: { estimates: unknown[]; answer?: number } } : never;
  const player1 = playerSnapshot(room, room.participants[0]!, room.updatedAt) as ReturnType<typeof playerSnapshot> & { schaetzorama?: { estimate?: number; estimates: unknown[]; answer?: number } };
  const player2 = playerSnapshot(room, room.participants[1]!, room.updatedAt) as ReturnType<typeof playerSnapshot> & { schaetzorama?: { estimate?: number; estimates: unknown[]; answer?: number } };
  assert.deepEqual(host.schaetzorama?.estimates, []);
  assert.equal(host.schaetzorama?.answer, undefined);
  assert.equal(player1.schaetzorama?.estimate, estimate);
  assert.deepEqual(player1.schaetzorama?.estimates, []);
  assert.equal(player2.schaetzorama?.estimate, undefined);
  assert.deepEqual(player2.schaetzorama?.estimates, []);
});

test("last estimate reveals the round, host advances rounds, and the completed result finalizes Arcade D1 effects", () => {
  let room = started();
  let now = room.schaetzorama!.updatedAt;
  const matchId = room.arcadeMatch!.id;
  for (let round = 1; round <= 5; round += 1) {
    for (const player of room.participants.filter((participant) => participant.role === "player")) {
      const match = room.schaetzorama!;
      const action = playerAction(player.id, match.prompts[round - 1]!.answer, match.version, round, `${player.id}-${round}`, match.matchId);
      room = applyPlayerAction(room, player.id, action as never, now + 1).next;
      now += 1;
    }
    if (round < 5) {
      assert.equal(room.schaetzorama?.phase, "revealing");
      room = applyHostAction(room, hostAdvance(`host-next-${round}`, room.schaetzorama!.matchId, room.schaetzorama!.round, "advance"), now + 1).next;
      now += 1;
      assert.equal(room.schaetzorama?.round, round + 1);
      assert.equal(room.deadlineAt, room.schaetzorama?.deadline);
    }
  }
  assert.equal(room.schaetzorama?.phase, "revealing");
  const finalized = applyHostAction(room, hostAdvance("host-finalize", room.schaetzorama!.matchId, room.schaetzorama!.round, "advance"), now + 1);
  room = finalized.next;
  assert.equal(room.phase, "ARCADE_RESULTS");
  assert.equal(room.arcadeMatch?.status, "COMPLETE");
  assert.equal(room.arcadeMatch?.endedAt, now + 1);
  assert.equal(room.arcadeMatch?.result && (room.arcadeMatch.result as { matchId: string }).matchId, matchId);
  const persisted = deserializeRoomState(serializeRoomState(room));
  assert.equal(persisted.phase, "ARCADE_RESULTS");
  assert.deepEqual(persisted.arcadeMatch?.result, room.arcadeMatch?.result);
  assert.deepEqual(persisted.schaetzorama, room.schaetzorama);
  const finalEffect = finalized.effects.find((effect) => effect.type === "arcade_finalize");
  assert.ok(finalEffect && finalEffect.type === "arcade_finalize");
  assert.equal(finalEffect.event.eventId, `${matchId}:schaetzorama:complete`);
  assert.equal(finalEffect.event.matchId, matchId);
  assert.equal(finalEffect.event.type, "result");
  assert.deepEqual(finalEffect.event.payload, room.arcadeMatch?.result);
  assert.deepEqual(getSchaetzoramaResult(room.schaetzorama!), room.arcadeMatch?.result);
  const playAgain = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "play-again-estimates", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, now + 2).next;
  assert.equal(playAgain.phase, "LOBBY");
  assert.equal(playAgain.arcadeMatch, null);
  assert.equal(playAgain.schaetzorama, null);
  assert.equal(playAgain.matchNumber, 2);
});

test("deadline advance reveals submitted estimates, and paused or elapsed rounds reject submissions", () => {
  let room = started();
  const match = room.schaetzorama!;
  room = applyPlayerAction(room, "player-1", playerAction("player-1", match.prompts[0]!.min, match.version, 1, undefined, match.matchId) as never, match.updatedAt + 1).next;
  const pauseAt = match.updatedAt + 1;
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-estimates", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, pauseAt).next;
  assert.throws(() => applyPlayerAction(paused, "player-2", playerAction("player-2", match.prompts[0]!.max, paused.schaetzorama!.version, 1, undefined, match.matchId) as never, paused.updatedAt + 1), /GAME_PAUSED/);
  const resumeAt = pauseAt + 60_000;
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-estimates", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, resumeAt).next;
  assert.ok(resumed.deadlineAt! > match.deadline);
  assert.throws(() => applyPlayerAction(resumed, "player-2", playerAction("player-2", match.prompts[0]!.max, resumed.schaetzorama!.version, 1, undefined, match.matchId) as never, resumed.deadlineAt!) , /DEADLINE_PASSED/);
  const timeout = applyHostAction(resumed, hostAdvance("timeout-reveal", resumed.schaetzorama!.matchId, resumed.schaetzorama!.round, "reveal"), resumed.deadlineAt! + 60_000);
  assert.equal(timeout.next.schaetzorama?.phase, "revealing");
  assert.deepEqual(timeout.next.schaetzorama?.rounds[0]?.winners, ["player-1"]);
});

test("Schaetzorama cannot pause or resume while a round is revealing", () => {
  const startedRoom = started();
  let room = startedRoom;
  for (const player of room.participants.filter((participant) => participant.role === "player")) {
    const current = room.schaetzorama!;
    room = applyPlayerAction(room, player.id, playerAction(player.id, current.prompts[0]!.answer, current.version, 1, `reveal-${player.id}`, current.matchId) as never, current.updatedAt + 1).next;
  }
  assert.equal(room.schaetzorama?.phase, "revealing");
  assert.throws(() => applyHostAction(room, { type: "PAUSE", actionId: "pause-during-reveal", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, room.schaetzorama!.updatedAt + 1), /ARCADE_REVEAL_NO_PAUSE/);
  const legacyPausedReveal = structuredClone(room);
  legacyPausedReveal.paused = true;
  legacyPausedReveal.remainingMs = 10_000;
  assert.throws(() => applyHostAction(legacyPausedReveal, { type: "RESUME", actionId: "resume-during-reveal", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, room.schaetzorama!.updatedAt + 2), /ARCADE_REVEAL_NO_PAUSE/);
});

test("an overdue host timer can reveal an empty round then start the next round from that timestamp", () => {
  const room = started();
  const overdueAt = room.schaetzorama!.deadline + 120_000;
  const revealed = applyHostAction(room, hostAdvance("overdue-empty-reveal", room.schaetzorama!.matchId, room.schaetzorama!.round, "reveal"), overdueAt).next;
  assert.equal(revealed.schaetzorama?.phase, "revealing");
  assert.deepEqual(revealed.schaetzorama?.rounds[0]?.winners, []);
  assert.equal(revealed.deadlineAt, null);
  assert.doesNotThrow(() => deserializeRoomState(serializeRoomState(revealed)));
  const nextRound = applyHostAction(revealed, hostAdvance("overdue-empty-next-round", revealed.schaetzorama!.matchId, revealed.schaetzorama!.round, "advance"), overdueAt + 1).next;
  assert.equal(nextRound.schaetzorama?.round, 2);
  assert.equal(nextRound.schaetzorama?.phase, "estimating");
  assert.equal(nextRound.deadlineAt, overdueAt + 1 + 45_000);
});

test("room synchronization authoritatively reveals Schaetzorama after the deadline if the host timer was missed", async () => {
  const room = started();
  const deadline = room.schaetzorama!.deadline;
  const beforeRecovery = await advanceState(room, deadline + 1_999);
  assert.equal(beforeRecovery.changed, false);
  const transition = await advanceState(room, deadline + 2_000);
  assert.equal(transition.changed, true);
  assert.equal(transition.next.phase, "ARCADE_ACTIVE");
  assert.equal(transition.next.schaetzorama?.phase, "revealing");
  assert.equal(transition.next.deadlineAt, null);
  assert.equal(transition.actionId, `arcade-timeout:${room.arcadeMatch!.id}:1`);
});

test("a delayed reveal action cannot advance a round already revealed by room synchronization", async () => {
  const room = started();
  const match = room.schaetzorama!;
  const delayedReveal = {
    type: "ADVANCE_ARCADE",
    actionId: "delayed-reveal-after-sync",
    roundId: "lobby",
    expectedPhase: "ARCADE_ACTIVE",
    payload: { matchId: match.matchId, round: match.round, transition: "reveal" },
  } as const;
  const recovered = await advanceState(room, match.deadline + 2_000);
  assert.equal(recovered.next.schaetzorama?.phase, "revealing");
  const staleAdvance = (payload: { matchId: string; round: number; transition: "reveal" | "advance" }) => ({ ...delayedReveal, payload });
  assert.throws(() => applyHostAction(recovered.next, staleAdvance({ ...delayedReveal.payload, matchId: "old-match" }) as never, match.deadline + 2_001), /STALE_ARCADE_TRANSITION/);
  assert.throws(() => applyHostAction(recovered.next, staleAdvance({ ...delayedReveal.payload, round: 2, transition: "advance" }) as never, match.deadline + 2_001), /STALE_ARCADE_TRANSITION/);
  assert.throws(() => applyHostAction(recovered.next, staleAdvance(delayedReveal.payload) as never, match.deadline + 2_001), /STALE_ARCADE_TRANSITION/);
  assert.equal(recovered.next.schaetzorama?.round, 1);
  assert.equal(recovered.next.schaetzorama?.phase, "revealing");
});
