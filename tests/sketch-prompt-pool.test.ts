import assert from "node:assert/strict";
import test from "node:test";
import { SHOWDOWN_EXAMPLES } from "../server/arcade/sketch_showdown";
import { advanceSketchRelay, createSketchRelayMatch } from "../server/arcade/sketch_relay";

test("the drawing inspiration pool contains 100 distinct, compact prompts", () => {
  assert.equal(SHOWDOWN_EXAMPLES.length, 100);
  assert.equal(new Set(SHOWDOWN_EXAMPLES.map(p => p.id)).size, 100);
  assert.equal(new Set(SHOWDOWN_EXAMPLES.map(p => p.text.trim().toLocaleLowerCase())).size, 100);
  assert.ok(SHOWDOWN_EXAMPLES.every(p => p.text.length >= 3 && p.text.length <= 45));
  assert.ok(SHOWDOWN_EXAMPLES.every(p => p.authorId === null && p.original === false));
  assert.ok(!new Set<string>(SHOWDOWN_EXAMPLES.map(p => p.text)).has("A dragon failing its driving test"));
});

test("empty prompt elections sample the whole catalogue instead of always using its first five", () => {
  const elections = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const m = createSketchRelayMatch({ matchId: "pool-test", players: ["p1", "p2", "p3"], now: 1000, rulesVersion: 2 });
    m.showdown!.shuffleSeed = `prompt-rotation-${i}`;
    const election = advanceSketchRelay(m, m.deadline).state;
    const texts = election.showdown!.promptOptions.map(p => p.text).sort();
    assert.equal(texts.length, 5);
    assert.ok(texts.every(text => SHOWDOWN_EXAMPLES.some(p => p.text === text)));
    assert.deepEqual(texts, advanceSketchRelay(m, m.deadline).state.showdown!.promptOptions.map(p => p.text).sort(), "A persisted seed must reproduce the same choices");
    elections.add(texts.join("|"));
  }
  assert.ok(elections.size > 1, "A new match should not be stuck with the first five examples");
});
