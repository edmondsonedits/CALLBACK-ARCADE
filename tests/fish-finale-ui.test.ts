import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FISH_ART_DEFAULTS, type FishFinaleSnapshot } from "../lib/arcade/fish-finale";
import type { SnapshotSketchRelay } from "../lib/arcade/sketch-relay";

const hook = registerHooks({
  resolve(specifier, context, nextResolve) { return nextResolve(specifier === "next/link" ? "vinext/shims/link" : specifier, context); },
  load(url, context, nextLoad) { return url.endsWith(".css") ? { format: "module", source: "export default {}", shortCircuit: true } : nextLoad(url, context); },
});
const { FishBonusHost, FishBonusPhone, fishOutputGain, fishAudioBedEnabled } = await import("../app/components/fish/FishFinalePanel");
hook.deregister();
function game(): SnapshotSketchRelay {
  const finale: FishFinaleSnapshot = {
    version: 1, matchId: "main", finaleId: "bonus", revision: 1, phase: "voting", mode: "peaceful", drawingSeconds: 120,
    phaseStartedAt: 1000, deadline: 36000, serverNow: 1000, paused: false, elapsedMs: 0, participantCount: 3, submittedCount: 3,
    eligibleCount: 3, unavailableCount: 0, ballotCount: 0, expectedBallotCount: 3, rankLimit: 2,
    entries: ["a", "b", "c"].map((id, i) => ({ ...FISH_ART_DEFAULTS, id, label: String.fromCharCode(65 + i), assetId: `asset-${id}`, practice: false, appearanceSeed: i })),
    revealedEntryIds: ["a", "b", "c"], self: { participant: true, submitted: true, ownEntryId: "a", eligible: true, ballotLocked: false, ballotOptions: ["c", "b"] },
    canChooseShowcase: false, graceExtended: false,
  };
  return { matchId: "main", round: 3, totalRounds: 3, phase: "complete", deadline: 0, players: ["p1", "p2", "p3"], totalPlayers: 3, submittedCount: 3, scores: {}, revealIndex: 0, revealTotal: 3, applauseOptions: [], applauded: false, finale };
}
test("phone ballot renders the authority's per-voter order with stable fish labels", () => {
  const html = renderToStaticMarkup(createElement(FishBonusPhone, { game: game(), code: "FISH", selfId: "p1" }));
  assert.ok(html.indexOf('alt="Fish C"') < html.indexOf('alt="Fish B"'));
  assert.doesNotMatch(html, /alt="Fish A"/);
});
test("configure provides a distinct Back to the postgame choice before drawing starts", () => {
  const g = game(); g.finale!.phase = "configure";
  const props = { game: g, code: "FISH", host: true, children: "Main results" };
  const html = renderToStaticMarkup(createElement(FishBonusHost, props));
  assert.match(html, /Back to results choice/); assert.doesNotMatch(html, />Exit bonus</);
});

test("untimed final aquarium hides authoritative pause but keeps host controls and timed phases retain pause", () => {
  const g = game(); g.finale!.phase = "aquarium"; g.finale!.deadline = 0; g.finale!.entries = [];
  const props = { game: g, code: "FISH", host: true, children: "Main results" };
  const aquarium = renderToStaticMarkup(createElement(FishBonusHost, props));
  assert.doesNotMatch(aquarium, />Pause</);
  assert.match(aquarium, />Mute fish sounds</); assert.match(aquarium, />Gentle motion</);
  g.finale!.phase = "voting"; g.finale!.deadline = 36000;
  const timed = renderToStaticMarkup(createElement(FishBonusHost, props));
  assert.match(timed, />Pause</);
});

test("fish sound gain follows global master/effects settings plus local mute and host-only gates", () => {
  const settings = { muted: false, effects: true, masterVolume: 0.5, effectsVolume: 0.8 };
  assert.equal(fishOutputGain(settings, false, true, true), 0.4);
  assert.equal(fishOutputGain({ ...settings, masterVolume: 0 }, false, true, true), 0);
  assert.equal(fishOutputGain({ ...settings, effects: false }, false, true, true), 0);
  assert.equal(fishOutputGain({ ...settings, effectsVolume: 0 }, false, true, true), 0);
  assert.equal(fishOutputGain({ ...settings, muted: true }, false, true, true), 0);
  assert.equal(fishOutputGain(settings, true, true, true), 0);
  assert.equal(fishOutputGain(settings, false, false, true), 0);
  assert.equal(fishOutputGain(settings, false, true, false), 0);
});

test("silent fish output does not start the cinematic audio bed or duck room music", () => {
  assert.equal(fishAudioBedEnabled(0, true, true, false, false, "cinematic", "shark"), false);
  assert.equal(fishAudioBedEnabled(0.4, true, true, false, false, "cinematic", "shark"), true);
  assert.equal(fishAudioBedEnabled(0.4, true, true, false, true, "cinematic", "shark"), false);
});

test("local fish audio toggle is labelled distinctly from room music controls", () => {
  const props = { game: game(), code: "FISH", host: true, children: "Main results" };
  const html = renderToStaticMarkup(createElement(FishBonusHost, props));
  assert.match(html, />Mute fish sounds</);
});
