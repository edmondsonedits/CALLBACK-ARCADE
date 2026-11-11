import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PantomimeController, createPantomimeGuessPayload } from "../app/components/PantomimeController";
import { PantomimeHost } from "../app/components/PantomimeHost";
import type { SnapshotPantomime } from "../lib/contracts";

const match: SnapshotPantomime = {
  matchId: "mime-123", round: 1, phase: "acting", players: ["p1", "p2", "p3"], performerId: "p1", deadline: 90_000,
  version: 1, attempt: 2, guessCount: 1, submitted: false,
};
const players = [
  { id: "p1", nickname: "Avery", role: "player" as const },
  { id: "p2", nickname: "Blake", role: "player" as const },
  { id: "p3", nickname: "Casey", role: "player" as const },
];

test("host acting screen keeps the prompt and submitted guess text private and can reveal", () => {
  const markup = renderToStaticMarkup(createElement(PantomimeHost, {
    snapshot: { role: "host", code: "MIME", phase: "ARCADE_ACTIVE", players, pantomime: { ...match, assignment: { role: "performer", prompt: "Riding a unicycle" }, ownGuesses: ["building a snowman"] } } as never,
    remaining: 42_000, act: async () => {},
  }));
  assert.match(markup, /Can the room guess/);
  assert.match(markup, /Reveal round/);
  assert.match(markup, /<strong>1<\/strong> guesses/);
  assert.doesNotMatch(markup, /Riding a unicycle|building a snowman/);
});

test("performer phone sees its own secret prompt while another player's guess screen does not", () => {
  const performer = renderToStaticMarkup(createElement(PantomimeController, {
    snapshot: { role: "player", selfId: "p1", phase: "ARCADE_ACTIVE", players, pantomime: { ...match, assignment: { role: "performer", prompt: "Riding a unicycle" } } } as never,
    remaining: 42_000, act: async () => {},
  }));
  const guesser = renderToStaticMarkup(createElement(PantomimeController, {
    snapshot: { role: "player", selfId: "p2", phase: "ARCADE_ACTIVE", players, pantomime: { ...match, assignment: { role: "guesser" } } } as never,
    remaining: 42_000, act: async () => {},
  }));
  assert.match(performer, /Riding a unicycle/);
  assert.match(performer, /Act it out/);
  assert.match(guesser, /What are they acting out/);
  assert.match(guesser, /Your guess/);
  assert.doesNotMatch(guesser, /Riding a unicycle/);
});

test("spectator receives no prompt or guess controls before reveal", () => {
  const markup = renderToStaticMarkup(createElement(PantomimeController, {
    snapshot: { role: "audience", selfId: "a1", phase: "ARCADE_ACTIVE", players, pantomime: { ...match, assignment: undefined } } as never,
    remaining: 20_000, act: async () => {},
  }));
  assert.match(markup, /Spectator/);
  assert.match(markup, /Watch the performance/);
  assert.doesNotMatch(markup, /pantomime-guess|Riding a unicycle|building a snowman/);
});

test("a room player outside the controller rotation gets the spectator screen", () => {
  const markup = renderToStaticMarkup(createElement(PantomimeController, {
    snapshot: { role: "player", selfId: "p17", phase: "ARCADE_ACTIVE", players, pantomime: { ...match, assignment: undefined } } as never,
    remaining: 20_000, act: async () => {},
  }));
  assert.match(markup, /Spectator/);
  assert.doesNotMatch(markup, /Your guess|secret prompt/);
});

test("guess payload is bound to the live match, round and attempt", () => {
  assert.deepEqual(createPantomimeGuessPayload(match, "  Riding a unicycle  "), {
    matchId: "mime-123", round: 1, attempt: 2, guess: "Riding a unicycle",
  });
});

test("reveal screens show the prompt, guess text, correct guess and winner from the result", () => {
  const revealed: SnapshotPantomime = { ...match, phase: "revealed", result: {
    matchId: match.matchId, round: 1, outcome: "guessed", prompt: "Riding a unicycle", performerId: "p1", winnerId: "p2",
    scores: { p1: 0, p2: 2, p3: 0 },
    guesses: [{ playerId: "p2", text: "Riding a unicycle", correct: true }, { playerId: "p3", text: "Flying a kite", correct: false }],
  } };
  const hostMarkup = renderToStaticMarkup(createElement(PantomimeHost, {
    snapshot: { role: "host", code: "MIME", phase: "ARCADE_RESULTS", players, pantomime: revealed } as never,
    remaining: null, act: async () => {},
  }));
  const phoneMarkup = renderToStaticMarkup(createElement(PantomimeController, {
    snapshot: { role: "player", selfId: "p3", phase: "ARCADE_RESULTS", players, pantomime: revealed } as never,
    remaining: null, act: async () => {},
  }));
  for (const markup of [hostMarkup, phoneMarkup]) {
    assert.match(markup, /Riding a unicycle/);
    assert.match(markup, /Flying a kite/);
    assert.match(markup, /Avery/);
    assert.match(markup, /Blake/);
  }
  assert.match(hostMarkup, /Play again/);
  assert.match(hostMarkup, /GOT IT/);
});
