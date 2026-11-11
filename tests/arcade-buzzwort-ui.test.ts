import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuzzwortHost } from "../app/components/BuzzwortHost";
import { BuzzwortController, createBuzzwortCluePayload, createBuzzwortGuessPayload, isBuzzwortPhoneSnapshot } from "../app/components/BuzzwortController";
import type { SnapshotBuzzwort } from "../lib/contracts";

const players = [
  { id: "p1", nickname: "Alex", role: "player" as const },
  { id: "p2", nickname: "Sam", role: "player" as const },
  { id: "p3", nickname: "Jo", role: "player" as const },
];
const baseMatch: SnapshotBuzzwort = {
  matchId: "match-buzz-1", round: 1, phase: "clue", attempt: 1, players: ["p1", "p2", "p3"],
  activeTeam: "ember", watcherTeam: "cobalt", clueGiverId: "p1", guesserId: "p2", deadline: 75_000,
  version: 0, clueCount: 0, submitted: false, clues: [],
};
const card = { word: "Orbit", tabooWords: ["planet", "space", "circle", "satellite"] };

test("host clue stage shows the current clue and player roles without leaking the secret card", () => {
  const markup = renderToStaticMarkup(createElement(BuzzwortHost, {
    snapshot: { role: "host", code: "BUZZ", phase: "ARCADE_ACTIVE", players, buzzwort: { ...baseMatch, currentClue: "A path around something" } } as never,
    remaining: 40_000,
    act: async () => {},
  }));
  assert.match(markup, /A path around something/);
  assert.match(markup, /Alex/);
  assert.match(markup, /Sam/);
  assert.match(markup, /Ember/);
  assert.match(markup, /Cobalt/);
  assert.doesNotMatch(markup, /Orbit|satellite|space/);
  assert.doesNotMatch(markup, /<button/);
});

test("only the clue giver sees the word and taboo list before the reveal", () => {
  const giver = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "player", selfId: "p1", phase: "ARCADE_ACTIVE", players, buzzwort: { ...baseMatch, assignment: { role: "clue_giver", team: "ember", card } } } as never,
    remaining: 50_000, act: async () => {},
  }));
  const teammate = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "player", selfId: "p3", phase: "ARCADE_ACTIVE", players, buzzwort: { ...baseMatch, assignment: { role: "teammate", team: "ember" } } } as never,
    remaining: 50_000, act: async () => {},
  }));
  assert.match(giver, /Orbit/);
  assert.match(giver, /satellite/);
  assert.match(giver, /Send clue/);
  assert.match(teammate, /Ember team · teammate/);
  assert.doesNotMatch(teammate, /Orbit|satellite/);
  assert.doesNotMatch(teammate, /Send clue|buzzwort-clue/);
});

test("only the designated guesser receives the active clue and guess control", () => {
  const guesser = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "player", selfId: "p2", phase: "ARCADE_ACTIVE", players, buzzwort: { ...baseMatch, phase: "guess", currentClue: "A path around something", assignment: { role: "guesser", team: "ember" } } } as never,
    remaining: 25_000, act: async () => {},
  }));
  const watcher = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "player", selfId: "p3", phase: "ARCADE_ACTIVE", players, buzzwort: { ...baseMatch, phase: "guess", currentClue: "A path around something", assignment: { role: "watcher", team: "cobalt" } } } as never,
    remaining: 25_000, act: async () => {},
  }));
  assert.match(guesser, /A path around something/);
  assert.match(guesser, /Lock my guess/);
  assert.match(watcher, /Cobalt team · watcher/);
  assert.match(watcher, /A path around something/);
  assert.doesNotMatch(watcher, /Lock my guess|buzzwort-guess/);
});

test("spectator sees public clue but receives no role, card, or action controls", () => {
  const markup = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "audience", selfId: "aud-1", phase: "ARCADE_ACTIVE", players, buzzwort: { ...baseMatch, phase: "guess", currentClue: "A path around something" } } as never,
    remaining: 20_000, act: async () => {},
  }));
  assert.match(markup, /Spectator/);
  assert.match(markup, /A path around something/);
  assert.doesNotMatch(markup, /Orbit|satellite|clue_giver|watcher|<button/);
});

test("clue and guess payloads bind to the exact match, round, and attempt", () => {
  assert.deepEqual(createBuzzwortCluePayload(baseMatch, "  A path around something  "), {
    matchId: "match-buzz-1", round: 1, attempt: 1, text: "A path around something",
  });
  assert.deepEqual(createBuzzwortGuessPayload({ ...baseMatch, phase: "guess", attempt: 3 }, "  Orbit!  "), {
    matchId: "match-buzz-1", round: 1, attempt: 3, guess: "Orbit!",
  });
});

test("a room player outside the controller rotation gets the spectator screen", () => {
  const markup = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "player", selfId: "p13", phase: "ARCADE_ACTIVE", players, buzzwort: baseMatch } as never,
    remaining: 20_000, act: async () => {},
  }));
  assert.match(markup, /Spectator/);
  assert.doesNotMatch(markup, /Give your team a clue|Your guess/);
});

test("phone completion follows the server result and displays the card and team score", () => {
  const markup = renderToStaticMarkup(createElement(BuzzwortController, {
    snapshot: { role: "player", selfId: "p2", phase: "ARCADE_RESULTS", players, buzzwort: { ...baseMatch, phase: "revealed", result: {
      matchId: baseMatch.matchId, round: 1, outcome: "guessed", winnerTeam: "ember", activeTeam: "ember", watcherTeam: "cobalt",
      card: { id: "card-1", ...card }, scores: { ember: 1, cobalt: 0 }, teams: { p1: "ember", p2: "ember", p3: "cobalt" },
      roles: { p1: "clue_giver", p2: "guesser", p3: "watcher" }, clues: [{ playerId: "p1", attempt: 1, text: "A path around something" }],
      guesses: [{ playerId: "p2", attempt: 1, text: "Orbit", correct: true }],
    } } } as never,
    remaining: null, act: async () => {},
  }));
  assert.match(markup, /Ember wins/);
  assert.match(markup, /Orbit/);
  assert.match(markup, /A path around something/);
  assert.match(markup, /1/);
});

test("audience snapshots with a live Buzzwort match route independently of game metadata", () => {
  assert.equal(isBuzzwortPhoneSnapshot({ phase: "ARCADE_ACTIVE", buzzwort: baseMatch }), true);
  assert.equal(isBuzzwortPhoneSnapshot({ phase: "LOBBY", buzzwort: baseMatch }), false);
  assert.equal(isBuzzwortPhoneSnapshot({ phase: "ARCADE_ACTIVE", buzzwort: null }), false);
});
