import assert from "node:assert/strict";
import test from "node:test";
import { advanceKartentischTrick, chooseKartentischCard, createKartentischMatch, kartentischLegalCards, kartentischSnapshot, revealKartentischTrick } from "../server/arcade/kartentisch";

const create = (players = ["p1", "p2", "p3"], seed = 42) => createKartentischMatch({ matchId: "cards-1", players, now: 1_000, seed });

test("Kartentisch uses a seeded 52-card deck, deals five hidden cards per player, and exposes only trump", () => {
  const first = create(); const repeat = create();
  assert.deepEqual(first, repeat);
  assert.equal(new Set(Object.values(first.initialHands).flat().map((card) => card.id)).size, 15);
  assert.ok(["clubs", "diamonds", "hearts", "spades"].includes(first.trumpSuit));
  const host = kartentischSnapshot(first, { role: "host" });
  assert.equal("hands" in host, false); assert.equal("initialHands" in host, false); assert.equal("seed" in host, false);
  assert.equal(host.handCounts.p1, 5);
  const phone = kartentischSnapshot(first, { role: "player", playerId: "p1" });
  assert.equal(phone.ownHand?.length, 5); assert.equal("hands" in phone, false); assert.equal("initialHands" in phone, false);
});

test("Kartentisch validates ordered legal plays, follows suit, scores the trick winner, times out safely, and reveals hands only at the end", () => {
  let match = create();
  const lead = kartentischLegalCards(match, "p1")[0]!;
  const firstPlay = chooseKartentischCard(match, { matchId: match.matchId, trick: 1, playerId: "p1", cardId: lead.id, now: 1_001 });
  assert.equal(firstPlay.ok, true); if (!firstPlay.ok) return; match = firstPlay.state;
  assert.equal(kartentischSnapshot(match, { role: "player", playerId: "p2" }).leadSuit, lead.suit);
  assert.equal("plays" in kartentischSnapshot(match, { role: "host" }), false);
  assert.deepEqual(chooseKartentischCard(match, { matchId: match.matchId, trick: 2, playerId: "p1", cardId: lead.id, now: 1_002 }), { ok: false, code: "TRICK_MISMATCH" });
  const leadSuit = match.plays.p1!.suit; const legal = kartentischLegalCards(match, "p2");
  assert.ok(legal.length > 0 && legal.every((card) => card.suit === leadSuit || !match.hands.p2!.some((held) => held.suit === leadSuit)));
  const wrongTurn = chooseKartentischCard(match, { matchId: match.matchId, trick: 1, playerId: "p3", cardId: match.hands.p3![0]!.id, now: 1_002 });
  assert.deepEqual(wrongTurn, { ok: false, code: "WRONG_TURN" });
  const illegalOffSuit = match.hands.p2!.find((card) => card.suit !== lead.suit);
  if (match.hands.p2!.some((card) => card.suit === lead.suit) && illegalOffSuit) assert.deepEqual(chooseKartentischCard(match, { matchId: match.matchId, trick: 1, playerId: "p2", cardId: illegalOffSuit.id, now: 1_002 }), { ok: false, code: "MUST_FOLLOW_SUIT" });
  for (const playerId of ["p2", "p3"]) { const card = kartentischLegalCards(match, playerId)[0]!; const played = chooseKartentischCard(match, { matchId: match.matchId, trick: 1, playerId, cardId: card.id, now: ++match.updatedAt }); assert.equal(played.ok, true); if (played.ok) match = played.state; }
  const reveal = revealKartentischTrick(match, { now: match.updatedAt + 1 }); assert.equal(reveal.ok, true); if (!reveal.ok) return; match = reveal.state;
  assert.equal(match.trickResults.length, 1); assert.equal(Object.values(match.scores).reduce((sum, score) => sum + score, 0), 1); assert.equal(match.scores[match.trickResults[0]!.winnerPlayerId], 1);
  assert.equal(kartentischSnapshot(match, { role: "host" }).trickResult?.plays.length, 3);
  const next = advanceKartentischTrick(match, { now: match.updatedAt + 1 }); assert.equal(next.ok, true);

  let timeout = create(["a", "b", "c"], 500); let recovered;
  for (let trick = 1; trick <= 5; trick += 1) {
    recovered = revealKartentischTrick(timeout, { now: timeout.deadline }); assert.equal(recovered.ok, true); if (!recovered.ok) return; timeout = recovered.state;
    if (trick < 5) { const advanced = advanceKartentischTrick(timeout, { now: timeout.updatedAt + 1 }); assert.equal(advanced.ok, true); if (!advanced.ok) return; timeout = advanced.state; }
  }
  assert.equal(timeout.phase, "complete"); assert.equal(timeout.result?.tricksPlayed, 5);
  assert.deepEqual(timeout.result?.scores, timeout.scores); assert.equal(timeout.result?.winners.length, timeout.players.filter((id) => timeout.scores[id] === Math.max(...Object.values(timeout.scores))).length);
  const final = kartentischSnapshot(timeout, { role: "host" }); assert.ok(final.result?.hands && final.phase === "complete");
  assert.deepEqual(kartentischSnapshot(timeout, { role: "spectator" }).result, final.result);
});
