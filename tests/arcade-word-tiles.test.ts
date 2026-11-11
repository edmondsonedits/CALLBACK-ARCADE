import assert from "node:assert/strict";
import test from "node:test";
import { chooseWordTilesWord, createWordTilesMatch, nextWordTilesRound, revealWordTilesRound, wordTilesSnapshot, WORD_TILES_DICTIONARY } from "../server/arcade/word_tiles";

const make = (players = ["p1", "p2", "p3"]) => createWordTilesMatch({ matchId: "word-tiles-test", players, now: 10_000, seed: 42 });

test("Word Tiles creates deterministic five-round racks with a guaranteed playable word", () => {
  assert.ok([...WORD_TILES_DICTIONARY].every((word) => /^[a-z]{3,7}$/u.test(word)));
  const a = make(); const b = make();
  assert.deepEqual(a.roundData, b.roundData);
  assert.equal(a.roundData.length, 5);
  for (const round of a.roundData) {
    assert.equal(round.letters.length, 7);
    assert.match(round.letters, /^[A-Z]{7}$/);
    assert.ok(round.solutionWord.length >= 3 && round.solutionWord.length <= 7);
    assert.ok([...round.solutionWord].every((letter) => [...round.letters].filter((tile) => tile === letter.toUpperCase()).length >= [...round.solutionWord].filter((char) => char === letter).length));
  }
});

test("Word Tiles validates dictionary and tile counts, locks each player's private word, and only reveals after resolution", () => {
  let match = make(); const source = match.roundData[0]!.solutionWord;
  assert.equal(chooseWordTilesWord(match, { matchId: match.matchId, round: 1, playerId: "p1", word: "notaword", now: 10_001 }).ok, false);
  const chosen = chooseWordTilesWord(match, { matchId: match.matchId, round: 1, playerId: "p1", word: source, now: 10_002 });
  assert.equal(chosen.ok, true); if (!chosen.ok) return; match = chosen.state;
  const owner = wordTilesSnapshot(match, { role: "player", playerId: "p1" });
  const rival = wordTilesSnapshot(match, { role: "player", playerId: "p2" });
  const host = wordTilesSnapshot(match, { role: "host" });
  assert.equal(owner.ownWord, source); assert.equal(rival.submitted, false);
  assert.equal("submissions" in host, false); assert.equal("ownWord" in rival, false);
  const duplicate = chooseWordTilesWord(match, { matchId: match.matchId, round: 1, playerId: "p1", word: source, now: 10_003 });
  assert.equal(duplicate.ok, true);
  const locked = chooseWordTilesWord(match, { matchId: match.matchId, round: 1, playerId: "p1", word: "cat", now: 10_004 });
  assert.equal(locked.ok, false); if (!locked.ok) assert.equal(locked.code, "ALREADY_LOCKED");
});

test("Word Tiles rejects stale match/round submissions and words that do not fit the rack", () => {
  const match = make(); const solution = match.roundData[0]!.solutionWord;
  const staleMatch = chooseWordTilesWord(match, { matchId: "other-match", round: 1, playerId: "p1", word: solution, now: 10_001 });
  assert.equal(staleMatch.ok, false); if (!staleMatch.ok) assert.equal(staleMatch.code, "MATCH_MISMATCH");
  const staleRound = chooseWordTilesWord(match, { matchId: match.matchId, round: 2, playerId: "p1", word: solution, now: 10_001 });
  assert.equal(staleRound.ok, false); if (!staleRound.ok) assert.equal(staleRound.code, "ROUND_MISMATCH");
  const rack = match.roundData[0]!.letters.toLowerCase();
  const impossibleWord = [...WORD_TILES_DICTIONARY].find((word) => [...word].some((letter) => rack.split(letter).length - 1 < [...word].filter((item) => item === letter).length));
  assert.ok(impossibleWord);
  const impossible = chooseWordTilesWord(match, { matchId: match.matchId, round: 1, playerId: "p1", word: impossibleWord!, now: 10_001 });
  assert.equal(impossible.ok, false); if (!impossible.ok) assert.equal(impossible.code, "WORD_NOT_IN_RACK");
});

test("Word Tiles resolves server scores and chooses a timed-out pass instead of a full clear", () => {
  let match = make(["p1", "p2"]); const first = match.roundData[0]!.solutionWord;
  const valid = chooseWordTilesWord(match, { matchId: match.matchId, round: 1, playerId: "p1", word: first, now: 10_001 });
  assert.equal(valid.ok, true); if (!valid.ok) return; match = valid.state;
  const result = revealWordTilesRound(match, { now: match.deadline });
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.state.phase, "revealed");
  assert.equal(result.state.roundResults[0]?.submissions.find((entry) => entry.playerId === "p1")?.word, first);
  assert.equal(result.state.roundResults[0]?.submissions.find((entry) => entry.playerId === "p2")?.timedOut, true);
  assert.ok(result.state.scores.p1! > 0); assert.equal(result.state.scores.p2, 0);
  assert.equal(revealWordTilesRound(match, { now: 10_010 }).ok, false);
});

test("Word Tiles completes five rounds and retains a reproducible final result", () => {
  let match = make(["p1", "p2"]); let now = 10_001;
  for (let round = 1; round <= 5; round += 1) {
    for (const playerId of match.players) {
      const submission = chooseWordTilesWord(match, { matchId: match.matchId, round, playerId, word: match.roundData[round - 1]!.solutionWord, now: ++now });
      assert.equal(submission.ok, true); if (submission.ok) match = submission.state;
    }
    const revealed = revealWordTilesRound(match, { now: ++now }); assert.equal(revealed.ok, true); if (revealed.ok) match = revealed.state;
    if (round < 5) { const advanced = nextWordTilesRound(match, { now: ++now }); assert.equal(advanced.ok, true); if (advanced.ok) match = advanced.state; }
  }
  assert.equal(match.phase, "complete"); assert.equal(match.result?.roundsPlayed, 5);
  assert.deepEqual(match.result?.winners, ["p1", "p2"]);
  assert.equal(wordTilesSnapshot(match, { role: "host" }).roundResults.length, 5);
});
