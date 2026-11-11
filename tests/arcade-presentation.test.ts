import assert from "node:assert/strict";
import test from "node:test";
import type { HostSnapshot } from "../lib/contracts";
import { arcadeHostResultScore, arcadeLobbySeatLabel, type ArcadeWireSnapshot } from "../lib/arcade/presentation";
import { moveArcadePaddleByKey } from "../app/components/ArcadeController";
import { hostSnapshot } from "../server/snapshots";
import { createRoomState } from "../server/engine";

test("reloaded Arcade results use the authoritative host snapshot score", () => {
  const snapshot = {
    phase: "ARCADE_RESULTS",
    arcade: { gameId: "air-hockey", matchId: "match-1", startedAt: 1, endedAt: 2, result: { score: { p1: 2, p2: 5 }, winners: ["p2"] } },
  } as unknown as HostSnapshot;
  const result = arcadeHostResultScore(snapshot, null);
  assert.deepEqual(result, { resultIds: ["p1", "p2"], score: { p1: 2, p2: 5 } });
});

test("Light Trails host results use D1 distance metrics when no score or progress map exists", () => {
  const snapshot = {
    phase: "ARCADE_RESULTS",
    arcade: { gameId: "light-trails", matchId: "trails-match", startedAt: 1, endedAt: 2, result: { distance: { p1: 31, p2: 27 }, winners: ["p1"] } },
  } as unknown as HostSnapshot;
  assert.deepEqual(arcadeHostResultScore(snapshot, null), { resultIds: ["p1", "p2"], score: { p1: 31, p2: 27 } });
});

test("authoritative Arcade result players replace stale socket player IDs after reconnect", () => {
  const snapshot = {
    phase: "ARCADE_RESULTS",
    arcade: { gameId: "air-hockey", matchId: "match-2", startedAt: 1, endedAt: 2, result: { score: { currentWinner: 7, currentFinalist: 4 }, winners: ["currentWinner"] } },
  } as unknown as HostSnapshot;
  const staleSocket = {
    state: { players: ["departed-player", "old-match-player"], score: { "departed-player": 99, "old-match-player": 88 } },
  } as unknown as ArcadeWireSnapshot;

  assert.deepEqual(arcadeHostResultScore(snapshot, staleSocket), {
    resultIds: ["currentWinner", "currentFinalist"],
    score: { currentWinner: 7, currentFinalist: 4 },
  });
});

test("Arcade result projection falls back to live socket players when D1 has no result", () => {
  const snapshot = { phase: "ARCADE_RESULTS", arcade: { gameId: "air-hockey", matchId: "match-3", startedAt: 1, endedAt: 2, result: null } } as unknown as HostSnapshot;
  const liveSocket = { state: { players: ["p3", "p1"], score: { p1: 2, p3: 5 } } } as unknown as NonNullable<Parameters<typeof arcadeHostResultScore>[1]>;

  assert.deepEqual(arcadeHostResultScore(snapshot, liveSocket), { resultIds: ["p3", "p1"], score: { p1: 2, p3: 5 } });
});

test("lobby seat labels follow server-selected controller IDs instead of player-list positions", () => {
  const seats = ["p3", "p4"];
  assert.equal(arcadeLobbySeatLabel({ id: "p1", active: true }, seats), "WATCHING");
  assert.equal(arcadeLobbySeatLabel({ id: "p3", active: true }, seats), "SEAT 1");
  assert.equal(arcadeLobbySeatLabel({ id: "p4", active: true }, seats), "SEAT 2");
  assert.equal(arcadeLobbySeatLabel({ id: "bot", active: true, bot: true }, seats), "BOT");
});

test("host snapshots expose eligible human controller IDs using the match rotation", () => {
  const room = createRoomState("ABCD", { gameLength: "arcade", arcadeGameId: "air-hockey", contentMode: "party", timerAccessibility: false }, 1_000);
  room.matchNumber = 2;
  room.participants = [
    { id: "p1", nickname: "One", nicknameNormalized: "one", role: "player", seat: 1, avatar: 0, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
    { id: "p2", nickname: "Two", nicknameNormalized: "two", role: "player", seat: 2, avatar: 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
    { id: "p3", nickname: "Three", nicknameNormalized: "three", role: "player", seat: 3, avatar: 2, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
    { id: "p4", nickname: "Four", nicknameNormalized: "four", role: "player", seat: 4, avatar: 3, color: "#fff", active: false, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
  ];
  const snapshot = hostSnapshot(room) as HostSnapshot & { arcadeControllerIds: string[] };
  assert.deepEqual(snapshot.arcadeControllerIds, ["p1", "p2", "p3"]);
});

test("host snapshots and phone labels include every controller for a larger-capacity title", () => {
  const room = createRoomState("ABCD", { gameLength: "arcade", arcadeGameId: "tap-race", contentMode: "party", timerAccessibility: false }, 1_000);
  room.matchNumber = 2;
  room.participants = [
    { id: "p1", nickname: "One", nicknameNormalized: "one", role: "player", seat: 1, avatar: 0, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
    { id: "p2", nickname: "Two", nicknameNormalized: "two", role: "player", seat: 2, avatar: 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
    { id: "p3", nickname: "Three", nicknameNormalized: "three", role: "player", seat: 3, avatar: 2, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 1_000, removedAt: null },
  ];
  const snapshot = hostSnapshot(room) as HostSnapshot & { arcadeControllerIds: string[] };
  assert.deepEqual(snapshot.arcadeControllerIds, ["p1", "p2", "p3"]);
  assert.deepEqual(snapshot.arcadeControllerIds.map((id) => arcadeLobbySeatLabel({ id, active: true }, snapshot.arcadeControllerIds)), ["SEAT 1", "SEAT 2", "SEAT 3"]);
});

test("Arcade keyboard controls step within normalized bounds", () => {
  assert.deepEqual(moveArcadePaddleByKey({ x: 0.5, y: 0.5 }, "ArrowLeft"), { x: 0.44, y: 0.5 });
  assert.deepEqual(moveArcadePaddleByKey({ x: 0.98, y: 0.98 }, "d"), { x: 1, y: 0.98 });
  assert.equal(moveArcadePaddleByKey({ x: 0.5, y: 0.5 }, "Enter"), null);
});
