import assert from "node:assert/strict";
import test from "node:test";
import { PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import { recordArcadeEvents } from "../server/arcade/room";
import type { DbEffect } from "../server/types";

const base = { contentMode: "party", timerAccessibility: false } as const;

function lobby(playerCount = 3, now = 1_000) {
  const room = createRoomState("BUZZ", { ...base, gameLength: "arcade", arcadeGameId: "buzzwort" }, now);
  for (let seat = 1; seat <= playerCount; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  return room;
}

function start(playerCount = 3, now = 1_000) {
  const room = lobby(playerCount, now);
  return applyHostAction(room, { type: "START_GAME", actionId: "start-buzzwort", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 1).next;
}

function clueAction(playerId: string, matchId: string, attempt: number, text: string, actionId = `${playerId}-clue-${attempt}`) {
  return { type: "SUBMIT_BUZZWORT_CLUE", actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, attempt, text } } as const;
}

function guessAction(playerId: string, matchId: string, attempt: number, guess: string, actionId = `${playerId}-guess-${attempt}`) {
  return { type: "SUBMIT_BUZZWORT_GUESS", actionId, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, attempt, guess } } as const;
}

function playerFor(room: ReturnType<typeof start>, playerId: string) { return room.participants.find((player) => player.id === playerId)!; }

test("Buzzwort room starts as a typed Arcade match and requires three active humans", () => {
  const active = start();
  assert.equal(active.phase, "ARCADE_ACTIVE");
  assert.equal(active.arcadeMatch?.gameId, "buzzwort");
  assert.equal(active.buzzwort?.matchId, active.arcadeMatch?.id);
  assert.equal(active.deadlineAt, active.buzzwort?.deadline);
  assert.deepEqual(deserializeRoomState(serializeRoomState(active)).buzzwort, active.buzzwort);
  assert.throws(() => applyHostAction(lobby(2), { type: "START_GAME", actionId: "start-buzzwort-small", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1_001), /BUZZWORT_NEEDS_THREE/);
});

test("clue and guess actions use server-selected roles and advance attempts authoritatively", () => {
  let room = start();
  const match = room.buzzwort!;
  const giver = match.clueGiverId;
  const guesser = match.guesserId;
  const nonGiver = match.players.find((id) => id !== giver)!;
  assert.equal(PlayerActionSchema.safeParse(clueAction(giver, match.matchId, 1, "A circular path")).success, true);
  assert.equal(PlayerActionSchema.safeParse({ ...clueAction(giver, match.matchId, 1, "A circular path"), payload: { ...clueAction(giver, match.matchId, 1, "A circular path").payload, extra: true } }).success, false);
  assert.throws(() => applyPlayerAction(room, nonGiver, clueAction(nonGiver, match.matchId, 1, "A clue") as never, match.updatedAt + 1), /UNAUTHORIZED/);
  assert.throws(() => applyPlayerAction(room, giver, clueAction(giver, "another-match", 1, "A clue") as never, match.updatedAt + 1), /ARCADE_MATCH_MISMATCH/);

  room = applyPlayerAction(room, giver, clueAction(giver, match.matchId, 1, "A path around something") as never, match.updatedAt + 1).next;
  assert.equal(room.buzzwort?.phase, "guess");
  assert.equal(room.buzzwort?.currentClue, "A path around something");
  assert.equal(room.deadlineAt, match.deadline);
  room = applyPlayerAction(room, guesser, guessAction(guesser, match.matchId, 1, "Not the answer") as never, match.updatedAt + 2).next;
  assert.equal(room.buzzwort?.phase, "clue");
  assert.equal(room.buzzwort?.attempt, 2);
  assert.equal(room.buzzwort?.currentClue, undefined);
  room = applyPlayerAction(room, giver, clueAction(giver, match.matchId, 2, "A long elliptical journey") as never, match.updatedAt + 3).next;
  const finalAction = guessAction(guesser, match.matchId, 2, room.buzzwort!.card.word, "correct-final-guess");
  const final = applyPlayerAction(room, guesser, finalAction as never, match.updatedAt + 4);
  assert.equal(final.next.phase, "ARCADE_RESULTS");
  assert.equal(final.next.buzzwort?.phase, "revealed");
  assert.equal((final.next.arcadeMatch?.result as { outcome?: string } | null)?.outcome, "guessed");
  assert.equal(final.next.arcadeMatch?.status, "COMPLETE");
  const effect = final.effects.find((entry) => entry.type === "arcade_finalize");
  assert.ok(effect && effect.type === "arcade_finalize");
  assert.equal(effect.event.eventId, `${match.matchId}:buzzwort:complete`);
});

test("private word and taboo card only reach the assigned clue giver before the reveal", () => {
  const room = start(5);
  const match = room.buzzwort!;
  const giver = playerSnapshot(room, playerFor(room, match.clueGiverId), room.updatedAt).buzzwort;
  const teammateId = match.players.find((id) => match.roles[id] === "teammate")!;
  const teammate = playerSnapshot(room, playerFor(room, teammateId), room.updatedAt).buzzwort;
  const guesser = playerSnapshot(room, playerFor(room, match.guesserId), room.updatedAt).buzzwort;
  const host = hostSnapshot(room, room.updatedAt).buzzwort;
  const audience = { ...room.participants[0]!, id: "audience-1", role: "audience" as const };
  const spectator = audienceSnapshot(room, audience, room.updatedAt).buzzwort;
  assert.deepEqual(giver?.assignment?.card, { word: match.card.word, tabooWords: match.card.tabooWords });
  assert.equal(giver?.assignment?.role, "clue_giver");
  assert.equal(teammate?.assignment?.role, "teammate");
  assert.equal(guesser?.assignment?.role, "guesser");
  assert.equal(teammate?.assignment?.card, undefined);
  assert.equal(guesser?.assignment?.card, undefined);
  assert.equal(host?.assignment, undefined);
  assert.equal(spectator?.assignment, undefined);
  for (const snapshot of [host, teammate, guesser, spectator]) assert.equal(JSON.stringify(snapshot).includes(match.card.word), false);
});

test("role-safe host and player snapshots expose the public clue only after the giver submits it", () => {
  let room = start();
  const match = room.buzzwort!;
  const giver = match.clueGiverId;
  room = applyPlayerAction(room, giver, clueAction(giver, match.matchId, 1, "A path around something") as never, match.updatedAt + 1).next;
  const host = hostSnapshot(room, room.updatedAt).buzzwort;
  const spectator = audienceSnapshot(room, { ...room.participants[0]!, id: "audience-2", role: "audience" }, room.updatedAt).buzzwort;
  assert.equal(host?.currentClue, "A path around something");
  assert.equal(spectator?.currentClue, "A path around something");
  assert.equal(host?.assignment, undefined);
  assert.equal(spectator?.assignment, undefined);
  assert.equal(JSON.stringify(host).includes(room.buzzwort!.card.word), false);
});

test("result finalization uses a stable Buzzwort event key and duplicate persistence is idempotent", async () => {
  let room = start();
  const match = room.buzzwort!;
  let now = match.updatedAt;
  room = applyPlayerAction(room, match.clueGiverId, clueAction(match.clueGiverId, match.matchId, 1, "A unique clue"), ++now).next;
  const final = applyPlayerAction(room, match.guesserId, guessAction(match.guesserId, match.matchId, 1, match.card.word, "finalize-now") as never, ++now);
  const effect = final.effects.find((entry): entry is Extract<DbEffect, { type: "arcade_finalize" }> => entry.type === "arcade_finalize");
  assert.ok(effect);
  assert.equal(effect.event.eventId, `${match.matchId}:buzzwort:complete`);

  let savedState = serializeRoomState(room);
  let savedVersion = room.version;
  const savedEvents: Array<{ event_key: string; event_type: "goal" | "result"; player_id: string | null; points: number; payload_json: string; occurred_at: number }> = [];
  const db = {
    prepare(sql: string) {
      return { bind(...values: unknown[]) {
        return {
          first: async () => ({ version: savedVersion, state_json: savedState }),
          all: async () => ({ results: savedEvents.filter((event) => values.includes(event.event_key)) }),
          sql, values,
        };
      } };
    },
    batch: async (statements: Array<{ sql: string; values: unknown[] }>) => {
      const results = statements.map((statement) => {
        if (statement.sql.startsWith("UPDATE rooms SET phase")) {
          savedVersion = Number(statement.values[1]); savedState = String(statement.values[2]); return { meta: { changes: 1 } };
        }
        if (statement.sql.startsWith("INSERT INTO arcade_score_events")) {
          const eventKey = String(statement.values[0]);
          if (savedEvents.some((event) => event.event_key === eventKey)) return { meta: { changes: 0 } };
          savedEvents.push({ event_key: eventKey, event_type: String(statement.values[3]) as "goal" | "result", player_id: statement.values[4] as string | null, points: Number(statement.values[5]), payload_json: String(statement.values[6]), occurred_at: Number(statement.values[7]) });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      });
      return results;
    },
  } as never;
  const first = await recordArcadeEvents(room.id, [effect.event], db);
  assert.deepEqual(first, { accepted: 1, completed: true });
  const second = await recordArcadeEvents(room.id, [effect.event], db);
  assert.deepEqual(second, { accepted: 0, completed: true });
  assert.equal(savedEvents.length, 1);
  assert.equal(savedEvents[0]?.event_key, `${match.matchId}:${effect.event.eventId}`);
});

test("Buzzwort timeout recovery finalizes after grace and pause/resume preserves the deadline", async () => {
  let room = start();
  const match = room.buzzwort!;
  const pauseAt = match.updatedAt + 1;
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-buzzwort", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, pauseAt).next;
  assert.equal(paused.remainingMs, match.deadline - pauseAt);
  assert.throws(() => applyPlayerAction(paused, match.clueGiverId, clueAction(match.clueGiverId, match.matchId, 1, "No action") as never, pauseAt + 1), /GAME_PAUSED/);
  const resumeAt = pauseAt + 10_000;
  room = applyHostAction(paused, { type: "RESUME", actionId: "resume-buzzwort", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, resumeAt).next;
  assert.equal(room.deadlineAt, resumeAt + (match.deadline - pauseAt));
  assert.equal(room.buzzwort?.deadline, room.deadlineAt);
  const deadline = room.buzzwort!.deadline;
  const before = await advanceState(room, deadline + 1_999);
  assert.equal(before.changed, false);
  const recovered = await advanceState(room, deadline + 2_000);
  assert.equal(recovered.changed, true);
  assert.equal(recovered.next.phase, "ARCADE_RESULTS");
  assert.equal((recovered.next.arcadeMatch?.result as { outcome?: string } | null)?.outcome, "timeout");
  assert.equal(recovered.next.arcadeMatch?.status, "COMPLETE");
  assert.equal(recovered.effects.find((entry) => entry.type === "arcade_finalize")?.type, "arcade_finalize");
});
