import assert from "node:assert/strict";
import test from "node:test";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";

const base = { contentMode: "party", timerAccessibility: false } as const;

function started(now = 1_000) {
  const room = createRoomState("IMPO", { ...base, gameLength: "arcade", arcadeGameId: "imposter" }, now);
  for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: now, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-imposter", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now + 1).next;
}

function clueAction(playerId: string, matchId: string, clue: string) {
  return { type: "SUBMIT_IMPOSTER_CLUE", actionId: `${playerId}-clue`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, clue } } as const;
}

function voteAction(playerId: string, matchId: string, targetPlayerId: string) {
  return { type: "SUBMIT_IMPOSTER_VOTE", actionId: `${playerId}-vote`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId, round: 1, targetPlayerId } } as const;
}

test("Imposter is a native Arcade match with private assignments and durable role-safe room snapshots", () => {
  const room = started();
  const match = room.imposter!;
  const imposterId = match.roles.find((entry) => entry.role === "imposter")!.playerId;
  const civilianId = match.players.find((playerId) => playerId !== imposterId)!;
  assert.equal(room.phase, "ARCADE_ACTIVE");
  assert.equal(room.arcadeMatch?.gameId, "imposter");
  assert.equal(room.deadlineAt, match.deadline);
  assert.equal(hostSnapshot(room, match.updatedAt).imposter?.assignment, undefined);
  assert.equal(playerSnapshot(room, room.participants.find((player) => player.id === civilianId)!, match.updatedAt).imposter?.assignment?.word, match.word);
  const impostorPhone = playerSnapshot(room, room.participants.find((player) => player.id === imposterId)!, match.updatedAt).imposter;
  assert.equal(impostorPhone?.assignment?.role, "imposter");
  assert.equal(impostorPhone?.assignment?.category, match.category);
  assert.equal(impostorPhone?.assignment?.word, undefined);
  const spectator = audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, match.updatedAt).imposter;
  assert.equal(spectator?.assignment, undefined);
  assert.equal(JSON.stringify(hostSnapshot(room, match.updatedAt)).includes(match.word), false);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).imposter, match);
  assert.equal(PlayerActionSchema.safeParse(clueAction(civilianId, match.matchId, "warm")).success, true);
  assert.equal(HostActionSchema.safeParse({ type: "START_GAME", actionId: "start-imposter", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }).success, true);
});

test("clue and vote transitions reveal the server-selected imposter and persist a stable Arcade result", () => {
  let room = started();
  const matchId = room.imposter!.matchId;
  const imposterId = room.imposter!.roles.find((entry) => entry.role === "imposter")!.playerId;
  let now = room.imposter!.updatedAt;
  let finalization: import("../server/types").DbEffect | undefined;
  for (const player of room.participants) {
    room = applyPlayerAction(room, player.id, clueAction(player.id, matchId, `clue-${player.id}`) as never, now + 1).next;
    now += 1;
  }
  assert.equal(room.imposter?.phase, "voting");
  assert.equal(room.deadlineAt, room.imposter?.deadline);
  assert.equal(hostSnapshot(room, now).imposter?.clues.length, 3);
  for (const player of room.participants) {
    const targetPlayerId = player.id === imposterId ? room.participants.find((candidate) => candidate.id !== imposterId)!.id : imposterId;
    const mutation = applyPlayerAction(room, player.id, voteAction(player.id, matchId, targetPlayerId) as never, now + 1);
    room = mutation.next;
    finalization = mutation.effects.find((effect) => effect.type === "arcade_finalize");
    now += 1;
  }
  assert.equal(room.phase, "ARCADE_RESULTS");
  assert.equal(room.imposter?.phase, "revealed");
  assert.equal(room.arcadeMatch?.status, "COMPLETE");
  assert.equal(room.arcadeMatch?.result && (room.arcadeMatch.result as { imposterId?: string }).imposterId, imposterId);
  assert.equal(finalization?.type, "arcade_finalize");
  if (finalization?.type === "arcade_finalize") assert.equal(finalization.event.eventId, `${matchId}:imposter:complete`);
});

test("room sync advances expired Imposter phases and reveal timeout finalizes without losing role privacy", async () => {
  const room = started();
  const match = room.imposter!;
  const cluing = await advanceState(room, match.deadline + 2_000);
  assert.equal(cluing.next.imposter?.phase, "voting");
  assert.equal(cluing.next.deadlineAt, cluing.next.imposter?.deadline);
  const voting = await advanceState(cluing.next, cluing.next.imposter!.deadline + 2_000);
  assert.equal(voting.next.phase, "ARCADE_RESULTS");
  assert.equal(voting.next.imposter?.phase, "revealed");
  assert.ok(voting.next.arcadeMatch?.result);
  assert.equal(voting.effects.find((effect) => effect.type === "arcade_finalize")?.type, "arcade_finalize");
  assert.equal(playerSnapshot(voting.next, voting.next.participants[0]!, voting.next.updatedAt).imposter?.result?.word, match.word);
});

test("zero-remaining pause and resume preserve a valid Imposter state during sync recovery grace", () => {
  let room = started();
  const deadline = room.imposter!.deadline;
  room = applyHostAction(room, { type: "PAUSE", actionId: "pause-at-deadline", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, deadline).next;
  assert.equal(room.remainingMs, 0);
  room = applyHostAction(room, { type: "RESUME", actionId: "resume-at-deadline", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, deadline).next;
  assert.equal(room.deadlineAt, deadline);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).imposter, room.imposter);
});

test("Imposter requires three humans and caps legacy larger rooms at ten controllers", () => {
  const tooSmall = createRoomState("SMAL", { ...base, gameLength: "arcade", arcadeGameId: "imposter" }, 1_000);
  for (let seat = 1; seat <= 2; seat += 1) tooSmall.participants.push({ id: `small-${seat}`, nickname: `Small ${seat}`, nicknameNormalized: `small ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null });
  assert.throws(() => applyHostAction(tooSmall, { type: "START_GAME", actionId: "start-too-small", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1_001), /IMPOSTER_NEEDS_THREE/);

  const large = createRoomState("LARG", { ...base, gameLength: "arcade", arcadeGameId: "imposter" }, 2_000);
  for (let seat = 1; seat <= 13; seat += 1) large.participants.push({ id: `large-${seat}`, nickname: `Large ${seat}`, nicknameNormalized: `large ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 2_000, removedAt: null });
  const room = applyHostAction(large, { type: "START_GAME", actionId: "start-large-group", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 2_001).next;
  assert.equal(room.imposter?.players.length, 10);
  const watcher = playerSnapshot(room, room.participants.find((player) => player.id === "large-13")!, 2_002);
  assert.equal(watcher.imposter?.assignment, undefined);
  assert.equal(watcher.imposter?.players.includes("large-13"), false);
});
