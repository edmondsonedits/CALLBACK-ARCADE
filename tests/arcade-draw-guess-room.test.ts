import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";

const base = { contentMode: "party", timerAccessibility: false } as const;
function lobby(playerCount = 3, now = 1_000) {
  const room = createRoomState("DRAW", { ...base, gameLength: "arcade", arcadeGameId: "zeichnen-und-erraten" }, now);
  for (let seat = 1; seat <= playerCount; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  return room;
}
function start(playerCount = 3, now = 1_000) {
  return applyHostAction(lobby(playerCount, now), { type: "START_GAME", actionId: "start-draw-game", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 1).next;
}
function playerAction(type: "SUBMIT_DRAW_GUESS_DRAWING" | "SUBMIT_DRAW_GUESS", matchId: string, attempt = 1, guess = "guess", actionId = `action-${type}`) {
  return type === "SUBMIT_DRAW_GUESS_DRAWING"
    ? { type, actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, drawing: [{ color: "#17213d", width: 6, points: [{ x: 50, y: 50 }, { x: 500, y: 500 }] }] } } as const
    : { type, actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, attempt, guess } } as const;
}
function participant(room: ReturnType<typeof start>, id: string) { return room.participants.find((player) => player.id === id)!; }

test("starts in the King Prompter room, requires three players, and round-trips typed state", () => {
  const room = start();
  assert.equal(room.phase, "ARCADE_ACTIVE");
  assert.equal(room.arcadeMatch?.gameId, "zeichnen-und-erraten");
  assert.equal(room.drawGuess?.matchId, room.arcadeMatch?.id);
  assert.equal(room.drawGuess?.phase, "drawing");
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).drawGuess, room.drawGuess);
  assert.equal(PlayerActionSchema.safeParse(playerAction("SUBMIT_DRAW_GUESS_DRAWING", room.drawGuess!.matchId)).success, true);
  assert.equal(PlayerActionSchema.safeParse(playerAction("SUBMIT_DRAW_GUESS", room.drawGuess!.matchId)).success, true);
  assert.equal(HostActionSchema.safeParse({ type: "ADVANCE_DRAW_GUESS", actionId: "reveal-schema", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.drawGuess!.matchId, round: 1 } }).success, true);
  assert.throws(() => applyHostAction(lobby(2), { type: "START_GAME", actionId: "start-draw-small", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1_001), /DRAW_GUESS_NEEDS_THREE/);
});

test("prompt is visible only to artist before reveal; drawing publishes once submitted", () => {
  let room = start();
  const match = room.drawGuess!;
  const artistId = match.artistId;
  const guesserId = match.players.find((id) => id !== artistId)!;
  const artist = playerSnapshot(room, participant(room, artistId), room.updatedAt).drawGuess;
  const guesser = playerSnapshot(room, participant(room, guesserId), room.updatedAt).drawGuess;
  const host = hostSnapshot(room, room.updatedAt).drawGuess;
  const audience = audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, room.updatedAt).drawGuess;
  assert.deepEqual(artist?.assignment, { role: "artist", prompt: match.prompt });
  assert.deepEqual(guesser?.assignment, { role: "guesser" });
  for (const snapshot of [host, guesser, audience]) assert.equal(JSON.stringify(snapshot).includes(match.prompt), false);

  room = applyPlayerAction(room, artistId, playerAction("SUBMIT_DRAW_GUESS_DRAWING", match.matchId, 1, "", "send-drawing") as never, match.updatedAt + 1).next;
  assert.equal(room.drawGuess?.phase, "guessing");
  assert.equal(room.drawGuess?.drawing?.length, 1);
  assert.equal(JSON.stringify(playerSnapshot(room, participant(room, guesserId), room.updatedAt).drawGuess).includes(match.prompt), false);
});

test("independent guess attempts score once, finalize one result event, and replay in the same room", () => {
  let room = start();
  const match = room.drawGuess!;
  const artistId = match.artistId;
  const [first, second] = match.players.filter((id) => id !== artistId) as [string, string];
  let now = match.updatedAt + 1;
  room = applyPlayerAction(room, artistId!, playerAction("SUBMIT_DRAW_GUESS_DRAWING", match.matchId, 1, "", "submit-drawing") as never, now++).next;
  room = applyPlayerAction(room, first!, playerAction("SUBMIT_DRAW_GUESS", match.matchId, 1, "wrong", "wrong-1") as never, now++).next;
  const retry = applyPlayerAction(room, first!, playerAction("SUBMIT_DRAW_GUESS", match.matchId, 1, "wrong", "retry-1") as never, now++).next;
  assert.equal(retry.drawGuess?.guesses.length, 1);
  assert.equal(retry.drawGuess?.version, room.drawGuess?.version);
  assert.throws(() => applyPlayerAction(room, first!, playerAction("SUBMIT_DRAW_GUESS", match.matchId, 3, "skip") as never, now++), /ROUND_CLOSED/);
  const final = applyPlayerAction(room, second!, playerAction("SUBMIT_DRAW_GUESS", match.matchId, 1, match.prompt, "correct-guess") as never, now++);
  assert.equal(final.next.phase, "ARCADE_RESULTS");
  assert.equal(final.next.drawGuess?.winnerId, second);
  assert.equal(final.next.drawGuess?.scores[second!], 1_000);
  assert.equal(final.next.drawGuess?.scores[artistId!], 500);
  assert.equal(final.next.arcadeMatch?.status, "COMPLETE");
  const event = final.effects.find((effect) => effect.type === "arcade_finalize");
  assert.ok(event && event.type === "arcade_finalize");
  assert.equal(event.event.eventId, `${match.matchId}:zeichnen-und-erraten:complete`);
  assert.equal(event.event.playerId, null);
  assert.deepEqual(deserializeRoomState(serializeRoomState(final.next)).drawGuess, final.next.drawGuess);
  const corruptScore = structuredClone(final.next);
  corruptScore.drawGuess!.scores[second!] = 7;
  assert.throws(() => serializeRoomState(corruptScore), /Draw & Guess/);
  const replay = applyHostAction(final.next, { type: "PLAY_AGAIN", actionId: "replay-draw", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, now + 1).next;
  assert.equal(replay.phase, "LOBBY");
  assert.equal(replay.drawGuess, null);
});

test("host reveal and deadline recovery are distinct and pause preserves active drawing time", async () => {
  let room = start();
  const match = room.drawGuess!;
  const revealed = applyHostAction(room, { type: "ADVANCE_DRAW_GUESS", actionId: "host-reveal-draw", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: match.matchId, round: 1 } }, match.updatedAt + 1);
  assert.equal(revealed.next.drawGuess?.outcome, "host_reveal");
  assert.equal(revealed.next.drawGuess?.drawing, undefined);

  room = start();
  const clock = room.drawGuess!;
  const pauseAt = clock.updatedAt + 1;
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-draw", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, pauseAt).next;
  assert.equal(paused.remainingMs, clock.deadline - pauseAt);
  const resumeAt = pauseAt + 5_000;
  room = applyHostAction(paused, { type: "RESUME", actionId: "resume-draw", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, resumeAt).next;
  assert.equal(room.drawGuess?.deadline, resumeAt + (clock.deadline - pauseAt));
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).drawGuess, room.drawGuess);
  const deadline = room.deadlineAt!;
  assert.equal((await advanceState(room, deadline + 1_999)).changed, false);
  const recovered = await advanceState(room, deadline + 2_000);
  assert.equal(recovered.next.phase, "ARCADE_RESULTS");
  assert.equal(recovered.next.drawGuess?.outcome, "timeout");
  assert.ok(Object.values(recovered.next.drawGuess!.scores).every((score) => score === 0));
});
