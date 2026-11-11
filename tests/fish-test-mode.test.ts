import assert from "node:assert/strict";
import test from "node:test";
import { createRoomSchema, HostActionSchema, type HostAction } from "../lib/contracts";
import { applyFishRequest } from "../server/fish-service";
import { applyHostAction, createRoomState } from "../server/engine";
import { advanceSketchRelay, canAdvanceSketchRelay, isCurrentSketchRelayJob, validateSketchRelayUpload } from "../server/arcade/sketch_relay";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import type { RoomState } from "../server/types";

function lobby(humans = 3): RoomState {
  const room = createRoomState("FISHTEST", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false }, 1000);
  for (let seat = 1; seat <= humans; seat++) room.participants.push({
    id: `player-${seat}`, nickname: `Artist ${seat}`, nicknameNormalized: `artist ${seat}`, role: "player", seat, lobbySlot: seat,
    avatar: seat - 1, color: "#46DBDC", active: true, pendingActivation: false, bot: false, lastSeenAt: 1000, removedAt: null,
  });
  return room;
}

function startTest(room: RoomState, now = 1001, mode?: "shark" | "peaceful") {
  return applyHostAction(room, {
    type: "START_FISH_TEST", actionId: "start-fish-test", roundId: "lobby", expectedPhase: "LOBBY", payload: mode ? { mode } : {},
  } as unknown as HostAction, now);
}

function fishAction(room: RoomState, type: "FISH_EXIT" | "FISH_BACK", now: number) {
  const state = room.sketchRelay!;
  const finale = state.finale!;
  return applyFishRequest(room, { id: "host", host: true }, {
    actionId: `fish-${type.toLowerCase()}`, type,
    payload: { matchId: state.matchId, finaleId: finale.finaleId, phase: finale.phase },
  }, now);
}

test("temporary fish test starts directly in drawing without creating main-game results or jobs", () => {
  const result = startTest(lobby());
  const room = result.next;
  assert.equal(room.phase, "LOBBY");
  assert.equal(room.status, "LOBBY");
  assert.equal(room.arcadeMatch, null);
  assert.equal(room.deadlineAt, null);
  assert.equal(room.joiningLocked, false);
  assert.equal(room.sketchRelay?.fishTest, true);
  assert.equal(room.sketchRelay?.phase, "prompt-writing");
  assert.equal(room.sketchRelay?.showdown?.version, 3);
  assert.equal(room.sketchRelay?.finale?.phase, "drawing");
  assert.equal(room.sketchRelay?.finale?.mode, "shark");
  assert.equal(room.sketchRelay?.finale?.players.length, 3);
  assert.ok(Object.values(room.sketchRelay!.scores).every(score => score === 0));
  assert.deepEqual(room.scoreEvents, []);
  assert.deepEqual(result.effects, []);
  const restored = deserializeRoomState(serializeRoomState(room));
  const snapshot = hostSnapshot(restored);
  assert.equal(snapshot.arcade, null);
  assert.deepEqual(snapshot.sketchImageJobs ?? [], []);
  assert.equal(snapshot.sketchRelay?.fishTest, true);
  assert.equal(playerSnapshot(restored, restored.participants[0]!).sketchRelay?.finale?.phase, "drawing");
});

test("fish drawing shortcut allows one human with two free bots and rejects invalid seats", () => {
  const solo = lobby(1);
  solo.participants.push(...[2, 3].map(seat => ({ id: `bot-${seat}`, nickname: `Bot ${seat}`, nicknameNormalized: `bot ${seat}`, role: "player" as const, seat, lobbySlot: seat, avatar: seat, color: "#46DBDC", active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null })));
  const started = startTest(solo).next.sketchRelay!;
  assert.deepEqual(started.finale?.players.map(player => player.bot), [false, true, true]);
  assert.equal(started.finale?.entries.length, 2);
  const tooFew = lobby(1);
  tooFew.participants.push({ id: "bot-2", nickname: "Bot 2", nicknameNormalized: "bot 2", role: "player", seat: 2, lobbySlot: 2, avatar: 2, color: "#46DBDC", active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null });
  assert.throws(() => startTest(tooFew), /FISH_TEST_NEEDS_THREE/);
  const botsOnly = lobby(0);
  botsOnly.participants.push(...[1, 2, 3].map(seat => ({ id: `bot-${seat}`, nickname: `Bot ${seat}`, nicknameNormalized: `bot ${seat}`, role: "player" as const, seat, lobbySlot: seat, avatar: seat, color: "#46DBDC", active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null })));
  assert.throws(() => startTest(botsOnly), /FISH_TEST_NEEDS_HUMAN/);
  const pending = lobby(2);
  pending.participants[1]!.pendingActivation = true;
  pending.participants.push({ id: "bot-3", nickname: "Bot 3", nicknameNormalized: "bot 3", role: "player", seat: 3, lobbySlot: 3, avatar: 3, color: "#46DBDC", active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null });
  assert.throws(() => startTest(pending), /FISH_TEST_NEEDS_THREE/);
  const wrongGame = lobby(); wrongGame.arcadeGameId = "air-hockey";
  assert.throws(() => startTest(wrongGame), /FISH_TEST_UNAVAILABLE/);
});

test("temporary fish test blocks normal main-game host and player actions", () => {
  const room = startTest(lobby()).next;
  assert.throws(() => applyHostAction(room, {
    type: "START_GAME", actionId: "start-main-after-fish", roundId: "lobby", expectedPhase: "LOBBY", payload: {},
  }, 1002), /FISH_TEST_ACTIVE/);
  assert.throws(() => applyHostAction(room, {
    type: "ADVANCE_SKETCH_RELAY", actionId: "advance-main-after-fish", roundId: "lobby", expectedPhase: "LOBBY",
    payload: { matchId: room.sketchRelay!.matchId, round: 1, phase: "prompt-writing", transition: "next" },
  } as unknown as HostAction, 1002), /FISH_TEST_ACTIVE|ARCADE_LIFECYCLE_REQUIRED|STALE_ARCADE_TRANSITION/);
  assert.equal(canAdvanceSketchRelay(room.sketchRelay!, Number.MAX_SAFE_INTEGER), false);
  assert.throws(() => advanceSketchRelay(room.sketchRelay!, Number.MAX_SAFE_INTEGER, true), /FISH_TEST_ACTIVE/);
  const job = { kind: "SKETCH_TRANSFORM" as const, matchId: room.sketchRelay!.matchId, round: 1, chainId: room.sketchRelay!.chains[0]!.chainId, leg: "drawing" as const, sourceAssetId: "source", jobId: "job" };
  assert.equal(isCurrentSketchRelayJob(room, job, 1002), false);
  assert.throws(() => validateSketchRelayUpload(room, "player-1", { matchId: room.sketchRelay!.matchId, round: 1, chainId: room.sketchRelay!.chains[0]!.chainId, leg: "drawing", promptIndex: 0 }, 1002), /ARCADE_LIFECYCLE_REQUIRED/);
  assert.throws(() => applyFishRequest(room, { id: "player-1", host: false }, {
    actionId: "player-fish-exit", type: "FISH_EXIT", payload: { matchId: room.sketchRelay!.matchId, finaleId: room.sketchRelay!.finale!.finaleId, phase: "drawing" },
  }, 1002), /FISH_UNAUTHORIZED/);
});

test("fish test exit and back clear only the temporary match and return to an open lobby", () => {
  const testRoom = startTest(lobby()).next;
  const matchNumber = testRoom.matchNumber;
  const scoreEvents = structuredClone(testRoom.scoreEvents);
  const exited = fishAction(testRoom, "FISH_EXIT", 1005);
  assert.equal(exited.phase, "LOBBY");
  assert.equal(exited.status, "LOBBY");
  assert.equal(exited.arcadeMatch, null);
  assert.equal(exited.sketchRelay, null);
  assert.equal(exited.deadlineAt, null);
  assert.equal(exited.joiningLocked, false);
  assert.equal(exited.matchNumber, matchNumber);
  assert.deepEqual(exited.scoreEvents, scoreEvents);

  const lockedLobby = lobby(); lockedLobby.joiningLocked = true;
  const lockedTest = startTest(lockedLobby).next;
  assert.equal(lockedTest.joiningLocked, true);
  assert.equal(fishAction(lockedTest, "FISH_EXIT", 1005).joiningLocked, true);

  const staleRoster = structuredClone(testRoom);
  staleRoster.participants[2]!.removedAt = 1003;
  staleRoster.joiningLocked = !staleRoster.sketchRelay!.fishTestPreviousJoiningLocked;
  const reloadedStaleRoster = deserializeRoomState(serializeRoomState(staleRoster));
  const recoveredExit = fishAction(reloadedStaleRoster, "FISH_EXIT", 1005);
  assert.equal(recoveredExit.sketchRelay, null);
  assert.equal(recoveredExit.joiningLocked, testRoom.sketchRelay!.fishTestPreviousJoiningLocked);
  const backed = fishAction(startTest(lobby()).next, "FISH_BACK", 1005);
  assert.equal(backed.phase, "LOBBY");
  assert.equal(backed.sketchRelay, null);
});

test("solo arcade creation is explicit and fish-test-only", () => {
  const base = { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false, soloMode: true, soloPlayerName: "Tester", botCount: 2 };
  assert.equal(createRoomSchema.safeParse(base).success, false);
  assert.equal(createRoomSchema.safeParse({ ...base, fishTestOnly: true }).success, true);
  assert.equal(createRoomSchema.safeParse({ ...base, arcadeGameId: "air-hockey", fishTestOnly: true }).success, false);
  const ordinary = createRoomState("SOLO", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false, soloMode: true }, 1000);
  assert.throws(() => applyHostAction(ordinary, { type: "START_GAME", actionId: "normal-solo-arcade", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1001), /FISH_TEST_ONLY/);
});
test("normal fish bonus remains gated behind a completed authoritative main match", () => {
  assert.throws(() => applyFishRequest(lobby(), { id: "host", host: true }, {
    actionId: "forged-fish-open", type: "FISH_OPEN", payload: { matchId: "anything" },
  }, 1001), /FISH_REQUIRES_COMPLETED_MATCH/);
});

test("fish test mode is selected at start and defaults to shark without a later mode-changing phase", () => {
  const defaultMode = startTest(lobby()).next.sketchRelay!.finale!;
  assert.equal(defaultMode.phase, "drawing");
  assert.equal(defaultMode.mode, "shark");
  assert.equal(startTest(lobby(), 1001, "peaceful").next.sketchRelay!.finale!.mode, "peaceful");
  assert.equal(HostActionSchema.safeParse({ type: "START_FISH_TEST", actionId: "invalid-fish-test", roundId: "lobby", expectedPhase: "LOBBY", payload: { mode: "laser" } }).success, false);
});
