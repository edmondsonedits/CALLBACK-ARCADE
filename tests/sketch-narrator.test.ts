import assert from "node:assert/strict";
import { selectSketchNarratorVoice } from "../lib/game/sketch-relay-audio";

import test from "node:test";
import { NARRATOR_LINES, NARRATOR_MOODS, NARRATOR_SCENARIOS } from "../lib/content/sketch-narrator-lines";
import { automaticNarratorMood, createNarratorDeck, createNarratorDirector, formatNarratorLine, makeNarratorCue } from "../lib/game/sketch-narrator";
import { showdownCues } from "../lib/game/sketch-showdown-script";
import { createSketchRelayMatch, sketchRelaySnapshot } from "../server/arcade/sketch_relay";

test("the Sketch narrator prefers a known female English voice and falls back safely", () => {
  const voice = (name: string, lang = "en-US", isDefault = false): SpeechSynthesisVoice =>
    ({ name, lang, default: isDefault, localService: true, voiceURI: name });
  const alex = voice("Alex", "en-US", true);
  const samantha = voice("Samantha");
  const jenny = voice("Microsoft Jenny Online (Natural)");
  const amelia = voice("Amelia Female", "fr-FR");
  assert.equal(selectSketchNarratorVoice([alex, samantha, amelia, jenny]), jenny);
  assert.equal(selectSketchNarratorVoice([alex, amelia, samantha]), samantha);
  assert.equal(selectSketchNarratorVoice([amelia, alex]), alex);
  assert.equal(selectSketchNarratorVoice([amelia]), undefined);
});

function snapshot() {
  return sketchRelaySnapshot(createSketchRelayMatch({ matchId: "narrator-test", players: ["a", "b", "c"], botIds: [], now: 1000, timerAccessibility: false, rulesVersion: 3 }), { role: "host" });
}

test("every narrator mood supplies ten distinct original options for all 25 scenarios", () => {
  assert.equal(NARRATOR_MOODS.length, 8); assert.equal(NARRATOR_SCENARIOS.length, 25);
  for (const mood of NARRATOR_MOODS) for (const scenario of NARRATOR_SCENARIOS) {
    const lines = NARRATOR_LINES[mood][scenario];
    assert.equal(lines.length, 10, `${mood}/${scenario}`);
    assert.equal(new Set(lines).size, 10, `${mood}/${scenario} duplicate`);
    for (const line of lines) {
      assert.ok(line.length > 10 && line.length < 200, `${mood}/${scenario}: ${line}`);
      assert.ok(!/\{(?!name\}|letter\})/.test(line), line);
      const named = ["last-prompt", "last-drawing", "artist-reveal", "round-winner"].includes(scenario);
      assert.equal(line.includes("{name}"), named, `${mood}/${scenario}: ${line}`);
      if (scenario === "ten") assert.ok(line.split(/\s+/).length <= 10, line);
    }
  }
});

test("a scenario shuffles all ten options before reuse and event delivery is idempotent", () => {
  const deck = createNarratorDeck("match-a", "sassy");
  const lines = Array.from({ length: 10 }, (_, i) => deck.pick("showcase", `card-${i}`, { letter: "A" }));
  assert.equal(new Set(lines).size, 10);
  assert.equal(deck.pick("showcase", "card-0", { letter: "A" }), lines[0]);
  assert.notEqual(deck.pick("showcase", "card-10", { letter: "A" }), lines[9]);
  const restored = createNarratorDeck("match-a", "sassy", deck.history());
  assert.equal(restored.pick("showcase", "card-0", { letter: "A" }), lines[0]);
  assert.equal(restored.pick("showcase", "next", {}), deck.pick("showcase", "next", {}));
  assert.equal(automaticNarratorMood("match-a"), automaticNarratorMood("match-a"));
  assert.ok(new Set(Array.from({ length: 40 }, (_, i) => automaticNarratorMood(`game-${i}`))).size >= 6);
});

test("substitutions are literal bounded text with no recursive placeholder or replacement expansion", () => {
  assert.equal(formatNarratorLine("{name}, meet drawing {letter}.", { name: "$& {letter}", letter: "A" }), "$& {letter}, meet drawing A.");
  assert.equal(formatNarratorLine("Hello {name}.", { name: "\n Danny\u0000\n" }), "Hello Danny.");
  assert.equal(formatNarratorLine("Hello {name}.", {}), "Hello our mystery artist.");
  assert.ok(formatNarratorLine("{name}", { name: "x".repeat(300) }).length <= 40);
});

test("anonymous commentary never names a player or private final assignment even with malformed author fields", () => {
  const s = snapshot(); s.phase = "showcase";
  s.showdown!.entries = [{ entryId: "secret", letter: "A", playerId: "a", prompt: "PRIVATE", image: { status: "MISSING" } }];
  s.showdown!.phaseDuration = 10_000;
  for (const c of showdownCues(s, 10_000, [{ id: "a", nickname: "Hidden Alice" }])) {
    assert.ok(!c.text.includes("Hidden Alice") && !c.text.includes("PRIVATE"));
  }
});

test("fresh time warnings override banter, stale warnings are absent, and names need a true final submitter", () => {
  const s = snapshot(); s.phase = "drawing"; s.showdown!.phaseDuration = 240_000;
  s.showdown!.pendingPlayers = ["a"];
  const names = [{ id: "a", nickname: "Alice" }];
  assert.ok(showdownCues(s, 200_000, names).some(c => c.text.includes("Alice")));
  const late = showdownCues(s, 5_000, names);
  assert.ok(late.some(c => c.key.endsWith(":ten")));
  assert.equal(late.some(c => /:minute$|:thirty$|:half$|:last:/.test(c.key)), false);
  s.showdown!.pendingPlayers = ["a", "b"];
  assert.equal(showdownCues(s, 200_000, names).some(c => c.text.includes("Alice")), false);
});

test("every version-3 phase keeps accurate rules and extended drawing times in themed cues", () => {
  const s = snapshot();
  for (const p of ["prompt-writing", "prompt-voting", "curse-selection", "final-preparation", "drawing", "transforming", "showcase", "laughter-voting", "artist-guessing", "revealing", "round-results", "halfway", "complete"] as const) {
    s.phase = p;
    assert.ok(showdownCues(s, s.showdown!.phaseDuration, []).length > 0, p);
  }
  s.phase = "drawing"; s.round = 3; s.showdown!.phaseDuration = 360_000;
  assert.match(showdownCues(s, 360_000, [])[0]!.text, /six minutes/i);
  assert.match(showdownCues(s, 360_000, [])[0]!.text, /own final|private/i);
  s.phase = "laughter-voting"; s.showdown!.multiplier = 3;
  assert.match(showdownCues(s, 40_000, [])[0]!.text, /300/);
});

test("the director spaces optional banter, prioritizes warnings and never queues superseded cues", () => {
  const director = createNarratorDirector("timing");
  const intro = makeNarratorCue("intro", "drawing", "Draw on your phone.", {}, "timing", 80);
  const chatter = makeNarratorCue("idle", "drawing-idle", "", {}, "timing", 10);
  const warning = makeNarratorCue("ten", "ten", "Ten seconds. Lock it in.", {}, "timing", 110);
  assert.equal(director.next([intro], 0, 240_000)?.key.endsWith("intro"), true);
  assert.equal(director.next([intro, chatter], 1000, 239_000), null);
  assert.equal(director.next([intro, chatter, warning], 2000, 10_000)?.key.endsWith("ten"), true);
  assert.equal(director.next([intro, chatter, warning], 50_000, 9000), null);
  const restored = createNarratorDirector("timing", director.save());
  assert.equal(restored.next([intro, chatter, warning], 60_000, 8000), null);
  restored.setSelection("analytical");
  const changed = restored.next([intro], 60_000, 100_000)!;
  assert.match(changed.key, /^analytical:/);
  assert.equal(restored.mood(), "analytical");
  assert.equal(createNarratorDirector("timing", restored.save()).mood(), "analytical");
  assert.equal(createNarratorDirector("new-match", restored.save()).selection(), "auto");
});

test("an introduction leaves an already-pending final player callout eligible after a quiet gap", () => {
  const director = createNarratorDirector("pending-on-load");
  const intro = makeNarratorCue("intro", "drawing", "Draw on your phone.", {}, "pending-on-load", 80);
  const last = makeNarratorCue("last", "last-drawing", "One sketch left to lock.", { name: "Danny" }, "pending-on-load", 30);
  assert.ok(director.next([intro, last], 0, 200_000)?.key.endsWith("intro"));
  assert.equal(director.next([intro, last], 1000, 199_000), null);
  assert.match(director.next([intro, last], 20_000, 180_000)!.text, /Danny/);
});

test("short transitions retain required facts instead of cutting instructions for a quip", () => {
  const director = createNarratorDirector("short");
  const cue = makeNarratorCue("short-intro", "halfway", "Next: the final round, with triple points.", {}, "short");
  assert.equal(director.present(cue, 1500).text, cue.facts);
  const late = snapshot(); late.phase = "drawing"; late.showdown!.phaseDuration = 360_000;
  assert.match(showdownCues(late, 90_000, [])[0]!.facts, /90 seconds/);
  assert.doesNotMatch(showdownCues(late, 90_000, [])[0]!.facts, /You have six minutes/);
});

test("repeated host replays keep bounded history without resetting mixed scenario bags", () => {
  const deck = createNarratorDeck("replays", "funny");
  for (let i = 0; i < 725; i++) deck.pick(i % 3 === 0 ? "showcase" : "artist-reveal", `replay-${i}`, { name: "Danny" });
  assert.ok(deck.history().picks.length <= 400);
  const restored = createNarratorDeck("replays", "funny", deck.history());
  for (let i = 0; i < 10; i++) assert.equal(restored.pick("artist-reveal", `next-${i}`, { name: "Danny" }), deck.pick("artist-reveal", `next-${i}`, { name: "Danny" }));
  assert.equal(new Set(Array.from({ length: 10 }, (_, i) => restored.pick("showcase", `more-${i}`, {}))).size, 10);
});
