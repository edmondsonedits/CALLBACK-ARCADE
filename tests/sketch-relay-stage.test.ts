import assert from "node:assert/strict";
import test from "node:test";
import { SKETCH_RELAY_PHASES, SKETCH_RELAY_REVEAL_MS, SKETCH_RELAY_TIMERS } from "../lib/arcade/sketch-relay";
import { SKETCH_STAGE_COPY, SKETCH_REVEAL_MS, sketchRevealFrame } from "../lib/game/sketch-relay-audio";

test("TV timing uses the same reveal budget and phase durations as the server", () => {
  assert.equal(SKETCH_REVEAL_MS, SKETCH_RELAY_REVEAL_MS);
  for (const phase of SKETCH_RELAY_PHASES) assert.equal(SKETCH_STAGE_COPY[phase].duration, SKETCH_RELAY_TIMERS[phase]);
});

test("each sketch gets a six second leg with a one second original and four second dissolve", () => {
  assert.deepEqual(sketchRevealFrame(12_000), { leg: "drawing", elapsed: 0, progress: 0 });
  assert.equal(sketchRevealFrame(11_000).progress, 0);
  assert.equal(sketchRevealFrame(9_000).progress, 0.5);
  assert.equal(sketchRevealFrame(7_000).progress, 1);
  assert.deepEqual(sketchRevealFrame(6_000), { leg: "redraw", elapsed: 6_000, progress: 0 });
  assert.equal(sketchRevealFrame(5_000).progress, 0);
  assert.equal(sketchRevealFrame(3_000).progress, 0.5);
  assert.equal(sketchRevealFrame(1_000).progress, 1);
});

test("reconnect and replay derive presentation from the supplied remaining time", () => {
  assert.equal(sketchRevealFrame(2_500).leg, "redraw");
  assert.equal(sketchRevealFrame(2_500).progress, 0.625);
  assert.equal(sketchRevealFrame(12_000).leg, "drawing");
  assert.equal(sketchRevealFrame(12_000).progress, 0);
});

test("unknown and out-of-range clocks cannot advance the room or overflow the fade", () => {
  assert.deepEqual(sketchRevealFrame(null), { leg: "drawing", elapsed: 0, progress: 0 });
  assert.deepEqual(sketchRevealFrame(undefined), { leg: "drawing", elapsed: 0, progress: 0 });
  assert.deepEqual(sketchRevealFrame(20_000), { leg: "drawing", elapsed: 0, progress: 0 });
  assert.deepEqual(sketchRevealFrame(-500), { leg: "redraw", elapsed: 12_000, progress: 1 });
});
