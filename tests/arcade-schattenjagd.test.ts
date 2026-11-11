import assert from "node:assert/strict";
import test from "node:test";
import { chooseSchattenjagdSuspect, createSchattenjagdMatch, nextSchattenjagdCase, revealSchattenjagdCase, schattenjagdSnapshot } from "../server/arcade/schattenjagd";

const make = (players = ["p1", "p2", "p3"]) => createSchattenjagdMatch({ matchId: "shadow-test", players, now: 15_000 });

test("Schattenjagd deals original clue fragments privately while the host sees only the public suspect board", () => {
  const match = make();
  assert.equal(match.cases.length, 4);
  for (const scenario of match.cases) {
    const matches = scenario.suspects.filter((suspect) => scenario.clues.every((clue) => suspect[clue.field] === clue.value));
    assert.deepEqual(matches.map((suspect) => suspect.id), [scenario.targetId]);
  }
  const host = schattenjagdSnapshot(match, { role: "host" });
  const first = schattenjagdSnapshot(match, { role: "player", playerId: "p1" });
  const second = schattenjagdSnapshot(match, { role: "player", playerId: "p2" });
  assert.equal("targetId" in host, false);
  assert.equal("clues" in host, false);
  assert.ok(first.ownClue);
  assert.ok(second.ownClue);
  assert.notDeepEqual(first.ownClue, second.ownClue);
  assert.equal("ownClue" in schattenjagdSnapshot(match, { role: "spectator" }), false);
});

test("Schattenjagd validates private votes, locks duplicates, scores correct picks, and reveals the case", () => {
  let match = make(["p1", "p2"]);
  const scenario = match.cases[0]!;
  const correct = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round: 1, playerId: "p1", suspectId: scenario.targetId, now: 15_001 });
  assert.equal(correct.ok, true); if (!correct.ok) return; match = correct.state;
  assert.equal(schattenjagdSnapshot(match, { role: "host" }).submissionCount, 1);
  assert.equal("votes" in schattenjagdSnapshot(match, { role: "host" }), false);
  const duplicate = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round: 1, playerId: "p1", suspectId: scenario.targetId, now: 15_002 });
  assert.equal(duplicate.ok, true); assert.equal(duplicate.ok && duplicate.idempotent, true);
  const changed = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round: 1, playerId: "p1", suspectId: scenario.suspects[0]!.id, now: 15_003 });
  assert.equal(changed.ok, false); if (!changed.ok) assert.equal(changed.code, "ALREADY_LOCKED");
  const wrong = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round: 1, playerId: "p2", suspectId: scenario.suspects.find((suspect) => suspect.id !== scenario.targetId)!.id, now: 15_004 });
  assert.equal(wrong.ok, true); if (!wrong.ok) return; match = wrong.state;
  const revealed = revealSchattenjagdCase(match, { now: 15_005 });
  assert.equal(revealed.ok, true); if (!revealed.ok) return;
  assert.equal(revealed.state.phase, "revealed");
  assert.equal(revealed.state.caseResults[0]?.correctCount, 1);
  assert.equal(revealed.state.scores.p1, 150); assert.equal(revealed.state.scores.p2, 50);
  assert.equal(schattenjagdSnapshot(revealed.state, { role: "host" }).targetId, scenario.targetId);
});

test("Schattenjagd rejects stale, invalid, and early reveals and times out missing votes as abstentions", () => {
  const match = make(["p1", "p2"]);
  const badId = chooseSchattenjagdSuspect(match, { matchId: "wrong", round: 1, playerId: "p1", suspectId: match.cases[0]!.targetId, now: 15_001 });
  assert.equal(badId.ok, false); if (!badId.ok) assert.equal(badId.code, "MATCH_MISMATCH");
  const badSuspect = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round: 1, playerId: "p1", suspectId: "unknown", now: 15_001 });
  assert.equal(badSuspect.ok, false); if (!badSuspect.ok) assert.equal(badSuspect.code, "INVALID_SUSPECT");
  assert.equal(revealSchattenjagdCase(match, { now: 15_001 }).ok, false);
  const timedOut = revealSchattenjagdCase(match, { now: match.deadline });
  assert.equal(timedOut.ok, true); if (!timedOut.ok) return;
  assert.equal(timedOut.state.caseResults[0]?.timedOut, true);
  assert.equal(timedOut.state.caseResults[0]?.votes.every((vote) => vote.timedOut && vote.suspectId === null), true);
  assert.equal(Object.values(timedOut.state.scores).every((score) => score === 0), true);
});

test("Schattenjagd never awards the teamwork bonus to a deadline abstainer", () => {
  let match = make(["p1", "p2"]);
  const target = match.cases[0]!.targetId;
  const vote = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round: 1, playerId: "p1", suspectId: target, now: 15_001 });
  assert.equal(vote.ok, true); if (!vote.ok) return; match = vote.state;
  const revealed = revealSchattenjagdCase(match, { now: match.deadline });
  assert.equal(revealed.ok, true); if (!revealed.ok) return;
  const result = revealed.state.caseResults[0]!;
  assert.equal(result.teamBonusApplied, true);
  assert.equal(result.votes[0]?.points, 150);
  assert.equal(result.votes[1]?.suspectId, null);
  assert.equal(result.votes[1]?.timedOut, true);
  assert.equal(result.votes[1]?.points, 0);
  assert.equal(revealed.state.scores.p1, 150);
  assert.equal(revealed.state.scores.p2, 0);
});

test("Schattenjagd completes four cases with stable winners and same-match progression", () => {
  let match = make(["p1", "p2"]); let now = 15_001;
  for (let round = 1; round <= 4; round += 1) {
    const target = match.cases[round - 1]!.targetId;
    for (const playerId of match.players) { const vote = chooseSchattenjagdSuspect(match, { matchId: match.matchId, round, playerId, suspectId: target, now: ++now }); assert.equal(vote.ok, true); if (vote.ok) match = vote.state; }
    const revealed = revealSchattenjagdCase(match, { now: ++now }); assert.equal(revealed.ok, true); if (revealed.ok) match = revealed.state;
    if (round < 4) { const advanced = nextSchattenjagdCase(match, { now: ++now }); assert.equal(advanced.ok, true); if (advanced.ok) match = advanced.state; }
  }
  assert.equal(match.phase, "complete");
  assert.deepEqual(match.result?.winners, ["p1", "p2"]);
  assert.equal(match.result?.casesPlayed, 4);
});
