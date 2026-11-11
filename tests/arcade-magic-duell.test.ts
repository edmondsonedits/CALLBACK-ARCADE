import assert from "node:assert/strict";
import test from "node:test";
import { advanceMagicDuellRound, beginMagicDuell, chooseMagicDuellCast, chooseMagicDuellLoadout, classifyMagicDuellGesture, createMagicDuellMatch, magicDuellSnapshot, revealMagicDuellRound } from "../server/arcade/magic_duell";

const bolt = [{ x: .1, y: .5 }, { x: .28, y: .34 }, { x: .45, y: .2 }, { x: .2, y: .8 }, { x: .85, y: .4 }];
const shield = [{ x: .5, y: .1 }, { x: .85, y: .4 }, { x: .7, y: .85 }, { x: .3, y: .85 }, { x: .15, y: .4 }, { x: .5, y: .1 }];
const loop = Array.from({ length: 17 }, (_, index) => { const angle = (index / 16) * Math.PI * 2; return { x: .5 + .38 * Math.cos(angle), y: .5 + .38 * Math.sin(angle) }; });
const start = () => createMagicDuellMatch({ matchId: "duel-test", players: ["ember", "cobalt"], now: 20_000 });
const load = (match: ReturnType<typeof start>) => {
  const first = chooseMagicDuellLoadout(match, { matchId: match.matchId, playerId: "ember", spellIds: ["comet-lance", "spark-bolt", "stillwater"], now: 20_001 });
  assert.equal(first.ok, true); if (!first.ok) return match;
  const second = chooseMagicDuellLoadout(first.state, { matchId: match.matchId, playerId: "cobalt", spellIds: ["spark-bolt", "prism-ward", "stillwater"], now: 20_002 });
  assert.equal(second.ok, true); if (!second.ok) return first.state;
  const begun = beginMagicDuell(second.state, { now: 20_003 });
  assert.equal(begun.ok, true); return begun.ok ? begun.state : second.state;
};

test("Magic Duell deterministically classifies bounded bolt, shield, and loop strokes", () => {
  assert.equal(classifyMagicDuellGesture(bolt), "bolt");
  const pointerInterpolatedBolt = bolt.flatMap((point, index) => {
    const previous = bolt[index - 1];
    if (!previous) return [point];
    return Array.from({ length: 4 }, (_, step) => ({
      x: previous.x + (point.x - previous.x) * ((step + 1) / 4),
      y: previous.y + (point.y - previous.y) * ((step + 1) / 4),
    }));
  });
  assert.equal(classifyMagicDuellGesture(pointerInterpolatedBolt), "bolt");
  assert.equal(classifyMagicDuellGesture(shield), "shield");
  assert.equal(classifyMagicDuellGesture(loop), "loop");
  assert.equal(classifyMagicDuellGesture([{ x: 0, y: 0 }, { x: 1.2, y: .2 }]), null);
  assert.equal(classifyMagicDuellGesture(Array.from({ length: 33 }, (_, index) => ({ x: index / 32, y: .5 }))), null);
});

test("Magic Duell locks private three-spell loadouts and validates drafted gesture casts", () => {
  const match = start();
  const host = magicDuellSnapshot(match, { role: "host" });
  assert.equal(host.phase, "drafting");
  assert.equal("loadouts" in host, false);
  const invalid = chooseMagicDuellLoadout(match, { matchId: match.matchId, playerId: "ember", spellIds: ["comet-lance", "comet-lance", "stillwater"], now: 20_001 });
  assert.equal(invalid.ok, false);
  const draft = chooseMagicDuellLoadout(match, { matchId: match.matchId, playerId: "ember", spellIds: ["comet-lance", "spark-bolt", "stillwater"], now: 20_001 });
  assert.equal(draft.ok, true); if (!draft.ok) return;
  assert.deepEqual(magicDuellSnapshot(draft.state, { role: "player", playerId: "ember" }).ownLoadout, ["comet-lance", "spark-bolt", "stillwater"]);
  assert.equal("ownLoadout" in magicDuellSnapshot(draft.state, { role: "player", playerId: "cobalt" }), false);
  assert.equal("loadouts" in magicDuellSnapshot(draft.state, { role: "host" }), false);
  const second = chooseMagicDuellLoadout(draft.state, { matchId: match.matchId, playerId: "cobalt", spellIds: ["spark-bolt", "prism-ward", "stillwater"], now: 20_002 });
  assert.equal(second.ok, true); if (!second.ok) return;
  const begun = beginMagicDuell(second.state, { now: 20_003 });
  assert.equal(begun.ok, true); if (!begun.ok) return;
  assert.equal(chooseMagicDuellCast(begun.state, { matchId: match.matchId, round: 1, playerId: "ember", spellId: "mirror-shield", stroke: shield, now: 20_004 }).ok, false);
  assert.equal(chooseMagicDuellCast(begun.state, { matchId: match.matchId, round: 1, playerId: "ember", spellId: "comet-lance", stroke: shield, now: 20_004 }).ok, false);
  const cast = chooseMagicDuellCast(begun.state, { matchId: match.matchId, round: 1, playerId: "ember", spellId: "comet-lance", stroke: bolt, now: 20_004 });
  assert.equal(cast.ok, true); if (!cast.ok) return;
  assert.equal("ownSpellId" in magicDuellSnapshot(cast.state, { role: "player", playerId: "ember" }), true);
  assert.equal("choices" in magicDuellSnapshot(cast.state, { role: "host" }), false);
  assert.equal("ownSpellId" in magicDuellSnapshot(cast.state, { role: "player", playerId: "cobalt" }), false);
});

test("Magic Duell resolves bolt versus ward after mana recovery and defaults a deadline cast to Rest", () => {
  let match = load(start());
  const first = chooseMagicDuellCast(match, { matchId: match.matchId, round: 1, playerId: "ember", spellId: "comet-lance", stroke: bolt, now: 20_004 });
  assert.equal(first.ok, true); if (!first.ok) return; match = first.state;
  const second = chooseMagicDuellCast(match, { matchId: match.matchId, round: 1, playerId: "cobalt", spellId: "prism-ward", stroke: shield, now: 20_005 });
  assert.equal(second.ok, true); if (!second.ok) return; match = second.state;
  const revealed = revealMagicDuellRound(match, { now: 20_006 });
  assert.equal(revealed.ok, true); if (!revealed.ok) return; match = revealed.state;
  assert.equal(match.roundResults[0]?.damage.cobalt, 1);
  assert.equal(match.health.cobalt, 11);
  assert.equal(match.mana.ember, 1);
  assert.equal(match.mana.cobalt, 2);
  const advanced = advanceMagicDuellRound(match, { now: 20_007 });
  assert.equal(advanced.ok, true); if (!advanced.ok) return; match = advanced.state;
  const timeout = revealMagicDuellRound(match, { now: match.deadline });
  assert.equal(timeout.ok, true); if (!timeout.ok) return;
  assert.equal(timeout.state.roundResults[1]?.timedOut, true);
  assert.deepEqual(timeout.state.roundResults[1]?.casts, { ember: { spellId: "rest", gesture: "loop", timedOut: true }, cobalt: { spellId: "rest", gesture: "loop", timedOut: true } });
});

test("Magic Duell finishes at five rounds with deterministic health and mana tiebreak", () => {
  let match = load(start());
  for (let round = 1; round <= 5; round += 1) {
    const cast = chooseMagicDuellCast(match, { matchId: match.matchId, round, playerId: "ember", spellId: round < 3 ? "comet-lance" : "spark-bolt", stroke: bolt, now: match.updatedAt + 1 });
    assert.equal(cast.ok, true, cast.ok ? undefined : cast.code); if (cast.ok) match = cast.state;
    const revealed = revealMagicDuellRound(match, { now: match.deadline });
    assert.equal(revealed.ok, true); if (!revealed.ok) return; match = revealed.state;
    if (round < 5 && match.phase !== "complete") { const next = advanceMagicDuellRound(match, { now: match.updatedAt + 1 }); assert.equal(next.ok, true); if (next.ok) match = next.state; }
  }
  assert.equal(match.phase, "complete");
  assert.equal(match.result?.roundsPlayed, match.roundResults.length);
  assert.ok(match.result?.winnerPlayerId === "ember" || match.result?.winnerPlayerId === null);
});
