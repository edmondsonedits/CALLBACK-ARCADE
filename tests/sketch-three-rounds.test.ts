import assert from "node:assert/strict";
import test from "node:test";
import { createSketchRelayMatch, advanceSketchRelay, isValidSketchRelayMatch, sketchRelaySnapshot, sketchRelayScoreEvents } from "../server/arcade/sketch_relay";
import { submitShowdownAction, replayShowdown } from "../server/arcade/sketch_showdown";

const players = ["a", "b", "c"];
const fresh = (bots = false) => createSketchRelayMatch({ matchId: "three", players, botIds: bots ? players : [], now: 1000, rulesVersion: 3 });
type Match = ReturnType<typeof fresh>;
const next = (m: Match) => advanceSketchRelay(m, m.deadline).state;
function until(m: Match, phase: string, round: number) { for (let i = 0; i < 80; i++) { if (m.phase === phase && m.round === round) return m; m = next(m); } throw new Error(`never reached ${round}:${phase}`); }
const act = (m: Match, playerId: string, type: string, payload: Record<string, unknown>, now = m.updatedAt + 1) => submitShowdownAction(m, playerId, { type, payload: { matchId: m.matchId, round: m.round, ...payload } }, now).state;

test("new rules complete three valid rounds with bounded choices and free bots", () => {
  for (const bots of [false, true]) {
    let m = fresh(bots); assert.equal(sketchRelaySnapshot(m, { role: "host" }).totalRounds, 3);
    for (let i = 0; m.phase !== "complete" && i < 80; i++) { m = next(m); assert.ok(isValidSketchRelayMatch(m), `${m.round}:${m.phase}`); }
    assert.equal(m.phase, "complete"); assert.equal(m.round, 3); assert.equal(m.chains.some(c => c.drawing?.image.jobId), false);
  }
});
test("last-place curse choice is bounded, rejects other players and non-offered curses, and locks once", () => {
  const m = until(fresh(), "curse-selection", 2), curse = m.showdown!.curse!;
  assert.equal(new Set(curse.options).size, 3); assert.ok(players.includes(curse.chooserId));
  assert.throws(() => act(m, players.find(p => p !== curse.chooserId)!, "CHOOSE_SKETCH_CURSE", { curse: curse.options[0] }), /UNAUTHORIZED/);
  assert.throws(() => act(m, curse.chooserId, "CHOOSE_SKETCH_CURSE", { curse: "made-up" }), /INVALID/);
  assert.throws(() => advanceSketchRelay(m, m.deadline - 1), /TOO_EARLY/);
  assert.throws(() => act(m, curse.chooserId, "CHOOSE_SKETCH_CURSE", { curse: curse.options[0] }, m.deadline), /CLOSED/);
  const chosen = act(m, curse.chooserId, "CHOOSE_SKETCH_CURSE", { curse: curse.options[1] });
  assert.throws(() => act(chosen, curse.chooserId, "CHOOSE_SKETCH_CURSE", { curse: curse.options[0] }), /ALREADY/);
  const draw = advanceSketchRelay(chosen, chosen.updatedAt + 1).state;
  assert.equal(draw.phase, "drawing");
  for (const p of players) assert.equal(sketchRelaySnapshot(draw, { role: "player", playerId: p }).self!.restriction, curse.options[1]);
  assert.equal(next(m).showdown!.curse!.selected, next(m).showdown!.curse!.selected);
});
test("final choices remain private through anonymous voting and are released only with their artist", () => {
  let m = until(fresh(), "final-preparation", 3);
  assert.throws(() => act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "unknown", starter: "sword" }), /INVALID/);
  m = act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "banquet", starter: "dragon" });
  assert.throws(() => act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "banquet", starter: "sword" }), /ALREADY/);
  m = next(m); assert.equal(m.phase, "drawing");
  const privatePrompt = sketchRelaySnapshot(m, { role: "player", playerId: "a" }).self!.prompt!;
  assert.match(privatePrompt, /royal banquet/); assert.equal(sketchRelaySnapshot(m, { role: "player", playerId: "a" }).self!.starter, "dragon");
  for (const c of m.chains.filter(c => c.round === 3)) { m.botIds.push(c.originalPlayerId); c.drawing = { playerId: c.originalPlayerId, practice: true, submittedAt: m.updatedAt, image: { status: "MISSING" } }; }
  m = until(m, "artist-guessing", 3);
  assert.equal(JSON.stringify(sketchRelaySnapshot(m, { role: "host" })).includes(privatePrompt), false);
  const anonymous = sketchRelaySnapshot(m, { role: "player", playerId: "b" });
  assert.equal(anonymous.showdown!.entries.some(e => e.prompt !== undefined || e.starter !== undefined), false);
  m = next(m);
  while (m.phase === "revealing") { const snap = sketchRelaySnapshot(m, { role: "host" }); const e = snap.showdown!.revealEntry!; assert.equal(e.prompt, m.chains.find(c => c.chainId === e.entryId)!.promptChoices[0]); if (e.playerId === "a") assert.equal(e.starter, "dragon"); m = next(m); }
});
test("all laughter and guess events multiply by round and replay preserves their keys and totals", () => {
  let m = fresh(true);
  for (const round of [1, 2, 3]) {
    m = until(m, "revealing", round);
    while (m.phase === "revealing") {
      const before = sketchRelayScoreEvents(m); const replay = replayShowdown(m, m.updatedAt + 1);
      assert.deepEqual(sketchRelayScoreEvents(replay), before);
      for (const e of before.filter(e => e.round === round)) assert.ok(e.kind === "SKETCH_ARTIST_GUESS" ? e.points === 50 * round : [100, 75, 50].map(p => p * round).includes(e.points));
      m = next(replay);
    }
  }
  const events = sketchRelayScoreEvents(m); assert.equal(new Set(events.map(e => e.eventKey)).size, events.length);
  for (const p of players) assert.equal(m.scores[p], events.filter(e => e.playerId === p).reduce((n, e) => n + e.points, 0));
});

test("curse chooser uses actual last-place score and persists a stable tie choice across reload", () => {
  const before = until(fresh(true), "halfway", 1);
  const one = next(before), reloaded = next(JSON.parse(JSON.stringify(before)) as Match);
  assert.deepEqual(one.showdown!.curse, reloaded.showdown!.curse);
  const lowest = Math.min(...Object.values(before.scores));
  assert.equal(before.scores[one.showdown!.curse!.chooserId], lowest);
  assert.equal(one.deadline - one.updatedAt, 15_000);
  assert.ok(one.showdown!.curse!.selected, "A bot chooser resolves without a paid request");
  assert.equal(advanceSketchRelay(one, one.updatedAt + 1).state.phase, "drawing");
});
test("final preparation is bounded, preserves submitted choices, defaults only missing choices and clears curse", () => {
  let m = until(fresh(), "final-preparation", 3);
  assert.equal(m.deadline - m.updatedAt, 30_000); assert.equal(m.showdown!.curse, undefined);
  assert.throws(() => advanceSketchRelay(m, m.deadline - 1), /TOO_EARLY/);
  assert.throws(() => act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "wand" }), /INVALID/);
  assert.throws(() => act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "shield", round: 2 }), /STALE/);
  assert.throws(() => act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "shield" }, m.deadline), /CLOSED/);
  m = act(m, "a", "PREPARE_SKETCH_FINAL", { modifier: "tiny", starter: "shield" });
  const drawn = next(m); assert.deepEqual(drawn.showdown!.finalChoices, next(JSON.parse(JSON.stringify(m)) as Match).showdown!.finalChoices);
  assert.deepEqual(drawn.showdown!.finalChoices!.find(c => c.playerId === "a"), { playerId: "a", modifier: "tiny", starter: "shield" });
  for (const p of players) assert.equal(sketchRelaySnapshot(drawn, { role: "player", playerId: p }).self!.restriction, undefined);
});
test("saved restriction and final assignment corruption is rejected", () => {
  const draw = until(fresh(), "drawing", 2); const badRestriction = structuredClone(draw);
  badRestriction.chains.find(c => c.round === 2)!.restriction = undefined;
  assert.equal(isValidSketchRelayMatch(badRestriction), false);
  const badPrompt = until(fresh(), "drawing", 3); badPrompt.chains.find(c => c.round === 3)!.promptIndex = 1;
  assert.equal(isValidSketchRelayMatch(badPrompt), false);
});
test("all six restrictions are authoritative assignments and bot artwork keeps its historical style", () => {
  const ids = ["circles", "giant-brush", "no-erase", "limited-palette", "no-fill", "lines"] as const;
  for (const restriction of ids) {
    const m = until(fresh(), "curse-selection", 2);
    m.showdown!.curse!.options = [restriction, ...ids.filter(id => id !== restriction).slice(0, 2)];
    const chosen = act(m, m.showdown!.curse!.chooserId, "CHOOSE_SKETCH_CURSE", { curse: restriction });
    const draw = advanceSketchRelay(chosen, chosen.updatedAt + 1).state;
    for (const p of players) assert.equal(sketchRelaySnapshot(draw, { role: "player", playerId: p }).self!.restriction, restriction);
  }
  const final = until(fresh(true), "complete", 3), archive = sketchRelaySnapshot(final, { role: "host" }).showdown!.revealedEntries;
  assert.ok(archive.filter(e => e.round === 2).every(e => e.practiceStyle?.restriction));
  assert.ok(archive.filter(e => e.round === 3).every(e => e.practiceStyle?.starter && !e.practiceStyle.restriction));
});
