import assert from "node:assert/strict";
import test from "node:test";
import { practiceSceneEntities } from "../app/components/practice-scene-model";

test("practice scene includes game entities that use game-specific snapshot keys", () => {
  const cases = [
    ["paint-panic", { creatures: [{ x: 1, y: 2 }] }],
    ["dragon-drop", { shots: [{ x: 3, y: 4 }], target: { x: 0, y: -2 } }],
    ["rhythm", { tick: 10, upcoming: [{ tick: 20, lane: 2 }] }],
    ["tailblazer", { trails: [{ segments: [[100, 200], [300, 400]] }] }],
    ["metal-fox", { walls: [{ x: -1, y: 1 }], hazard: { x: 2, y: 3 } }],
    ["tie-breaker", { core: { players: { human: { x: 2, y: 1 } }, crates: [{ x: 1, y: 0 }] } }],
    ["twisted-system", { tick: 10, cueSequence: [{ id: "jump-1", requiredAction: "jump", cueTick: 15, hitTick: 20 }] }],
  ] as const;
  for (const [gameId, snapshot] of cases) {
    const scene = practiceSceneEntities(gameId, snapshot);
    assert.ok(scene.entities.length + scene.notes.length + scene.cues.length + scene.paths.length > 0, `${gameId} must expose visible scene data`);
  }
  const rhythm = practiceSceneEntities("rhythm", { tick: 10, upcoming: [{ tick: 20, lane: 2 }] });
  assert.equal(rhythm.notes[0]?.lane, 2);
  const trail = practiceSceneEntities("tailblazer", { trails: [{ segments: [[100, 200], [300, 400]] }] });
  assert.equal(trail.paths[0]?.length, 2);
  const tieBreaker = practiceSceneEntities("tie-breaker", { core: { players: { human: { x: 2, y: 1 } }, crates: [{ x: 1, y: 0 }] } });
  assert.equal(tieBreaker.state.players && Object.keys(tieBreaker.state.players as object).length, 1);
  assert.equal(tieBreaker.entities[0]?.sceneKind, "crates");
  const twisted = practiceSceneEntities("twisted-system", { tick: 10, cueSequence: [{ id: "jump-1", requiredAction: "jump", cueTick: 15, hitTick: 20 }] });
  assert.equal(twisted.cues[0]?.requiredAction, "jump");
});
