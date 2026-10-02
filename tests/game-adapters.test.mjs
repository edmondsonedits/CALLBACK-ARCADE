import test from "node:test";
import assert from "node:assert/strict";
import { createAdapter, GAME_CONTROLS } from "../public/game-adapters.js";
test("Ballistix adapter preserves bounded input, bot release and pause seam", () => {
  const calls = [];
  const w = {
    RoyalBallistix: {
      setPlayerCount: (n) => calls.push(["count", n]),
      setPlayerInput: (s, p) => calls.push(["input", s, p]),
      releasePlayer: (s) => calls.push(["release", s]),
      setPaused: (v) => calls.push(["pause", v]),
      getState: () => ({ phase: "fight" }),
    },
  };
  const a = createAdapter("royal-ballistix", w);
  a.configure();
  a.input(
    1,
    { moveX: 0.5, primaryAction: true, secondaryAction: false, run: false },
    1,
  );
  a.release(1);
  a.pause(true);
  assert.equal(calls[0][1], 10);
  assert.equal(calls[1][2].sequence, 1);
  assert.deepEqual(calls[2], ["release", 1]);
  assert.deepEqual(calls[3], ["pause", true]);
});
test("Twisted translates held actions into one jump edge and duck release", () => {
  const calls = [];
  const w = {
    RoyalTwisted: {
      setPlayerCount: () => {},
      registerRemotePlayer: () => {},
      releaseRemotePlayer: () => {},
      input: (...x) => calls.push(x),
      setPaused: () => {},
      getState: () => ({}),
    },
  };
  const a = createAdapter("royal-twisted", w);
  a.claim(1, "Phone");
  a.input(1, { primaryAction: true, secondaryAction: true }, 1);
  a.input(1, { primaryAction: true, secondaryAction: true }, 2);
  a.input(1, { primaryAction: false, secondaryAction: false }, 3);
  assert.equal(calls.filter((x) => x[1] === "jump").length, 1);
  assert.deepEqual(calls.at(-1), [1, "duck", false]);
});
test("Scratch claim/release uses the non-resetting human slot hook", () => {
  const calls = [];
  const w = {
    ScratchMatchAPI: {
      configure: () => {},
      setHumanSlot: (...x) => calls.push(x),
      press: (...x) => calls.push(x),
      setPaused: () => {},
      getState: () => ({}),
    },
  };
  const a = createAdapter("royal-scratch-match", w);
  a.claim(2, "Phone");
  a.input(2, { lane: 3 }, 1);
  a.release(2);
  assert.deepEqual(calls, [
    [2, true, "Phone"],
    [2, 3],
    [2, false],
  ]);
});
test("all six games have a controller definition", () =>
  assert.equal(Object.keys(GAME_CONTROLS).length, 6));

test("Sumo interruption clears charge without a release attack; disconnected seats stay released", () => {
  const calls = [];
  const api = {
    setHumanSlot: (...v) => calls.push(["seat", ...v]),
    setPlayerName: () => {},
    submitInput: (s, p) => calls.push(["input", s, p]),
  };
  const a = createAdapter("royal-sumo", {
    RoyalSumo: { multiplayer: api, setPaused: () => {}, getState: () => ({}) },
  });
  a.claim(1, "Phone");
  a.input(1, { moveX: 0, moveY: 0, primaryAction: true }, 1);
  a.neutralize(1, 1);
  assert.equal(calls.at(-1)[2].bashPressed, false);
  a.release(1);
  const n = calls.length;
  a.pause(true);
  a.pause(false);
  assert.equal(calls.length, n);
});
test("Ballistix timeout uses safe cancel instead of ordinary release input", () => {
  const calls = [];
  const a = createAdapter("royal-ballistix", {
    RoyalBallistix: {
      setPlayerInput: () => {},
      cancelPlayerInput: (s) => calls.push(["cancel", s]),
      releasePlayer: (s) => calls.push(["release", s]),
      setPaused: () => {},
    },
  });
  a.claim(1, "Phone");
  a.input(1, { primaryAction: true }, 1);
  a.neutralize(1, 1);
  a.pause(true);
  a.release(1);
  assert.deepEqual(calls, [
    ["cancel", 1],
    ["cancel", 1],
    ["release", 1],
  ]);
});
