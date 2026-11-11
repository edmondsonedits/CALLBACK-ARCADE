import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import { kartentischLegalCards } from "../server/arcade/kartentisch";

const start = (code = "KART", count = 3) => {
  const room = createRoomState(code, { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "kartentisch" }, 50_000);
  for (let seat = 1; seat <= count; seat += 1) room.participants.push({ id: `player-${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 50_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-kartentisch", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 50_001).next;
};
const play = (room: ReturnType<typeof start>, playerId: string, cardId: string, now: number) => applyPlayerAction(room, playerId, { type: "SUBMIT_KARTENTISCH_CARD", actionId: `play-${room.kartentisch!.trick}-${playerId}-${cardId}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.kartentisch!.matchId, trick: room.kartentisch!.trick, cardId } } as never, now).next;
const host = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_KARTENTISCH", actionId: `advance-${room.kartentisch!.trick}-${transition}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.kartentisch!.matchId, trick: room.kartentisch!.trick, transition } } as never, now).next;

test("Kartentisch room snapshots keep all hands and unrevealed plays private across serialization", () => {
  let room = start(); const match = room.kartentisch!; assert.equal(match.players.length, 3);
  const player = playerSnapshot(room, room.participants[0]!, 50_001).kartentisch!;
  assert.equal(player.ownHand?.length, 5); assert.equal("plays" in player, false); assert.equal("seed" in player, false);
  assert.equal("hands" in (hostSnapshot(room, 50_001).kartentisch ?? {}), false);
  assert.equal("hands" in (audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, 50_001).kartentisch ?? {}), false);
  const turnPlayerId = match.turnPlayerId!; const card = kartentischLegalCards(match, turnPlayerId)[0]!;
  room = play(room, turnPlayerId, card.id, 50_002);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).kartentisch, room.kartentisch);
  const owner = room.participants.find((person) => person.id === turnPlayerId)!;
  assert.equal(playerSnapshot(room, owner, 50_002).kartentisch?.submitted, true);
  assert.equal(playerSnapshot(room, owner, 50_002).kartentisch?.ownHand?.some((held) => held.id === card.id), false);
  assert.equal("plays" in (hostSnapshot(room, 50_002).kartentisch ?? {}), false);
  assert.throws(() => play(room, turnPlayerId, card.id, 50_003), /WRONG_TURN|CARD_NOT_HELD/);
});

test("Kartentisch resolves five tricks, scores, survives deadline recovery, and replays in the same room", async () => {
  let room = start("KARD"); const matchId = room.kartentisch!.matchId; let now = 50_001;
  for (let trick = 1; trick <= 5; trick += 1) {
    for (let seat = 0; seat < 3; seat += 1) {
      const match = room.kartentisch!; const playerId = match.turnPlayerId!; const card = kartentischLegalCards(match, playerId)[0]!;
      room = play(room, playerId, card.id, ++now);
    }
    room = host(room, "reveal", ++now);
    if (trick < 5) room = host(room, "next", ++now);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.kartentisch?.trickResults.length, 5);
  assert.equal(Object.values(room.kartentisch!.scores).reduce((sum, score) => sum + score, 0), 5);
  assert.ok(hostSnapshot(room, now).kartentisch?.result?.hands);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).kartentisch, room.kartentisch);
  const replay = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "replay-kartentisch", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, ++now).next;
  assert.equal(replay.code, "KARD"); assert.equal(replay.phase, "LOBBY"); assert.equal(replay.kartentisch, null); assert.equal(matchId, room.arcadeMatch?.id);

  const timeoutRoom = start("KATO"); const deadline = timeoutRoom.kartentisch!.deadline;
  assert.equal((await advanceState(timeoutRoom, deadline + 1_999)).changed, false);
  const recovered = await advanceState(timeoutRoom, deadline + 2_000);
  assert.equal(recovered.changed, true); assert.equal(recovered.next.kartentisch?.trickResults[0]?.timedOut, true);
  assert.equal(recovered.next.kartentisch?.trickResults[0]?.plays.length, 3);
});
