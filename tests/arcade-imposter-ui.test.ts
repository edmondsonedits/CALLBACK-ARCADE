import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImposterHost } from "../app/components/ImposterHost";
import { ImposterController, createImposterCluePayload, createImposterVotePayload, isImposterPhoneSnapshot } from "../app/components/ImposterController";
import type { SnapshotImposter } from "../lib/contracts";

const baseMatch: SnapshotImposter = {
  matchId: "match-imp-1", round: 1, phase: "cluing", players: ["p1", "p2", "p3"], deadline: 60_000, version: 0,
  clueCount: 0, voteCount: 0, submitted: false, clues: [],
};
const players = [
  { id: "p1", nickname: "Alex", role: "player" as const },
  { id: "p2", nickname: "Sam", role: "player" as const },
  { id: "p3", nickname: "Jo", role: "player" as const },
];

test("host clue screen displays only server counts and no private word or roles", () => {
  const markup = renderToStaticMarkup(createElement(ImposterHost, {
    snapshot: { role: "host", code: "IMPO", phase: "ARCADE_ACTIVE", players, imposter: { ...baseMatch, assignment: { role: "civilian", category: "Kitchen", word: "Cinnamon" } } } as never,
    remaining: 30_000,
    act: async () => {},
  }));
  assert.match(markup, /One of you is the imposter/);
  assert.match(markup, /<strong>0<\/strong><span> \/ 3 clues locked<\/span>/);
  assert.doesNotMatch(markup, /Cinnamon|Kitchen|CIVILIAN/);
});

test("phone assignment distinguishes civilian and imposter without revealing the word to the imposter", () => {
  const civilian = renderToStaticMarkup(createElement(ImposterController, {
    snapshot: { role: "player", selfId: "p1", phase: "ARCADE_ACTIVE", players, imposter: { ...baseMatch, assignment: { role: "civilian", category: "Kitchen", word: "Cinnamon" } } } as never,
    remaining: 30_000, act: async () => {},
  }));
  const imposter = renderToStaticMarkup(createElement(ImposterController, {
    snapshot: { role: "player", selfId: "p2", phase: "ARCADE_ACTIVE", players, imposter: { ...baseMatch, assignment: { role: "imposter", category: "Kitchen" } } } as never,
    remaining: 30_000, act: async () => {},
  }));
  assert.match(civilian, /Cinnamon/);
  assert.match(civilian, /Category: Kitchen/);
  assert.match(imposter, /You don’t know the word/);
  assert.match(imposter, /Category: Kitchen/);
  assert.doesNotMatch(imposter, /Cinnamon/);
});

test("spectator sees public voting clues but gets no private role or voting control", () => {
  const markup = renderToStaticMarkup(createElement(ImposterController, {
    snapshot: { role: "audience", selfId: "aud-1", phase: "ARCADE_ACTIVE", players, imposter: { ...baseMatch, phase: "voting", clues: [{ playerId: "p1", clue: "spice" }], assignment: undefined } } as never,
    remaining: 20_000, act: async () => {},
  }));
  assert.match(markup, /Spectator/);
  assert.match(markup, /“spice”/);
  assert.doesNotMatch(markup, /Cinnamon|name="imposter-vote"|Lock my vote/);
});

test("voting screen lists other players and locks the UI to the server's clue set", () => {
  const markup = renderToStaticMarkup(createElement(ImposterController, {
    snapshot: { role: "player", selfId: "p1", phase: "ARCADE_ACTIVE", players, imposter: { ...baseMatch, phase: "voting", assignment: { role: "civilian", category: "Kitchen", word: "Cinnamon" }, clues: [{ playerId: "p2", clue: "spice" }, { playerId: "p3", clue: "red" }] } } as never,
    remaining: 20_000, act: async () => {},
  }));
  assert.match(markup, /Who is the imposter\?/);
  assert.match(markup, /id="imposter-vote"/);
  assert.match(markup, /Sam/);
  assert.doesNotMatch(markup, /Cinnamon|Alex<\/option>/);
});

test("action payloads bind every clue and vote to the exact match and round", () => {
  assert.deepEqual(createImposterCluePayload(baseMatch, "  hint  "), { matchId: "match-imp-1", round: 1, clue: "hint" });
  assert.deepEqual(createImposterVotePayload(baseMatch, "p3"), { matchId: "match-imp-1", round: 1, targetPlayerId: "p3" });
});

test("role-safe audience snapshots route to the side game without game metadata", () => {
  const snapshot = { role: "audience", phase: "ARCADE_ACTIVE", imposter: baseMatch } as never;
  assert.equal(isImposterPhoneSnapshot(snapshot), true);
  assert.equal(isImposterPhoneSnapshot({ phase: "LOBBY", imposter: baseMatch }), false);
  assert.equal(isImposterPhoneSnapshot({ phase: "ARCADE_ACTIVE", imposter: null }), false);
});

test("completed phone reveal shows final roles, word, and server winner", () => {
  const markup = renderToStaticMarkup(createElement(ImposterController, {
    snapshot: { role: "player", selfId: "p1", phase: "ARCADE_RESULTS", players, imposter: { ...baseMatch, phase: "revealed", result: {
      matchId: baseMatch.matchId, round: 1, category: "Kitchen", word: "Cinnamon", imposterId: "p3", winner: "civilians", accusedPlayerIds: ["p3"], voteCounts: { p1: 0, p2: 0, p3: 2 },
      clues: [{ playerId: "p1", clue: "spice" }], roles: [{ playerId: "p1", role: "civilian" }, { playerId: "p2", role: "civilian" }, { playerId: "p3", role: "imposter" }],
    } } } as never,
    remaining: null, act: async () => {},
  }));
  assert.match(markup, /Imposter found!/);
  assert.match(markup, /Cinnamon/);
  assert.match(markup, /Jo/);
  assert.match(markup, /IMPOSTER/);
});
