import assert from "node:assert/strict";
import test from "node:test";
import { createRoomSchema } from "../lib/contracts";
import { ARCADE_GAMES, getArcadeLaunchHref } from "../lib/arcade/catalog";
import { applyHostAction, createRoomState } from "../server/engine";
import { applyFishRequest } from "../server/fish-service";
import type { RoomState } from "../server/types";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";

function room(): RoomState {
  const state = createRoomState("FISHTANK", { gameLength: "arcade", arcadeGameId: "fish-tank", contentMode: "party", timerAccessibility: false }, 1000);
  state.participants = [1, 2, 3].map(seat => ({
    id: `player-${seat}`, nickname: `Artist ${seat}`, nicknameNormalized: `artist ${seat}`, role: "player", seat, lobbySlot: seat,
    avatar: seat - 1, color: "#46DBDC", active: true, pendingActivation: false, bot: false, lastSeenAt: 1000, removedAt: null,
  }));
  return state;
}

test("Fish Tank is a normal Arcade catalog launch with a direct independent fish lifecycle", () => {
  const fishTank = ARCADE_GAMES.find(game => game.id === "fish-tank");
  assert.ok(fishTank);
  assert.equal(getArcadeLaunchHref(fishTank), "/host/new?gameLength=arcade&arcadeGameId=fish-tank");
  assert.equal(createRoomSchema.safeParse({ gameLength: "arcade", arcadeGameId: "fish-tank", contentMode: "party", timerAccessibility: false }).success, true);

  const lobby = room();
  const firstStart = applyHostAction(lobby, { type: "START_GAME", actionId: "start-fish-tank", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1001);
  const started = firstStart.next;
  assert.equal(started.phase, "ARCADE_ACTIVE");
  assert.equal(started.arcadeMatch?.status, "ACTIVE");
  assert.equal(started.fishGame?.phase, "configure");
  assert.equal(started.sketchRelay, null);
  assert.deepEqual(started.scoreEvents, []);
  assert.deepEqual(started.encoreScoreEvents, []);
  assert.equal(firstStart.effects.some(effect => effect.type === "job" || effect.type === "sketch_source"), false);
  const restored = deserializeRoomState(serializeRoomState(started));
  assert.equal(restored.fishGame?.phase, "configure");
  const host = hostSnapshot(restored, 1001);
  const phone = playerSnapshot(restored, restored.participants[0]!, 1001);
  assert.equal(host.fishGame?.phase, "configure");
  assert.equal(phone.fishGame?.self?.participant, false);
  assert.equal(JSON.stringify(phone.fishGame).includes(restored.fishGame!.seed), false);

  const fish = started.fishGame!;
  const configured = applyFishRequest(started, { id: "host", host: true }, {
    actionId: "configure-fish-tank", type: "FISH_CONFIGURE",
    payload: { matchId: fish.matchId, finaleId: fish.finaleId, phase: "configure", mode: "shark", drawingSeconds: 300 },
  }, 1002);
  assert.equal(configured.fishGame?.mode, "shark");
  assert.equal(configured.fishGame?.drawingSeconds, 300);

  const running = applyFishRequest(configured, { id: "host", host: true }, {
    actionId: "start-fish-tank", type: "FISH_START",
    payload: { matchId: fish.matchId, finaleId: fish.finaleId, phase: "configure" },
  }, 1003);
  assert.equal(running.fishGame?.phase, "tutorial");
  assert.equal(running.phase, "ARCADE_ACTIVE");
  assert.equal(running.arcadeMatch?.status, "ACTIVE");
  assert.deepEqual(running.scoreEvents, []);
  assert.equal(playerSnapshot(running, running.participants[0]!, 1003).fishGame?.self?.participant, true);
  assert.throws(() => applyFishRequest(running, { id: "forged", host: false }, {
    actionId: "forged-fish-config", type: "FISH_CONFIGURE",
    payload: { matchId: fish.matchId, finaleId: fish.finaleId, phase: "tutorial", mode: "peaceful", drawingSeconds: 120 },
  }, 1004), /HOST_REQUIRED|FISH_STALE_PHASE/);
});

test("Fish Tank can return to the persistent lobby before start and replay through START_GAME", () => {
  const started = applyHostAction(room(), { type: "START_GAME", actionId: "fish-back-start", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1001).next;
  const fish = started.fishGame!;
  const back = applyFishRequest(started, { id: "host", host: true }, {
    actionId: "fish-back", type: "FISH_BACK",
    payload: { matchId: fish.matchId, finaleId: fish.finaleId, phase: "configure" },
  }, 1002);
  assert.equal(back.phase, "LOBBY");
  assert.equal(back.status, "LOBBY");
  assert.equal(back.fishGame, null);
  assert.equal(back.arcadeMatch?.status, "COMPLETE");
  const restored = deserializeRoomState(serializeRoomState(back));
  const replay = applyHostAction(restored, { type: "START_GAME", actionId: "fish-replay", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 1003).next;
  assert.equal(replay.phase, "ARCADE_ACTIVE");
  assert.notEqual(replay.fishGame?.matchId, fish.matchId);
});
