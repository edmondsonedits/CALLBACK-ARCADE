import assert from "node:assert/strict";
import test from "node:test";
import { PlayerActionSchema } from "../lib/contracts";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState, supportsLobbyBots } from "../server/engine";
import { selectArcadeControllerIds } from "../server/arcade/tickets";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";

const nativeGames = [
  "arena-survivor", "buzzwort", "chaos-kommando", "drift-racer", "flatterfluff", "kartentisch", "magic-arena", "magic-duell",
  "minions-td", "zeichnen-und-erraten", "imposter", "pantomime", "schaetzorama", "schattenjagd", "dungeon-party", "word-tiles",
] as const;

test("Bowl of Fools and every retained native Arcade game expose host bot seats", () => {
  assert.equal(supportsLobbyBots({ gameLength: "bowl-of-fools" }), true);
  for (const arcadeGameId of nativeGames) assert.equal(supportsLobbyBots({ gameLength: "arcade", arcadeGameId }), true, arcadeGameId);
  assert.equal(supportsLobbyBots({ gameLength: "arcade", arcadeGameId: "air-hockey" }), false);
  assert.equal(supportsLobbyBots({ gameLength: "arcade", arcadeGameId: "light-trails" }), false);
});

test("native Arcade controller selection retains bot seats in the match", () => {
  const participants = [
    { id: "bot-1", role: "player", seat: 1, active: true, bot: true, removedAt: null },
    { id: "human-2", role: "player", seat: 2, active: true, bot: false, removedAt: null },
    { id: "bot-3", role: "player", seat: 3, active: true, bot: true, removedAt: null },
    { id: "removed-4", role: "player", seat: 4, active: false, bot: true, removedAt: 1 },
  ];
  assert.deepEqual(selectArcadeControllerIds("arena-survivor", participants), ["bot-1", "human-2", "bot-3"]);
});

test("every retained native engine accepts mixed bot turns while zero-bot rooms remain untouched", async () => {
  for (const arcadeGameId of nativeGames) {
    const code = arcadeGameId === "buzzwort" ? "BOTBUZ00" : `BOT${arcadeGameId.slice(0, 1).toUpperCase()}`;
    const room = createRoomState(code, { gameLength: "arcade", arcadeGameId, contentMode: "party", timerAccessibility: false }, 10_000);
    room.id = code;
    for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: seat < 3, lastSeenAt: 10_000, removedAt: null });
    const started = applyHostAction(room, { type: "START_GAME", actionId: `start-${arcadeGameId}`, roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 10_001).next;
    const buzzwort = started.buzzwort;
    if (arcadeGameId === "buzzwort" && buzzwort && !started.participants.find((player) => player.id === buzzwort.clueGiverId)?.bot) {
      // Buzzwort's shuffled clue-giver varies with its fresh match ID. Keep this
      // mixed-roster regression deterministic by assigning the active role a bot.
      const clueGiver = started.participants.find((player) => player.id === buzzwort.clueGiverId)!;
      const reserveBot = started.participants.find((player) => player.bot && player.id !== clueGiver.id)!;
      clueGiver.bot = true;
      reserveBot.bot = false;
    }
    let advanced = await advanceState(started, 10_002);
    if (!advanced.changed && arcadeGameId === "zeichnen-und-erraten" && started.drawGuess?.phase === "drawing") {
      const artistId = started.drawGuess.artistId;
      const drawing = [{ color: "#202040", width: 5, points: [{ x: 100, y: 500 }, { x: 500, y: 200 }, { x: 900, y: 500 }] }];
      const action = PlayerActionSchema.parse({ type: "SUBMIT_DRAW_GUESS_DRAWING", actionId: "human-draw-for-bot-test", roundId: started.arcadeMatch!.id, expectedPhase: "ARCADE_ACTIVE", payload: { matchId: started.arcadeMatch!.id, round: 1, drawing } });
      const drawn = applyPlayerAction(started, artistId, action, 10_002).next;
      advanced = await advanceState(drawn, 10_003);
    }
    assert.equal(advanced.changed, true, `${arcadeGameId} should resolve an ordinary bot player action; phase=${started.phase}; clue=${started.buzzwort?.clueGiverId}; guesser=${started.buzzwort?.guesserId}; bots=${started.participants.filter((player) => player.bot).map((player) => player.id).join(",")}`);
    assert.ok(advanced.next.participants[0]?.active, `${arcadeGameId} preserves the bot seat`);
  }

  const humanRoom = createRoomState("BOTZERO", { gameLength: "arcade", arcadeGameId: "arena-survivor", contentMode: "party", timerAccessibility: false }, 10_000);
  for (let seat = 1; seat <= 3; seat += 1) humanRoom.participants.push({ id: `human-${seat}`, nickname: `Human ${seat}`, nicknameNormalized: `human ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 10_000, removedAt: null });
  const humanStarted = applyHostAction(humanRoom, { type: "START_GAME", actionId: "start-human-only", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 10_001).next;
  assert.equal((await advanceState(humanStarted, 10_002)).changed, false);
});

test("all-bot rooms can progress each retained native match to its result phase", async () => {
  for (const count of [3, 10]) {
  for (const arcadeGameId of nativeGames) {
    const code = `ALL${arcadeGameId.slice(0, 1).toUpperCase()}`;
    const room = createRoomState(code, { gameLength: "arcade", arcadeGameId, contentMode: "party", timerAccessibility: false }, 20_000);
    room.id = code;
    for (let seat = 1; seat <= count; seat += 1) room.participants.push({ id: `bot-${seat}`, nickname: `Bot ${seat}`, nicknameNormalized: `bot ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: true, lastSeenAt: 20_000, removedAt: null });
    let state = applyHostAction(room, { type: "START_GAME", actionId: `start-all-${arcadeGameId}`, roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 20_001).next;
    let now = 20_002;
    for (let step = 0; step < 180 && state.phase !== "ARCADE_RESULTS"; step += 1) {
      if (state.deadlineAt !== null && now >= state.deadlineAt) now = state.deadlineAt + 2_001;
      const result = await advanceState(state, now);
      if (result.changed) { state = deserializeRoomState(serializeRoomState(result.next)); now += 1_000; }
      else if (state.deadlineAt !== null) now = state.deadlineAt + 2_001;
      else now += 1_000;
    }
    assert.equal(state.phase, "ARCADE_RESULTS", `${arcadeGameId} should not stall with ${count} bot seats`);
    assert.equal(state.arcadeMatch?.status, "COMPLETE", `${arcadeGameId} finalizes its native result`);
  }
  }
});
