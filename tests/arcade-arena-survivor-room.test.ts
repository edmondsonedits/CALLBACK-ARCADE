import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";

const base = { contentMode: "party", timerAccessibility: false } as const;
function lobby(playerCount = 3, now = 10_000) {
  const room = createRoomState("SURV", { ...base, gameLength: "arcade", arcadeGameId: "arena-survivor" }, now);
  for (let seat = 1; seat <= playerCount; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  return room;
}
function start(playerCount = 3, now = 10_000) {
  return applyHostAction(lobby(playerCount, now), { type: "START_GAME", actionId: "start-arena-game", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 1).next;
}
function choose(matchId: string, choiceId: string, actionId = "choose-survivor") {
  return { type: "SUBMIT_ARENA_SURVIVOR_CHOICE", actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, choiceId } } as const;
}
function participant(room: ReturnType<typeof start>, id: string) { return room.participants.find((player) => player.id === id)!; }

test("starts native Arena Survivor with a three-player minimum and valid typed state", () => {
  const room = start();
  assert.equal(room.phase, "ARCADE_ACTIVE");
  assert.equal(room.arcadeMatch?.gameId, "arena-survivor");
  assert.equal(room.arenaSurvivor?.matchId, room.arcadeMatch?.id);
  assert.equal(room.deadlineAt, room.arenaSurvivor?.deadline);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).arenaSurvivor, room.arenaSurvivor);
  assert.equal(PlayerActionSchema.safeParse(choose(room.arenaSurvivor!.matchId, room.arenaSurvivor!.scenario.choices[0].id)).success, true);
  assert.equal(HostActionSchema.safeParse({ type: "ADVANCE_ARENA_SURVIVOR", actionId: "reveal-schema", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.arenaSurvivor!.matchId, round: 1 } }).success, true);
  assert.throws(() => applyHostAction(lobby(2), { type: "START_GAME", actionId: "start-arena-small", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 10_001), /ARENA_SURVIVOR_NEEDS_THREE/);
});

test("choices and the successful answer remain private until reveal; one locked choice per player", () => {
  let room = start();
  const match = room.arenaSurvivor!;
  const [playerId, otherId] = match.players;
  const choice = match.scenario.choices[0]!;
  const action = choose(match.matchId, choice.id, "choice-1");
  assert.deepEqual(PlayerActionSchema.safeParse(action).success, true);
  room = applyPlayerAction(room, playerId!, action, match.updatedAt + 1).next;
  assert.equal(room.arenaSurvivor?.choices[playerId!], choice.id);
  assert.equal(playerSnapshot(room, participant(room, playerId!), room.updatedAt).arenaSurvivor?.ownChoiceId, choice.id);
  for (const snapshot of [hostSnapshot(room, room.updatedAt).arenaSurvivor, playerSnapshot(room, participant(room, otherId!), room.updatedAt).arenaSurvivor, audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, room.updatedAt).arenaSurvivor]) {
    assert.equal(snapshot?.ownChoiceId, undefined);
    assert.equal("correctChoiceId" in (snapshot ?? {}), false);
    assert.equal(snapshot?.result, undefined);
    assert.equal(JSON.stringify(snapshot).includes(match.scenario.explanation), false);
  }
  const retry = applyPlayerAction(room, playerId!, choose(match.matchId, choice.id, "choice-retry"), match.updatedAt + 2).next;
  assert.equal(retry.arenaSurvivor?.version, room.arenaSurvivor?.version);
  assert.throws(() => applyPlayerAction(room, playerId!, choose(match.matchId, match.scenario.choices[1]!.id, "change-choice"), match.updatedAt + 2), /ALREADY_LOCKED/);
});

test("host reveal finalizes choice counts, outcome, score event, and same-room replay", () => {
  let room = start();
  const match = room.arenaSurvivor!;
  const [first, second] = match.players;
  const correct = match.successfulChoiceId;
  room = applyPlayerAction(room, first!, choose(match.matchId, correct, "survivor-one"), match.updatedAt + 1).next;
  room = applyPlayerAction(room, second!, choose(match.matchId, match.scenario.choices.find((choice) => choice.id !== correct)!.id, "survivor-two"), match.updatedAt + 2).next;
  const final = applyHostAction(room, { type: "ADVANCE_ARENA_SURVIVOR", actionId: "host-reveal-arena", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: match.matchId, round: 1 } }, match.updatedAt + 3);
  assert.equal(final.next.phase, "ARCADE_RESULTS");
  assert.equal(final.next.arenaSurvivor?.outcome, "revealed");
  assert.equal(final.next.arenaSurvivor?.scores[first!], 1_000);
  assert.equal(final.next.arenaSurvivor?.scores[second!], 0);
  assert.equal(final.next.arcadeMatch?.status, "COMPLETE");
  const event = final.effects.find((effect) => effect.type === "arcade_finalize");
  assert.ok(event && event.type === "arcade_finalize");
  assert.equal(event.event.eventId, `${match.matchId}:arena-survivor:complete`);
  assert.deepEqual(deserializeRoomState(serializeRoomState(final.next)).arenaSurvivor, final.next.arenaSurvivor);
  const corruptScore = structuredClone(final.next);
  corruptScore.arenaSurvivor!.scores[first!] = 7;
  assert.throws(() => serializeRoomState(corruptScore), /Arena Survivor/);
  const replay = applyHostAction(final.next, { type: "PLAY_AGAIN", actionId: "replay-arena", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, match.updatedAt + 4).next;
  assert.equal(replay.phase, "LOBBY");
  assert.equal(replay.arenaSurvivor, null);
});

test("deadline recovery reveals timeout results and pause/resume preserves answer time", async () => {
  let room = start();
  const match = room.arenaSurvivor!;
  const answerer = match.players[0]!;
  const choice = match.scenario.choices[0]!;
  room = applyPlayerAction(room, answerer, choose(match.matchId, choice.id, "timed-choice"), match.updatedAt + 1).next;
  const deadline = room.deadlineAt!;
  assert.equal((await advanceState(room, deadline + 1_999)).changed, false);
  const recovered = await advanceState(room, deadline + 2_000);
  assert.equal(recovered.next.phase, "ARCADE_RESULTS");
  assert.equal(recovered.next.arenaSurvivor?.outcome, "timeout");
  assert.equal(recovered.next.arenaSurvivor?.entries?.length, 3);
  assert.equal(recovered.next.arenaSurvivor?.entries?.filter((entry) => entry.choiceId === null).length, 2);
  assert.deepEqual(deserializeRoomState(serializeRoomState(recovered.next)).arenaSurvivor, recovered.next.arenaSurvivor);

  room = start();
  const pausedAt = room.arenaSurvivor!.updatedAt + 1;
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-arena", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, pausedAt).next;
  const resumeAt = pausedAt + 5_000;
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-arena", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, resumeAt).next;
  assert.equal(resumed.arenaSurvivor?.deadline, resumeAt + (match.deadline - pausedAt));
  assert.deepEqual(deserializeRoomState(serializeRoomState(resumed)).arenaSurvivor, resumed.arenaSurvivor);
});
