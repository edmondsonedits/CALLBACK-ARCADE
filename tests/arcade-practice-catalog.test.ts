import assert from "node:assert/strict";
import test from "node:test";
import { PRACTICE_GAMES, getPracticeGame } from "../lib/arcade/practice/catalog";

const expectedIds = [
  "sumo", "twisted-system", "roller-ruckus", "scratch-match", "tailblazer",
] as const;

test("practice catalog contains exactly five active uniquely identified games", () => {
  const ids = PRACTICE_GAMES.map((game) => game.id);
  assert.equal(ids.length, 5);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...expectedIds].sort());
});

test("each practice game has usable instructions, controls, and tuning version", () => {
  for (const game of PRACTICE_GAMES) {
    assert.ok(game.title.trim(), game.id);
    assert.ok(game.instructions.trim(), game.id);
    assert.ok(game.controls.length > 0, game.id);
    assert.ok(game.tuningVersion.trim(), game.id);
    assert.equal(typeof game.load, "function", game.id);
  }
});


test("every registered game loads only its statically mapped practice loadedGame", async () => {
  for (const game of PRACTICE_GAMES) {
    const loadedGame = await game.load();
    assert.equal(loadedGame.id, game.id);
  }
});
test("practice route lookup rejects unknown and malformed IDs", () => {
  assert.equal(getPracticeGame("sumo")?.id, "sumo");
  for (const id of ["", "../sumo", "SUMO", "sumo?x=1", "not-a-game"]) {
    assert.equal(getPracticeGame(id), null, id);
  }
});
