import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { poseSequenceAt } from "../lib/avatar-motion";
import { NEUTRAL_POSE, type AvatarPose } from "../lib/avatar-pose";
import type { Performer } from "../app/components/sketch-relay/SketchShowdownStage";

test("a delayed first TV frame still starts the move and polling does not restart it", () => {
  let now = 0;
  let motion: { pose: AvatarPose; active: boolean } = { pose: NEUTRAL_POSE, active: false };
  let effect = () => {};
  let nextFrame = () => {};
  let hookIndex = 0;
  const refs: Array<{ current: unknown }> = [];
  const exports = {} as { Performer: typeof Performer };
  const hooks = {
    useState() { return [motion, (next: typeof motion | ((old: typeof motion) => typeof motion)) => { motion = typeof next === "function" ? next(motion) : next; }]; },
    useRef(initial: unknown) { return refs[hookIndex++] ?? (refs[hookIndex - 1] = { current: initial }); },
    useEffect(callback: () => void) { effect = callback; },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/components/sketch-relay/SketchShowdownStage.tsx", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, performance: { now: () => now }, requestAnimationFrame(callback: () => void) { nextFrame = callback; return 1; }, cancelAnimationFrame() {},
    window: { matchMedia: () => ({ matches: false }), clearTimeout() {} },
    require(name: string) { return name === "react" ? hooks : name.includes("jsx-runtime") ? { jsx: () => null, jsxs: () => null } : name.includes("avatar-motion") ? { poseSequenceAt } : name.includes("avatar-pose") ? { NEUTRAL_POSE } : name.endsWith(".css") ? { default: {} } : {}; },
  });
  const render = () => { hookIndex = 0; exports.Performer({ player: { id: "artist", nickname: "Artist" }, index: 0, serverNow: 3500, emote: { playerId: "artist", name: "dance", sequence: 1, expiresAt: 2600 } }); effect(); };
  render(); now = 3000; nextFrame();
  assert.equal(motion.active, true, "The first delayed frame must start, not consume, the performance");
  now = 3200; nextFrame(); assert.ok(Math.abs(motion.pose.leftArm) > 20);
  render(); now = 5700; nextFrame();
  assert.equal(motion.active, false, "Receiving the same event again must not restart its clock");
  assert.ok(Object.values(motion.pose).every(value => value === 0));
});
