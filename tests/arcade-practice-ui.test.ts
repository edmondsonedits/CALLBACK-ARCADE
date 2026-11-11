import assert from "node:assert/strict";
import test from "node:test";
import { joystickInputFromPoint, practiceInputForKeys } from "../lib/arcade/practice/input";

test("desktop keys map to normalized joystick and mapped action controls", () => {
  const input = practiceInputForKeys(new Set(["w", "d", " "]), ["joystick", "jump", "action"]);
  assert.equal(Math.round(Math.hypot(input.x, input.y) * 100) / 100, 1);
  assert.equal(input.buttons.jump, true);
  assert.equal(input.buttons.action, true);
});

test("keyboard input exposes lane taps and releases cleanly", () => {
  const pressed = practiceInputForKeys(new Set(["j", "4"]), ["lane-1", "lane-2", "lane-3", "lane-4"]);
  const released = practiceInputForKeys(new Set(), ["lane-1", "lane-2", "lane-3", "lane-4"]);
  assert.equal(pressed.buttons["lane-3"], true);
  assert.equal(pressed.buttons["lane-4"], true);
  assert.equal(released.buttons["lane-3"], false);
});

test("touch joystick clamps to a unit circle and recenters outside its bounds", () => {
  const input = joystickInputFromPoint(200, 100, { left: 0, top: 0, width: 100, height: 100 });
  assert.equal(Math.round(Math.hypot(input.x, input.y) * 100) / 100, 1);
  assert.deepEqual(joystickInputFromPoint(0, 0, { left: 0, top: 0, width: 0, height: 0 }), { x: 0, y: 0 });
});
