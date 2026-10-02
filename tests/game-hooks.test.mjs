import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
test("Space Bash remote seat inputs are bounded, edge-triggered and releasable", async () => {
  const html = await readFile("games/space-bash/source/index.html", "utf8");
  const start = html.indexOf("window.SpaceBash=");
  const api = html.slice(
    start,
    html.indexOf(
      "resetRound();updateHUD();requestAnimationFrame(loop);",
      start,
    ),
  );
  const calls = [];
  const fighters = Array.from({ length: 10 }, (_, id) => ({
    id,
    alive: true,
    name: "Bot",
  }));
  const c = vm.createContext({
    window: {},
    VERSION: "test",
    playerCount: 10,
    fighters,
    remoteSeats: new Map(),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    paused: false,
    phase: "fight",
    round: 1,
    timeLeft: 90,
    wins: Array(10).fill(0),
    tiles: [],
    joy: { x: 0, z: 0 },
    grabThrow: (f) => calls.push(["grab", f.id]),
    kick: (f) => calls.push(["kick", f.id]),
    jump: (f) => calls.push(["jump", f.id]),
  });
  vm.runInContext(api, c);
  assert.equal(c.window.SpaceBash.setHumanSlot(1, true), true);
  assert.equal(
    c.window.SpaceBash.submitInput(1, {
      moveX: 3,
      moveY: -3,
      primaryAction: true,
    }),
    true,
  );
  c.window.SpaceBash.submitInput(1, {
    moveX: 0,
    moveY: 0,
    primaryAction: true,
  });
  assert.equal(c.remoteSeats.get(1).moveX, 0);
  assert.equal(calls.length, 1);
  assert.equal(c.window.SpaceBash.setHumanSlot(1, false), true);
  assert.equal(c.remoteSeats.has(1), false);
  assert.equal(c.window.SpaceBash.submitInput(10, {}), false);
});
test("Scratch human-slot changes preserve current scores and reject invalid seats", async () => {
  const html = await readFile(
    "games/royal-scratch-match/source/index.html",
    "utf8",
  );
  const start = html.indexOf("window.ScratchMatchAPI={"),
    end = html.indexOf("window.GameDebug=", start);
  const players = [
    { name: "You", score: 100 },
    { name: "Bot", score: 700 },
  ];
  const c = vm.createContext({
    window: {},
    playerCount: 2,
    humanSlots: new Set([0]),
    players,
  });
  vm.runInContext(html.slice(start, end), c);
  assert.equal(c.window.ScratchMatchAPI.setHumanSlot(1, true, "Phone"), true);
  assert.equal(players[1].score, 700);
  assert.equal(players[1].human, true);
  assert.equal(c.humanSlots.has(1), true);
  assert.equal(c.window.ScratchMatchAPI.setHumanSlot(2, true), false);
  c.window.ScratchMatchAPI.setHumanSlot(1, false);
  assert.equal(c.humanSlots.has(1), false);
  assert.equal(players[1].human, false);
});
