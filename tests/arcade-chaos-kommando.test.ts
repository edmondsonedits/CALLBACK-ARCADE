import assert from "node:assert/strict";
import test from "node:test";
import { advanceChaosMission, chooseChaosTool, createChaosMatch, chaosSnapshot } from "../server/arcade/chaos_kommando";

test("Chaos-Kommando locks private tools, resolves mission coverage, and reveals missing choices only after lock", () => {
  let match = createChaosMatch({ matchId: "chaos-1", players: ["a", "b", "c"], now: 10_000, seed: 7 });
  assert.equal(match.missionNumber, 1);
  assert.equal("choices" in chaosSnapshot(match, { role: "host" }), false);
  const resultA = chooseChaosTool(match, { matchId: match.matchId, missionNumber: 1, playerId: "a", toolId: "grid-kit", now: 10_001 });
  assert.equal(resultA.ok, true);
  if (!resultA.ok) return;
  match = resultA.state;
  const own = chaosSnapshot(match, { role: "player", playerId: "a" });
  assert.equal("ownToolId" in own ? own.ownToolId : null, match.choices.a);
  assert.equal("ownToolId" in chaosSnapshot(match, { role: "player", playerId: "b" }), false);
  assert.equal(chaosSnapshot(match, { role: "host" }).submissionCount, 1);
  const early = advanceChaosMission(match, { now: 10_002 });
  assert.equal(!early.ok ? early.code : null, "TOO_EARLY");
  const timedOut = advanceChaosMission(match, { now: match.deadline + 1 });
  assert.equal(timedOut.ok, true);
  if (!timedOut.ok) return;
  assert.equal(timedOut.state.phase, "revealed");
  assert.equal(timedOut.state.missionResults.at(-1)?.submissions.filter((entry) => entry.toolId === null).length, 2);
  assert.equal(timedOut.state.missionResults.at(-1)?.outcome, "timeout");
  assert.equal(timedOut.state.missionResults.at(-1)?.score, 0);
  const revealed = chaosSnapshot(timedOut.state, { role: "player", playerId: "b" });
  assert.equal("submissions" in revealed ? revealed.submissions?.length : 0, 3);
});

test("a timed-out mission cannot earn a perfect clear when a phone never locks a tool", () => {
  let match = createChaosMatch({ matchId: "chaos-timeout", players: ["a", "b", "c"], now: 20_000, seed: 9 });
  for (const [playerId, toolId] of [["a", "grid-kit"], ["b", "spare-fuse"]] as const) {
    const submitted = chooseChaosTool(match, { matchId: match.matchId, missionNumber: 1, playerId, toolId, now: 20_001 });
    assert.equal(submitted.ok, true);
    if (!submitted.ok) return;
    match = submitted.state;
  }
  const resolved = advanceChaosMission(match, { now: match.deadline + 1 });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const mission = resolved.state.missionResults.at(-1);
  assert.equal(mission?.coveredTags.length, 2);
  assert.equal(mission?.outcome, "timeout");
  assert.equal(mission?.score, 0);
});
