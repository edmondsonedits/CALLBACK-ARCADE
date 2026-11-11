import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SchaetzoramaHost, canManuallyRevealSchaetzorama, shouldAutoRevealSchaetzorama } from "../app/components/SchaetzoramaHost";
import { SchaetzoramaController, createSchaetzoramaEstimatePayload, isSchaetzoramaPhoneSnapshot, schaetzoramaEstimateInputKey } from "../app/components/SchaetzoramaController";
import type { SnapshotSchaetzorama } from "../lib/contracts";

const baseMatch = {
  matchId: "match-1",
  round: 1,
  roundCount: 5,
  phase: "estimating" as const,
  question: "How many keys are on a standard piano?",
  unit: "keys",
  min: 1,
  max: 200,
  deadline: 50_000,
  version: 3,
  submitted: false,
  estimates: [],
  winners: [],
  scores: { p1: 0, p2: 0 },
};

function hostSnapshot(match: SnapshotSchaetzorama, phase = "ARCADE_ACTIVE", winners = ["p1"]) {
  return {
    role: "host",
    code: "TEST",
    phase,
    serverTime: 10_000,
    players: [
      { id: "p1", nickname: "Alex", role: "player", active: true, score: match.scores.p1 },
      { id: "p2", nickname: "Sam", role: "player", active: true, score: match.scores.p2 },
    ],
    schaetzorama: match,
    arcade: { gameId: "schaetzorama", matchId: match.matchId, startedAt: 0, endedAt: 1, result: { winners } },
  } as never;
}

test("host hides answer and private estimates before the server reveals a Schaetzorama round", () => {
  const markup = renderToStaticMarkup(
    createElement(SchaetzoramaHost, { snapshot: hostSnapshot({ ...baseMatch, answer: 88, estimates: [{ playerId: "p1", estimate: 88 }] }), remaining: 20_000, act: async () => {} }),
  );
  assert.match(markup, /How many keys are on a standard piano\?/);
  assert.doesNotMatch(markup, />88</);
  assert.doesNotMatch(markup, /Alex.*88|Sam.*88/);
});

test("phone locks its own accepted estimate without exposing the answer or other players' guesses", () => {
  const markup = renderToStaticMarkup(
    createElement(SchaetzoramaController, {
      snapshot: {
        role: "player",
        selfId: "p1",
        phase: "ARCADE_ACTIVE",
        players: [
          { id: "p1", nickname: "Alex", role: "player" },
          { id: "p2", nickname: "Sam", role: "player" },
        ],
        schaetzorama: { ...baseMatch, submitted: true, estimate: 91, answer: 88, estimates: [{ playerId: "p1", estimate: 91 }, { playerId: "p2", estimate: 88 }] },
      } as never,
      remaining: 20_000,
      act: async () => {},
    }),
  );
  assert.match(markup, /Your estimate is locked: <strong>91 keys<\/strong>/);
  assert.doesNotMatch(markup, />88</);
  assert.doesNotMatch(markup, /p2|Sam/);
});

test("host results use server scores and provide an explicit replay control", () => {
  const markup = renderToStaticMarkup(
    createElement(SchaetzoramaHost, { snapshot: hostSnapshot({ ...baseMatch, phase: "completed", answer: 88, estimates: [{ playerId: "p1", estimate: 88 }, { playerId: "p2", estimate: 82 }], winners: ["p1"], scores: { p1: 4, p2: 1 } }, "ARCADE_RESULTS", ["p2"]), remaining: null, act: async () => {} }),
  );
  assert.match(markup, /Final results/);
  assert.match(markup, /Sam takes the Crown/);
  assert.doesNotMatch(markup, /Alex WINNER/);
  assert.match(markup, />4</);
  assert.match(markup, /Play again/);
  assert.doesNotMatch(markup, /<main/);
});

test("phone final champion follows the server result winners instead of recomputing from scores", () => {
  const markup = renderToStaticMarkup(createElement(SchaetzoramaController, {
    snapshot: {
      role: "player", selfId: "p1", phase: "ARCADE_RESULTS",
      players: [
        { id: "p1", nickname: "Alex", role: "player" },
        { id: "p2", nickname: "Sam", role: "player" },
      ],
      arcade: { gameId: "schaetzorama", matchId: "match-1", startedAt: 0, endedAt: 1, result: { winners: ["p2"] } },
      schaetzorama: { ...baseMatch, phase: "completed", scores: { p1: 9, p2: 1 } },
    } as never,
    remaining: null,
    act: async () => {},
  }));
  assert.match(markup, /Sam/);
  assert.doesNotMatch(markup, /Alex takes the Crown/);
});

test("phone estimate payload binds to the exact server match and round", () => {
  assert.deepEqual(createSchaetzoramaEstimatePayload(baseMatch, 73), {
    matchId: "match-1",
    estimate: 73,
    round: 1,
  });
});

test("estimate input identity changes when the match or round changes", () => {
  assert.equal(schaetzoramaEstimateInputKey(baseMatch), "match-1:1");
  assert.notEqual(schaetzoramaEstimateInputKey(baseMatch), schaetzoramaEstimateInputKey({ ...baseMatch, round: 2 }));
  assert.notEqual(schaetzoramaEstimateInputKey(baseMatch), schaetzoramaEstimateInputKey({ ...baseMatch, matchId: "match-2" }));
});

test("audience snapshots with an active Schaetzorama match render the spectator phone route without pack metadata", () => {
  const audienceSnapshot = {
    role: "audience",
    selfId: "audience-1",
    phase: "ARCADE_ACTIVE",
    players: [{ id: "p1", nickname: "Alex", role: "player" }],
    schaetzorama: baseMatch,
  } as never;
  assert.equal(isSchaetzoramaPhoneSnapshot(audienceSnapshot), true);
  const markup = renderToStaticMarkup(createElement(SchaetzoramaController, {
    snapshot: audienceSnapshot,
    remaining: 15_000,
    act: async () => {},
  }));
  assert.match(markup, /Spectator/);
  assert.match(markup, /How many keys are on a standard piano\?/);
  assert.doesNotMatch(markup, /name="gameLength"|schaetzorama-estimate/);
  assert.equal(isSchaetzoramaPhoneSnapshot({ phase: "LOBBY", schaetzorama: baseMatch }), false);
  assert.equal(isSchaetzoramaPhoneSnapshot({ phase: "ARCADE_ACTIVE", schaetzorama: null }), false);
});

test("only the live host dispatches one deadline reveal for an estimating round", () => {
  const due = { paused: false, roomPhase: "ARCADE_ACTIVE", matchPhase: "estimating", remaining: 0 };
  assert.equal(shouldAutoRevealSchaetzorama({ ...due, readOnly: false }), true);
  assert.equal(shouldAutoRevealSchaetzorama({ ...due, readOnly: true }), false);
  assert.equal(shouldAutoRevealSchaetzorama({ ...due, paused: true, readOnly: false }), false);
  assert.equal(shouldAutoRevealSchaetzorama({ ...due, matchPhase: "revealing", readOnly: false }), false);
  assert.equal(canManuallyRevealSchaetzorama({ ...due, remaining: 1000, readOnly: false }), false);
  assert.equal(canManuallyRevealSchaetzorama({ ...due, remaining: 0, readOnly: false }), true);
  assert.equal(canManuallyRevealSchaetzorama({ ...due, remaining: 0, readOnly: true }), false);
});
