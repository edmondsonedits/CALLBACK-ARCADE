import assert from "node:assert/strict";
import test from "node:test";
import { createSketchRelayMatch, advanceSketchRelay, sketchRelaySnapshot, isValidSketchRelayMatch, sketchRelayScoreEvents } from "../server/arcade/sketch_relay";
import { submitShowdownAction, SHOWDOWN_TIMERS } from "../server/arcade/sketch_showdown";
import { createRoomState, applyHostAction, applyPlayerAction, advanceState } from "../server/engine";
import { serializeRoomState, deserializeRoomState } from "../server/serialization";
import { applySketchRelayUpload, applySketchRelayImageResult, canViewSketchRelayAsset, syncSketchRelayRoom } from "../server/arcade/sketch_relay";
import { PlayerActionSchema } from "../lib/contracts";
import { showdownCues } from "../lib/game/sketch-showdown-script";

const players = ["p1", "p2", "p3", "p4"];
function start() { return createSketchRelayMatch({ matchId: "show", players, now: 1000, rulesVersion: 2 }); }
function act(m: ReturnType<typeof start>, p: string, type: string, payload: Record<string, unknown>, now = m.updatedAt + 1) { return submitShowdownAction(m, p, { type, payload: { matchId: m.matchId, round: m.round, ...payload } }, now).state; }
function drawing() {
  let m = start();
  for (const p of players) m = act(m, p, "SUBMIT_SKETCH_PROMPT", { prompt: `A dragon delivering pizza to ${p}` });
  m = advanceSketchRelay(m, m.updatedAt + 1).state;
  const options = m.showdown!.promptOptions;
  for (const p of players) m = act(m, p, "RANK_SKETCH_PROMPTS", { ranking: options.filter(o => o.authorId !== p).slice(0, 3).map(o => o.id) });
  return advanceSketchRelay(m, m.updatedAt + 1).state;
}
function showcase() {
  let m = drawing();
  for (const c of m.chains.filter(c => c.round === 1)) { const assetId = `source-${c.chainId}`; c.drawing = { playerId: c.originalPlayerId, assetId, source: { assetId, width: 480, height: 480, contentType: "image/png", byteSize: 1000, objectKey: `sources/${assetId}.png` }, submittedAt: m.updatedAt, image: { status: "READY", assetId: `art-${c.chainId}` } }; }
  m = advanceSketchRelay(m, m.updatedAt + 1).state;
  m = advanceSketchRelay(m, m.updatedAt + 1).state;
  return m;
}
function voting() { const m = showcase(); return advanceSketchRelay(m, m.deadline).state; }
test("saved version-two matches elect two shared prompts and give everyone four minutes", () => {
  const fresh = start(); assert.equal(fresh.phase, "prompt-writing"); assert.equal(fresh.chains.length, players.length * 2);
  const m = drawing(); assert.equal(m.phase, "drawing"); assert.equal(m.deadline - m.updatedAt, 240_000); assert.equal(SHOWDOWN_TIMERS.drawing, 240_000);
  assert.equal(new Set(m.chains.filter(c => c.round === 1).map(c => c.promptChoices[0])).size, 1); assert.equal(m.showdown!.selectedPrompts.length, 2); assert.ok(isValidSketchRelayMatch(m));
});

test("every anonymous drawing gets ten seconds and each artist reveal gets twenty", () => {
  let m = showcase();
  assert.equal(m.phase, "showcase");
  assert.equal(m.showdown!.phaseDuration, players.length * 10_000);
  assert.equal(m.deadline - m.showdown!.phaseStartedAt, 40_000);
  m = advanceSketchRelay(m, m.deadline).state;
  m = advanceSketchRelay(m, m.deadline).state;
  m = advanceSketchRelay(m, m.deadline).state;
  assert.equal(m.phase, "revealing");
  assert.equal(m.deadline - m.updatedAt, 20_000);
});
test("anonymous galleries never disclose authors, source metadata, future scores or ballot selections", () => {
  const m = voting(); const snap = sketchRelaySnapshot(m, { role: "host" });
  assert.equal(m.phase, "laughter-voting"); assert.equal(snap.totalRounds, 2); assert.equal(snap.chains, undefined); assert.equal(snap.reveal, undefined);
  for (const entry of snap.showdown!.entries) { assert.equal("playerId" in entry, false); assert.equal("originalPlayerId" in entry, false); assert.equal("source" in entry, false); assert.equal("jobId" in entry.image, false); }
  assert.deepEqual(snap.scores, Object.fromEntries(players.map(p => [p, 0])));
  assert.ok(m.showdown!.shuffleSeed); assert.equal(JSON.stringify(snap).includes(m.showdown!.shuffleSeed!), false);
});

test("public room identity and roster cannot reproduce the anonymous artist order", () => {
  const permutations = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const m = voting();
    permutations.add(m.showdown!.orders[0]!.map(id => m.chains.find(c => c.chainId === id)!.originalPlayerId).join(","));
  }
  assert.ok(permutations.size > 1, "A shuffle derived only from the public match ID exposes the artist permutation");
});
test("ranked laughter is 100/75/50 and only voted-for artist guesses earn 50, once", () => {
  let m = voting(); m.botIds = [];
  const cs = m.chains.filter(c => c.round === 1); const ranking = [cs[1]!.chainId, cs[2]!.chainId, cs[3]!.chainId];
  assert.throws(() => act(m, "p1", "RANK_SKETCH_LAUGHTER", { ranking: [cs[0]!.chainId] }), /SELF/);
  assert.throws(() => act(m, "p1", "RANK_SKETCH_LAUGHTER", { ranking: [ranking[0], ranking[0]] }), /INVALID/);
  m = act(m, "p1", "RANK_SKETCH_LAUGHTER", { ranking });
  assert.throws(() => act(m, "p1", "RANK_SKETCH_LAUGHTER", { ranking: [] }), /ALREADY/);
  for (const p of players.slice(1)) m = act(m, p, "RANK_SKETCH_LAUGHTER", { ranking: [] });
  m = advanceSketchRelay(m, m.updatedAt + 1).state;
  assert.throws(() => act(m, "p2", "GUESS_SKETCH_ARTISTS", { guesses: [{ entryId: ranking[0], playerId: "p3" }] }), /INVALID/);
  m = act(m, "p1", "GUESS_SKETCH_ARTISTS", { guesses: ranking.map(entryId => ({ entryId, playerId: cs.find(c => c.chainId === entryId)!.originalPlayerId })) });
  for (const p of players.slice(1)) m = act(m, p, "GUESS_SKETCH_ARTISTS", { guesses: [] });
  m = advanceSketchRelay(m, m.updatedAt + 1).state;
  while (m.phase === "revealing") m = advanceSketchRelay(m, m.deadline).state;
  assert.deepEqual(m.scores, { p1: 150, p2: 100, p3: 75, p4: 50 });
  const events = sketchRelayScoreEvents(m); assert.equal(new Set(events.map(e => e.eventKey)).size, events.length);
  assert.equal(events.filter(e => e.kind === "SKETCH_ARTIST_GUESS").length, 3);
});
test("only the current revealed artist can control their avatar and emotes expire", () => {
  let m = voting(); m = advanceSketchRelay(m, m.deadline).state; m = advanceSketchRelay(m, m.deadline).state;
  const entry = m.showdown!.revealOrder[0]!; const artist = m.chains.find(c => c.chainId === entry)!.originalPlayerId;
  assert.throws(() => act(m, players.find(p => p !== artist)!, "SKETCH_REVEAL_EMOTE", { entryId: entry, emote: "dance" }), /UNAUTHORIZED/);
  m = act(m, artist, "SKETCH_REVEAL_EMOTE", { entryId: entry, emote: "dance" });
  assert.equal(sketchRelaySnapshot(m, { role: "host" }).showdown!.emote?.name, "dance");
  assert.throws(() => act(m, artist, "SKETCH_REVEAL_EMOTE", { entryId: entry, emote: "dance" }), /TOO_FAST/);
});

test("the production room completes all three prompts, survives pause/reload, protects assets and replays without duplicate scores", async () => {
  let room = createRoomState("SHOW", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false }, 1000);
  for (const [i, id] of players.entries()) room.participants.push({ id, nickname: `Artist ${i}`, nicknameNormalized: `artist ${i}`, role: "player", seat: i + 1, avatar: i, color: "#46DBDC", active: true, pendingActivation: false, bot: false, lastSeenAt: 1000, removedAt: null });
  const expectedScores = Object.fromEntries(players.map(p => [p, 0]));
  let now = 1001;
  room = applyHostAction(room, { type: "START_GAME", actionId: "start", roundId: "lobby", expectedPhase: "LOBBY", payload: {} }, now).next;
  assert.ok(room.sketchRelay!.showdown); assert.equal(room.sketchRelay!.phase, "prompt-writing");
  const playerAct = (p: string, type: string, payload: Record<string, unknown>) => { const action = PlayerActionSchema.parse({ type, actionId: `action-${++now}`, expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: { matchId: room.sketchRelay!.matchId, round: room.sketchRelay!.round, ...payload } }); room = applyPlayerAction(room, p, action, now).next; };
  const advance = async () => { room = (await advanceState(room, ++now)).next; };
  for (const p of players) playerAct(p, "SUBMIT_SKETCH_PROMPT", { prompt: `A dragon doing ${p}'s shopping` }); await advance();
  for (const p of players) playerAct(p, "RANK_SKETCH_PROMPTS", { ranking: room.sketchRelay!.showdown!.promptOptions.filter(o => o.authorId !== p).slice(0, 3).map(o => o.id) }); await advance();
  for (const round of [1, 2, 3]) {
    if (round === 2) { assert.equal(room.sketchRelay!.phase, "curse-selection"); const curse = room.sketchRelay!.showdown!.curse!; playerAct(curse.chooserId, "CHOOSE_SKETCH_CURSE", { curse: curse.options[0] }); await advance(); }
    if (round === 3) { assert.equal(room.sketchRelay!.phase, "final-preparation"); for (const p of players) playerAct(p, "PREPARE_SKETCH_FINAL", { modifier: "banquet", starter: "dragon" }); await advance(); }
    assert.equal(room.sketchRelay!.round, round); assert.equal(room.sketchRelay!.phase, "drawing");
    const cs = room.sketchRelay!.chains.filter(c => c.round === round);
    for (const c of cs) {
      const assetId = `source-${c.chainId}`;
      const uploaded = applySketchRelayUpload(room, c.originalPlayerId, { matchId: room.sketchRelay!.matchId, round, chainId: c.chainId, leg: "drawing", promptIndex: 0, assetId, width: 480, height: 480, byteSize: 1000, contentType: "image/png", objectKey: `sources/${assetId}` }, ++now);
      const job = uploaded.effects.find(e => e.type === "job"); assert.ok(job?.type === "job");
      assert.equal((job.prompt as { prompt: string }).prompt, c.promptChoices[0]);
      room = uploaded.next;
      const jobId = room.sketchRelay!.chains.find(v => v.chainId === c.chainId)!.drawing!.image.jobId!;
      room = applySketchRelayImageResult(room, { matchId: room.sketchRelay!.matchId, round, chainId: c.chainId, leg: "drawing", sourceAssetId: assetId, jobId, status: "READY", assetId: `art-${c.chainId}` }, ++now).next;
      assert.equal(canViewSketchRelayAsset(room, players.find(p => p !== c.originalPlayerId)!, assetId), false);
    }
    await advance(); await advance(); assert.equal(room.sketchRelay!.phase, "showcase");
    for (const c of cs) { assert.equal(canViewSketchRelayAsset(room, null, `art-${c.chainId}`), true); assert.equal(canViewSketchRelayAsset(room, null, `source-${c.chainId}`), false); }
    now = room.deadlineAt!; room = (await advanceState(room, now)).next;
    const before = room.sketchRelay!.deadline - now;
    room = applyHostAction(room, { type: "PAUSE", actionId: `pause-${round}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, ++now).next;
    room = deserializeRoomState(serializeRoomState(room)); now += 5000;
    room = applyHostAction(room, { type: "RESUME", actionId: `resume-${round}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: {} }, ++now).next;
    assert.equal(room.deadlineAt! - now, before - 1);
    for (const p of players) playerAct(p, "RANK_SKETCH_LAUGHTER", { ranking: cs.filter(c => c.originalPlayerId !== p).map(c => c.chainId) }); await advance();
    for (const p of players) playerAct(p, "GUESS_SKETCH_ARTISTS", { guesses: room.sketchRelay!.showdown!.ballots.find(b => b.round === round && b.playerId === p)!.ranking.map(entryId => ({ entryId, playerId: cs.find(c => c.chainId === entryId)!.originalPlayerId })) }); await advance();
    for (const p of players) { for (const [rank, c] of cs.filter(c => c.originalPlayerId !== p).entries()) expectedScores[c.originalPlayerId]! += [100, 75, 50][rank]! * round; expectedScores[p]! += 150 * round; }
    const replay = applyHostAction(room, { type: "ADVANCE_SKETCH_RELAY", actionId: `replay-${round}`, roundId: "lobby", expectedPhase: "ARCADE_ACTIVE", payload: { matchId: room.sketchRelay!.matchId, round, phase: "revealing", transition: "replay" } }, ++now);
    room = replay.next; assert.equal(room.deadlineAt! - now, SHOWDOWN_TIMERS.revealing); assert.equal(replay.effects.length, 0);
    while (room.sketchRelay!.phase === "revealing") { now = room.deadlineAt!; room = (await advanceState(room, now)).next; room = deserializeRoomState(serializeRoomState(room)); }
    assert.deepEqual(room.sketchRelay!.scores, expectedScores);
    now = room.deadlineAt!; room = (await advanceState(room, now)).next;
    assert.equal(room.sketchRelay!.phase,"round-results");assert.equal(room.sketchRelay!.showdown!.workshop!.intermissionRound,round);now=room.deadlineAt!;room=(await advanceState(room,now)).next;
    if (round < 3) { assert.equal(room.sketchRelay!.phase, "halfway"); now = room.deadlineAt!; room = (await advanceState(room, now)).next; }
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.arcadeMatch!.result!.roundsPlayed, 3);
  assert.equal(new Set(room.scoreEvents.map(e => e.eventKey)).size, room.scoreEvents.length);
  const effects: Parameters<typeof syncSketchRelayRoom>[1] = []; syncSketchRelayRoom(room, effects, now); assert.equal(effects.length, 0);
  assert.equal(sketchRelaySnapshot(room.sketchRelay!, { role: "host" }).showdown!.revealedEntries.length, 12);
  assert.ok(isValidSketchRelayMatch(deserializeRoomState(serializeRoomState(room)).sketchRelay));
});

test("scripted narration names the last submitter and revealed artist, never anonymous gallery authors", () => {
  const names = players.map(id => ({ id, nickname: `Name-${id}` })); const m = drawing();
  const draw = sketchRelaySnapshot(m, { role: "host" }); draw.showdown!.pendingPlayers = ["p4"];
  assert.ok(showdownCues(draw, 220_000, names).some(c => c.text.includes("Name-p4")));
  assert.ok(showdownCues(draw, 60_000, names).some(c => c.key.endsWith(":minute")));
  const gallery = sketchRelaySnapshot(voting(), { role: "host" }); assert.equal(showdownCues(gallery, 30_000, names).some(c => c.text.includes("Name-")), false);
  gallery.phase = "revealing"; gallery.showdown!.revealEntry = { ...gallery.showdown!.entries[0]!, playerId: "p2", place: 1, laughterPoints: 100 };
  const line = showdownCues(gallery, 14_000, names)[0]!.text; assert.ok(line.includes("Name-p2")); assert.match(line, /won|winner|crowned/);
});

test("short ballot instructions finish before their first spoken time warning", () => {
  const snap = sketchRelaySnapshot(voting(), { role: "host" }); snap.phase = "artist-guessing"; snap.showdown!.phaseDuration = 35_000;
  assert.equal(showdownCues(snap, 29_000, []).some(c => c.key.endsWith(":thirty")), false);
  assert.equal(showdownCues(snap, 10_000, []).some(c => c.key.endsWith(":ten")), true);
});

for (const count of [3, 10]) for (const bots of [false, true]) test(`${count}-player ${bots ? "free practice" : "zero-submission timeout"} matches finish both prompts with canonical scores`, () => {
  const ids = Array.from({ length: count }, (_, i) => `seat-${i}`);
  let m = createSketchRelayMatch({ matchId: `edge-${count}-${bots}`, players: ids, botIds: bots ? ids : [], now: 1000, timerAccessibility: true, rulesVersion: 2 });
  let steps = 0;
  while (m.phase !== "complete" && steps++ < 50) { m = advanceSketchRelay(m, m.deadline).state; assert.ok(isValidSketchRelayMatch(m), `${m.phase} must remain serializable`); }
  assert.equal(m.phase, "complete"); assert.equal(m.round, 2); assert.equal(m.chains.some(c => c.drawing?.image.jobId), false, "Practice must never enqueue generated images");
  if (!bots) { assert.deepEqual(m.scores, Object.fromEntries(ids.map(id => [id, 0]))); assert.equal(sketchRelayScoreEvents(m).length, 0); }
  assert.equal(sketchRelaySnapshot(m, { role: "host" }).showdown!.revealedEntries.length, bots ? count * 2 : 0);
});


test("prompt writing and selection allow two minutes and one minute with extended timers", () => {
  for (const timerAccessibility of [false, true]) {
    const factor = timerAccessibility ? 1.5 : 1;
    const fresh = createSketchRelayMatch({ matchId: "time", players, now: 1000, rulesVersion: 3, timerAccessibility });
    assert.equal(fresh.deadline - fresh.updatedAt, 120_000 * factor);
    const selection = advanceSketchRelay(fresh, fresh.deadline).state;
    assert.equal(selection.phase, "prompt-voting");
    assert.equal(selection.deadline - selection.updatedAt, 60_000 * factor);
  }
});
