import assert from "node:assert/strict";
import test from "node:test";
import { createPocketPairsDeck, isPocketPairsSave } from "../app/components/sorcery-workshop/PocketPairsModel";

test("pocket pairs shuffles exactly six cards with three pairs", () => {
  const deck = createPocketPairsDeck(() => 0);
  assert.equal(deck.length, 6);
  assert.deepEqual([...new Set(deck)].sort(), ["♜", "✦", "♞"].sort());
  for (const symbol of new Set(deck)) assert.equal(deck.filter(card => card === symbol).length, 2);
});

test("saved pocket progress validates and rejects malformed or duplicated card indexes", () => {
  const saved = { deck: ["♜", "✦", "♞", "♜", "✦", "♞"], open: [0], matched: [1, 4], turns: 2, paused: true };
  assert.equal(isPocketPairsSave(saved), true);
  assert.equal(isPocketPairsSave({ ...saved, matched: [1, 1] }), false);
  assert.equal(isPocketPairsSave({ ...saved, turns: -1 }), false);
  assert.equal(isPocketPairsSave({ ...saved, paused: "false" }), false);
});
