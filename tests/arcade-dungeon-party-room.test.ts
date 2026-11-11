import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";

const start = (code = "DUNG") => {
  const room = createRoomState(code, { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "dungeon-party" }, 50_000);
  for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 50_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-dungeon-party", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
};
const play = (room: ReturnType<typeof start>, playerId: string, actionId: string, now: number) => applyPlayerAction(room, playerId, { type: "SUBMIT_DUNGEON_PARTY_ACTION", actionId: `dungeon-${room.dungeonParty!.encounter}-${playerId}-${now}-unique`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.dungeonParty!.matchId, encounter: room.dungeonParty!.encounter, actionId } } as never, now).next;
const host = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_DUNGEON_PARTY", actionId: `dungeon-host-${room.dungeonParty!.encounter}-${transition}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.dungeonParty!.matchId, encounter: room.dungeonParty!.encounter, transition } } as never, now).next;

test("Dungeon Party snapshots hide locked choices from all other roles and persist typed state", () => {
  let room = start();
  room = play(room, "player-1", "strike", 50_002);
  assert.equal(playerSnapshot(room, room.participants[0]!, 50_002).dungeonParty?.ownActionId, "strike");
  assert.equal("ownActionId" in (playerSnapshot(room, room.participants[1]!, 50_002).dungeonParty ?? {}), false);
  assert.equal("choices" in (hostSnapshot(room, 50_002).dungeonParty ?? {}), false);
  assert.equal("choices" in (audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, 50_002).dungeonParty ?? {}), false);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).dungeonParty, room.dungeonParty);
  assert.throws(() => play(room, "player-1", "guard", 50_003), /ALREADY_LOCKED/);
});

test("Dungeon Party completes three encounters with persisted score/replay and recovers timed-out choices", async () => {
  let room = start("DUNR"); const matchId = room.dungeonParty!.matchId; let now = 50_001;
  for (let encounter = 1; encounter <= 3; encounter += 1) {
    for (const playerId of ["player-1", "player-2", "player-3"]) room = play(room, playerId, encounter === 1 ? "strike" : encounter === 2 ? "decode" : "spell", ++now);
    room = host(room, "reveal", ++now);
    if (encounter < 3) room = host(room, "next", ++now);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.dungeonParty?.result?.score, 3_000); assert.equal(room.dungeonParty?.result?.outcome, "escaped");
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).dungeonParty, room.dungeonParty);
  const replay = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "replay-dungeon-party", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, ++now).next;
  assert.equal(replay.code, "DUNR"); assert.equal(replay.phase, "LOBBY"); assert.equal(replay.dungeonParty, null); assert.equal(matchId, room.arcadeMatch?.id);

  const pending = start("DURC"); const deadline = pending.dungeonParty!.deadline;
  assert.equal((await advanceState(pending, deadline + 1_999)).changed, false);
  const recovered = await advanceState(pending, deadline + 2_000);
  assert.equal(recovered.changed, true); assert.equal(recovered.next.dungeonParty?.encounterResults[0]?.timedOut, true);
  assert.equal(recovered.next.dungeonParty?.encounterResults[0]?.actions.length, 3);
});

test("Dungeon Party pause and resume preserve the encounter deadline and server authority", () => {
  const room = start("DUPA");
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-dungeon", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 50_010).next;
  assert.equal(paused.paused, true); assert.equal(paused.deadlineAt, null); assert.equal(paused.remainingMs, room.dungeonParty!.deadline - 50_010);
  assert.throws(() => play(paused, "player-1", "strike", 50_011), /GAME_PAUSED/);
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-dungeon", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, 60_000).next;
  assert.equal(resumed.paused, false); assert.equal(resumed.dungeonParty!.deadline, 60_000 + room.dungeonParty!.deadline - 50_010);
  assert.doesNotThrow(() => play(resumed, "player-1", "strike", 60_001));
});

test("Dungeon Party persists an unrecoverable party defeat through the normal Arcade finalizer", () => {
  let room = start("DUFA"); let now = 50_001;
  for (let encounter = 1; encounter <= 3; encounter += 1) {
    const guardAction = ["guard", "brace", "ward"][encounter - 1]!;
    for (const playerId of ["player-1", "player-2", "player-3"]) room = play(room, playerId, guardAction, ++now);
    const reveal = applyHostAction(room, { type: "ADVANCE_DUNGEON_PARTY", actionId: `defeat-reveal-${encounter}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.dungeonParty!.matchId, encounter, transition: "reveal" } } as never, ++now);
    room = reveal.next;
    if (encounter < 3) room = host(room, "next", ++now);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.dungeonParty?.health, 0); assert.equal(room.dungeonParty?.result?.outcome, "fallen");
});
