import assert from "node:assert/strict";
import test from "node:test";
import { chooseMagicArenaAction, createMagicArenaMatch, magicArenaSnapshot, revealMagicArenaRound } from "../server/arcade/magic_arena";

test("Magic Arena hides simultaneous choices, resolves its original rules deterministically, and defaults missing moves to Focus", () => {
  let match = createMagicArenaMatch({ matchId: "magic-match-1", players: ["ember", "cobalt"], now: 20_000 });
  assert.equal(match.round, 1); assert.equal(match.roundCount, 5);
  assert.equal("choices" in magicArenaSnapshot(match, { role: "host" }), false);
  const first = chooseMagicArenaAction(match, { matchId: match.matchId, round: 1, playerId: "ember", action: "strike", now: 20_001 });
  assert.equal(first.ok, true); if (!first.ok) return; match = first.state;
  const own = magicArenaSnapshot(match, { role: "player", playerId: "ember" });
  assert.equal("ownAction" in own ? own.ownAction : undefined, "strike");
  assert.equal("ownAction" in magicArenaSnapshot(match, { role: "player", playerId: "cobalt" }), false);
  assert.equal("choices" in magicArenaSnapshot(match, { role: "host" }), false);
  assert.equal(chooseMagicArenaAction(match, { matchId: match.matchId, round: 1, playerId: "ember", action: "focus", now: 20_002 }).ok, false);
  const second = chooseMagicArenaAction(match, { matchId: match.matchId, round: 1, playerId: "cobalt", action: "focus", now: 20_003 });
  assert.equal(second.ok, true); if (!second.ok) return; match = second.state;
  const revealed = revealMagicArenaRound(match, { now: 20_004 });
  assert.equal(revealed.ok, true); if (!revealed.ok) return;
  assert.equal(revealed.state.phase, "revealed");
  assert.equal(revealed.state.roundResults[0]?.actions.ember, "strike");
  assert.equal(revealed.state.roundResults[0]?.actions.cobalt, "focus");
  assert.equal(revealed.state.health.cobalt, 4);
  assert.equal(revealed.state.energy.ember, 1);
  assert.equal(revealed.state.energy.cobalt, 3);
  const finalReveal = revealMagicArenaRound(createMagicArenaMatch({ matchId: "deadline-match", players: ["ember", "cobalt"], now: 30_000 }), { now: 70_000 });
  assert.equal(finalReveal.ok, true); if (!finalReveal.ok) return;
  assert.deepEqual(finalReveal.state.roundResults[0]?.actions, { ember: "focus", cobalt: "focus" });
  assert.equal(finalReveal.state.roundResults[0]?.outcome, "timeout");
  assert.deepEqual(finalReveal.state.health, { ember: 6, cobalt: 6 });
  assert.deepEqual(finalReveal.state.energy, { ember: 3, cobalt: 3 });
});

test("a late host reveal preserves already locked actions without reporting a timeout", () => {
  let match = createMagicArenaMatch({ matchId: "late-reveal-match", players: ["ember", "cobalt"], now: 90_000 });
  const strike = chooseMagicArenaAction(match, { matchId: match.matchId, round: 1, playerId: "ember", action: "strike", now: 90_001 });
  assert.equal(strike.ok, true); if (!strike.ok) return; match = strike.state;
  const guard = chooseMagicArenaAction(match, { matchId: match.matchId, round: 1, playerId: "cobalt", action: "guard", now: 90_002 });
  assert.equal(guard.ok, true); if (!guard.ok) return; match = guard.state;
  const revealed = revealMagicArenaRound(match, { now: match.deadline + 1 });
  assert.equal(revealed.ok, true); if (!revealed.ok) return;
  assert.equal(revealed.state.roundResults[0]?.outcome, "blocked");
  assert.deepEqual(revealed.state.roundResults[0]?.actions, { ember: "strike", cobalt: "guard" });
});
