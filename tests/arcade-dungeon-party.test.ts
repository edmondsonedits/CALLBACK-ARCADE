import assert from "node:assert/strict";
import test from "node:test";
import { chooseDungeonPartyAction, createDungeonPartyMatch, dungeonPartySnapshot, nextDungeonPartyEncounter, revealDungeonPartyEncounter } from "../server/arcade/dungeon_party";

const start = () => createDungeonPartyMatch({ matchId: "dungeon-1", players: ["a", "b", "c"], now: 1_000 });

test("Dungeon Party keeps choices private, resolves three original encounters deterministically, and exposes score/outcome", () => {
  let match = start(); const repeated = start(); assert.deepEqual(match, repeated);
  const owner = chooseDungeonPartyAction(match, { matchId: match.matchId, encounter: 1, playerId: "a", actionId: "strike", now: 1_001 });
  assert.equal(owner.ok, true); if (!owner.ok) return; match = owner.state;
  assert.equal(dungeonPartySnapshot(match, { role: "player", playerId: "a" }).ownActionId, "strike");
  assert.equal("ownActionId" in dungeonPartySnapshot(match, { role: "player", playerId: "b" }), false);
  assert.equal("choices" in dungeonPartySnapshot(match, { role: "host" }), false);
  assert.equal("seed" in dungeonPartySnapshot(match, { role: "spectator" }), false);
  for (const playerId of ["b", "c"]) { const action = chooseDungeonPartyAction(match, { matchId: match.matchId, encounter: 1, playerId, actionId: "strike", now: ++match.updatedAt }); assert.equal(action.ok, true); if (action.ok) match = action.state; }
  const reveal = revealDungeonPartyEncounter(match, { now: match.updatedAt + 1 }); assert.equal(reveal.ok, true); if (!reveal.ok) return; match = reveal.state;
  assert.equal(match.encounterResults[0]?.success, true); assert.equal(match.encounterResults[0]?.progress, 3); assert.equal(match.score, 1_000);
  assert.equal(dungeonPartySnapshot(match, { role: "host" }).encounterResult?.actions.length, 3);
  for (let encounter = 2; encounter <= 3; encounter += 1) {
    const next = nextDungeonPartyEncounter(match, { now: match.updatedAt + 1 }); assert.equal(next.ok, true); if (!next.ok) return; match = next.state;
    const actionId = encounter === 2 ? "decode" : "spell";
    for (const playerId of match.players) { const choose = chooseDungeonPartyAction(match, { matchId: match.matchId, encounter, playerId, actionId, now: ++match.updatedAt }); assert.equal(choose.ok, true); if (choose.ok) match = choose.state; }
    const finish = revealDungeonPartyEncounter(match, { now: match.updatedAt + 1 }); assert.equal(finish.ok, true); if (!finish.ok) return; match = finish.state;
  }
  assert.equal(match.phase, "complete"); assert.equal(match.encounterResults.length, 3); assert.equal(match.result?.score, 3_000); assert.equal(match.result?.outcome, "escaped");
});

test("Dungeon Party timeout safely guards, never full-clears missing choices, and rejects stale/duplicate inputs", () => {
  let match = start();
  const stale = chooseDungeonPartyAction(match, { matchId: match.matchId, encounter: 2, playerId: "a", actionId: "strike", now: 1_001 }); assert.deepEqual(stale, { ok: false, code: "ENCOUNTER_MISMATCH" });
  const first = chooseDungeonPartyAction(match, { matchId: match.matchId, encounter: 1, playerId: "a", actionId: "strike", now: 1_001 }); assert.equal(first.ok, true); if (!first.ok) return; match = first.state;
  assert.deepEqual(chooseDungeonPartyAction(match, { matchId: match.matchId, encounter: 1, playerId: "a", actionId: "guard", now: 1_002 }), { ok: false, code: "ALREADY_LOCKED" });
  assert.deepEqual(revealDungeonPartyEncounter(match, { now: 1_002 }), { ok: false, code: "TOO_EARLY" });
  const timedOut = revealDungeonPartyEncounter(match, { now: match.deadline }); assert.equal(timedOut.ok, true); if (!timedOut.ok) return;
  assert.equal(timedOut.state.encounterResults[0]?.timedOut, true); assert.deepEqual(timedOut.state.encounterResults[0]?.actions.map((entry) => entry.actionId), ["strike", "guard", "guard"]);
  assert.equal(timedOut.state.encounterResults[0]?.success, false);
});

test("Dungeon Party can fall after three failed encounters, and a late reveal is not a timeout if every move was locked", () => {
  let match = start();
  for (let encounter = 1; encounter <= 3; encounter += 1) {
    for (const playerId of match.players) {
      const move = chooseDungeonPartyAction(match, { matchId: match.matchId, encounter, playerId, actionId: ["guard", "brace", "ward"][encounter - 1]!, now: ++match.updatedAt });
      assert.equal(move.ok, true); if (move.ok) match = move.state;
    }
    const resolved = revealDungeonPartyEncounter(match, { now: encounter === 1 ? match.updatedAt + 1 : match.deadline });
    assert.equal(resolved.ok, true); if (!resolved.ok) return; match = resolved.state;
    assert.equal(match.encounterResults.at(-1)?.success, false);
    if (encounter < 3) { const next = nextDungeonPartyEncounter(match, { now: match.updatedAt + 1 }); assert.equal(next.ok, true); if (!next.ok) return; match = next.state; }
  }
  assert.equal(match.phase, "complete"); assert.equal(match.health, 0); assert.equal(match.result?.outcome, "fallen");

  let complete = start();
  for (const playerId of complete.players) { const move = chooseDungeonPartyAction(complete, { matchId: complete.matchId, encounter: 1, playerId, actionId: "strike", now: ++complete.updatedAt }); assert.equal(move.ok, true); if (move.ok) complete = move.state; }
  const lateReveal = revealDungeonPartyEncounter(complete, { now: complete.deadline });
  assert.equal(lateReveal.ok, true); if (lateReveal.ok) assert.equal(lateReveal.state.encounterResults[0]?.timedOut, false);
});
