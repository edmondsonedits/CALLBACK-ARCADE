import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { audienceSnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import { WORD_TILES_DICTIONARY } from "../server/arcade/word_tiles";

const start = (code = "WORDS") => {
  const room = createRoomState(code, { contentMode: "party", timerAccessibility: false, gameLength: "arcade", arcadeGameId: "word-tiles" }, 20_000);
  for (let seat = 1; seat <= 3; seat += 1) room.participants.push({ id: `p${seat}`, nickname: `Player ${seat}`, nicknameNormalized: `player ${seat}`, role: "player", seat, avatar: seat - 1, color: "#fff", active: true, pendingActivation: false, bot: false, lastSeenAt: 20_000, removedAt: null });
  return applyHostAction(room, { type: "START_GAME", actionId: "start-word-tiles", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, 20_001).next;
};
const submit = (room: ReturnType<typeof start>, playerId: string, word: string | null, now: number) => applyPlayerAction(room, playerId, { type: "SUBMIT_WORD_TILES_WORD", actionId: `word-${room.wordTiles!.round}-${playerId}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.wordTiles!.matchId, round: room.wordTiles!.round, word } } as never, now).next;
const host = (room: ReturnType<typeof start>, transition: "reveal" | "next", now: number) => applyHostAction(room, { type: "ADVANCE_WORD_TILES", actionId: `word-host-${room.wordTiles!.round}-${transition}-${now}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.wordTiles!.matchId, round: room.wordTiles!.round, transition } } as never, now).next;
function completeMatch() {
  let room = start("CORRUPT"); let now = 20_001;
  for (let round = 1; round <= 5; round += 1) {
    const word = room.wordTiles!.roundData[round - 1]!.solutionWord;
    for (const playerId of room.wordTiles!.players) room = submit(room, playerId, word, ++now);
    room = host(room, "reveal", ++now);
    if (round < 5) room = host(room, "next", ++now);
  }
  return room;
}
function findWordMissingFromRack(letters: string) {
  return [...WORD_TILES_DICTIONARY].find((word) => {
    const counts = new Map<string, number>();
    for (const letter of letters.toLowerCase()) counts.set(letter, (counts.get(letter) ?? 0) + 1);
    for (const letter of word) { const count = counts.get(letter) ?? 0; if (!count) return true; counts.set(letter, count - 1); }
    return false;
  });
}
function findRackWordOutsideDictionary(letters: string) {
  const tiles = [...letters.toLowerCase()];
  const visit = (word: string, available: string[]): string | undefined => {
    if (word.length >= 3 && !WORD_TILES_DICTIONARY.has(word)) return word;
    if (word.length === 7) return undefined;
    for (const letter of new Set(available)) {
      const next = [...available]; next.splice(next.indexOf(letter), 1);
      const found = visit(word + letter, next);
      if (found) return found;
    }
    return undefined;
  };
  return visit("", tiles);
}

test("Word Tiles keeps words hidden in host, other-player, and spectator snapshots and round-trips serialization", () => {
  let room = start(); const chosen = room.wordTiles!.roundData[0]!.solutionWord;
  room = submit(room, "p1", chosen, 20_002);
  assert.equal(playerSnapshot(room, room.participants[0]!, 20_002).wordTiles?.ownWord, chosen);
  assert.equal("ownWord" in playerSnapshot(room, room.participants[1]!, 20_002).wordTiles!, false);
  assert.equal("submissions" in hostSnapshot(room, 20_002).wordTiles!, false);
  assert.equal("submissions" in audienceSnapshot(room, { ...room.participants[0]!, id: "audience-1", role: "audience" }, 20_002).wordTiles!, false);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).wordTiles, room.wordTiles);
  assert.throws(() => submit(room, "p1", "cat", 20_003), /ALREADY_LOCKED/);
});

test("Word Tiles scores all five rounds, pauses safely, recovers timeout, and replays in the same room", async () => {
  let room = start("WORDR"); const code = room.code; let now = 20_001;
  const paused = applyHostAction(room, { type: "PAUSE", actionId: "pause-word-tiles", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, ++now).next;
  assert.equal(paused.paused, true);
  const resumed = applyHostAction(paused, { type: "RESUME", actionId: "resume-word-tiles", roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, now + 100).next;
  assert.equal(resumed.paused, false); room = resumed; now += 100;
  for (let round = 1; round <= 5; round += 1) {
    const source = room.wordTiles!.roundData[round - 1]!.solutionWord;
    for (const playerId of room.wordTiles!.players) room = submit(room, playerId, source, ++now);
    room = host(room, "reveal", ++now);
    if (round < 5) room = host(room, "next", ++now);
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.wordTiles?.result?.roundsPlayed, 5);
  assert.deepEqual(deserializeRoomState(serializeRoomState(room)).wordTiles, room.wordTiles);
  const replay = applyHostAction(room, { type: "PLAY_AGAIN", actionId: "replay-word-tiles", roundId: "lobby", expectedPhase: "ARCADE_RESULTS", payload: {} }, ++now).next;
  assert.equal(replay.code, code); assert.equal(replay.phase, "LOBBY"); assert.equal(replay.wordTiles, null);
  const timeout = start("WORDT"); const deadline = timeout.wordTiles!.deadline;
  assert.equal((await advanceState(timeout, deadline + 1_999)).changed, false);
  const recovered = await advanceState(timeout, deadline + 2_000);
  assert.equal(recovered.changed, true); assert.equal(recovered.next.wordTiles?.roundResults[0]?.timedOut, true);
});

test("Word Tiles rejects corrupted persisted choices, round scores, leaders, cumulative scores, and final winners", () => {
  const active = start("BADWORD");
  const badChoice = structuredClone(active);
  const invalidButBuildable = findRackWordOutsideDictionary(badChoice.wordTiles!.roundData[0]!.letters);
  assert.ok(invalidButBuildable);
  badChoice.wordTiles!.choices.p1 = invalidButBuildable!;
  assert.throws(() => deserializeRoomState(JSON.stringify(badChoice)), /Word Tiles|wordTiles/);

  const completed = completeMatch();
  const badRoundWord = structuredClone(completed);
  const submission = badRoundWord.wordTiles!.roundResults[0]!.submissions[0]!;
  const impossibleWord = findWordMissingFromRack(badRoundWord.wordTiles!.roundResults[0]!.letters);
  assert.ok(impossibleWord);
  submission.word = impossibleWord!;
  assert.throws(() => deserializeRoomState(JSON.stringify(badRoundWord)), /Word Tiles|wordTiles/);

  const badScore = structuredClone(completed);
  badScore.wordTiles!.roundResults[0]!.submissions[0]!.scoreEarned += 1;
  assert.throws(() => deserializeRoomState(JSON.stringify(badScore)), /Word Tiles|wordTiles/);

  const badLeader = structuredClone(completed);
  badLeader.wordTiles!.roundResults[0]!.leaders = ["missing-player"];
  assert.throws(() => deserializeRoomState(JSON.stringify(badLeader)), /Word Tiles|wordTiles/);

  const badTotal = structuredClone(completed);
  badTotal.wordTiles!.roundResults[0]!.scores.p1! += 2;
  assert.throws(() => deserializeRoomState(JSON.stringify(badTotal)), /Word Tiles|wordTiles/);

  const badWinner = structuredClone(completed);
  badWinner.wordTiles!.result!.winners = ["missing-player"];
  assert.throws(() => deserializeRoomState(JSON.stringify(badWinner)), /Word Tiles|wordTiles/);
});
