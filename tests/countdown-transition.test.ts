import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { RoleSnapshot } from "../lib/contracts";
import type { useCountdown } from "../app/components/useRoomSync";

test("a changed deadline is correct on the first render, before effects can refresh the countdown", () => {
  const slots: unknown[] = []; const effects: Array<() => void> = []; let cursor = 0;
  const exports = {} as { useCountdown: typeof useCountdown };
  runInNewContext(ts.transpileModule(readFileSync(new URL("../app/components/useRoomSync.ts", import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, performance: { now: () => 100 }, setInterval: () => 1, clearInterval: () => {},
    require: () => ({ useState(initial: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next: unknown) => { slots[i] = next; }]; }, useRef(initial: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; }, useEffect(effect: () => void) { effects.push(effect); } }),
  });
  const read = (deadlineAt: number, paused = false) => { cursor = 0; return exports.useCountdown({ phase: "ARCADE_ACTIVE", serverTime: 10_000, deadlineAt, paused } as RoleSnapshot); };
  assert.equal(read(40_000), 30_000); for (const effect of effects.splice(0)) effect();
  assert.equal(read(250_000), 240_000, "The drawing introduction must not receive the previous ballot's 30-second clock");
  assert.equal(read(250_000, true), null, "Pause is effective before its effect executes");
});
