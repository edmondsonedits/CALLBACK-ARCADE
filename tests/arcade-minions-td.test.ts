import assert from "node:assert/strict";
import test from "node:test";
import { advanceMinionsTdRound, createMinionsTdMatch, isValidMinionsTdMatch, minionsTdSnapshot, resolveMinionsTdRound, submitMinionsTdOrder } from "../server/arcade/minions_td";

const create = () => createMinionsTdMatch({ matchId: "minions-test", players: ["amber", "blue"], now: 40_000 });
const submit = (match: ReturnType<typeof create>, playerId: string, order: Parameters<typeof submitMinionsTdOrder>[1]["order"], now: number) => submitMinionsTdOrder(match, { matchId: match.matchId, round: match.round, playerId, order, now });

test("Minions TD keeps two-seat orders private and rejects unaffordable or duplicate orders", () => {
  const match = create();
  const locked = submit(match, "amber", { type: "deploy", unitId: "brute" }, 40_001);
  assert.equal(locked.ok, true);
  if (!locked.ok) return;
  assert.equal("choices" in minionsTdSnapshot(locked.state, { role: "host" }), false);
  assert.equal("ownOrder" in minionsTdSnapshot(locked.state, { role: "player", playerId: "blue" }), false);
  assert.deepEqual(minionsTdSnapshot(locked.state, { role: "player", playerId: "amber" }).ownOrder, { type: "deploy", unitId: "brute" });
  assert.equal(submit(locked.state, "amber", { type: "deploy", unitId: "runner" }, 40_002).ok, false);
  assert.equal(submit(match, "blue", { type: "deploy", unitId: "siege" }, 40_003).ok, false);
});

test("Minions TD resolves deployments, tower fire, movement, brace, and income deterministically", () => {
  const match = create();
  const amber = submit(match, "amber", { type: "deploy", unitId: "runner" }, 40_001);
  assert.equal(amber.ok, true); if (!amber.ok) return;
  const blue = submit(amber.state, "blue", { type: "brace" }, 40_002);
  assert.equal(blue.ok, true); if (!blue.ok) return;
  const revealed = resolveMinionsTdRound(blue.state, { now: 40_003 });
  assert.equal(revealed.ok, true); if (!revealed.ok) return;
  assert.deepEqual(revealed.state.waves.amber, [{ id: "1-amber-runner", unitId: "runner", health: 2, position: 2, speed: 2, damage: 1 }]);
  assert.equal(revealed.state.towerHits.blue, 1);
  assert.equal(revealed.state.health.blue, 12);
  const next = advanceMinionsTdRound(revealed.state, { transition: "next", now: 40_004 });
  assert.equal(next.ok, true); if (!next.ok) return;
  assert.equal(next.state.gold.amber, 4);
  assert.equal(next.state.gold.blue, 4);
  const timedOut = resolveMinionsTdRound(next.state, { now: next.state.deadline + 2_000 });
  assert.equal(timedOut.ok, true); if (!timedOut.ok) return;
  assert.equal(timedOut.state.roundResults.at(-1)?.timedOut, true);
});

test("Minions TD uses deterministic tower upgrades, final tiebreaks, and same-match replay state", () => {
  const match = create();
  const amber = submit(match, "amber", { type: "upgrade" }, 40_001);
  assert.equal(amber.ok, true); if (!amber.ok) return;
  const blue = submit(amber.state, "blue", { type: "deploy", unitId: "runner" }, 40_002);
  assert.equal(blue.ok, true); if (!blue.ok) return;
  const revealed = advanceMinionsTdRound(blue.state, { transition: "reveal", now: 40_003 });
  assert.equal(revealed.ok, true); if (!revealed.ok) return;
  assert.equal(revealed.state.towerLevels.amber, 2);
  assert.equal(revealed.state.roundResults[0]?.choices.amber?.order.type, "upgrade");
  const serialized = JSON.parse(JSON.stringify(revealed.state));
  assert.deepEqual(resolveMinionsTdRound(serialized, { now: 40_004 }).ok, false);
});

test("Minions TD serialization rejects a plausible but corrupted stored round result", () => {
  const match = create();
  const amber = submit(match, "amber", { type: "deploy", unitId: "runner" }, 40_001); assert.equal(amber.ok, true); if (!amber.ok) return;
  const blue = submit(amber.state, "blue", { type: "brace" }, 40_002); assert.equal(blue.ok, true); if (!blue.ok) return;
  const revealed = resolveMinionsTdRound(blue.state, { now: 40_003 }); assert.equal(revealed.ok, true); if (!revealed.ok) return;
  const corrupted = structuredClone(revealed.state); corrupted.roundResults[0]!.baseDamage.blue = 1;
  assert.equal(isValidMinionsTdMatch(revealed.state), true);
  assert.equal(isValidMinionsTdMatch(corrupted), false);
});

test("Minions TD rejects null round history and missing persisted wave records without throwing", () => {
  const match = create();
  const amber = submit(match, "amber", { type: "hold" }, 40_001); assert.equal(amber.ok, true); if (!amber.ok) return;
  const blue = submit(amber.state, "blue", { type: "hold" }, 40_002); assert.equal(blue.ok, true); if (!blue.ok) return;
  const revealed = resolveMinionsTdRound(blue.state, { now: 40_003 }); assert.equal(revealed.ok, true); if (!revealed.ok) return;

  const nullHistory = structuredClone(revealed.state) as unknown as { roundResults: unknown[] };
  nullHistory.roundResults[0] = null;
  assert.equal(isValidMinionsTdMatch(nullHistory), false);

  const missingWaves = structuredClone(revealed.state) as unknown as { roundResults: Array<Record<string, unknown>> };
  delete missingWaves.roundResults[0]!.waves;
  assert.equal(isValidMinionsTdMatch(missingWaves), false);
});

test("Minions TD rejects a final outcome label that disagrees with replayed rounds", () => {
  let match = create();
  for (let round = 1; round <= 6 && match.phase !== "complete"; round += 1) {
    const amber = submit(match, "amber", round === 1 ? { type: "deploy", unitId: "runner" } : { type: "hold" }, match.updatedAt + 1);
    assert.equal(amber.ok, true); if (!amber.ok) return;
    const blue = submit(amber.state, "blue", { type: "hold" }, amber.state.updatedAt + 1);
    assert.equal(blue.ok, true); if (!blue.ok) return;
    const resolved = resolveMinionsTdRound(blue.state, { now: blue.state.updatedAt + 1 });
    assert.equal(resolved.ok, true); if (!resolved.ok) return;
    match = resolved.state;
    if (match.phase === "revealed") {
      const next = advanceMinionsTdRound(match, { transition: "next", now: match.updatedAt + 1 });
      assert.equal(next.ok, true); if (!next.ok) return;
      match = next.state;
    }
  }
  assert.equal(match.phase, "complete");
  assert.ok(match.result?.winnerPlayerId);
  const corrupted = structuredClone(match);
  corrupted.result!.outcome = corrupted.result!.outcome === "knockout" ? "points" : "knockout";
  assert.equal(isValidMinionsTdMatch(corrupted), false);
});
