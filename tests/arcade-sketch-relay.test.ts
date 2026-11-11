import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, applyPlayerAction, createRoomState } from "../server/engine";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { hostSnapshot, playerSnapshot } from "../server/snapshots";
import { applySketchRelayUpload, applySketchRelayImageResult, advanceSketchRelay, canViewSketchRelayAsset, createSketchRelayMatch, isValidSketchRelayMatch, sketchRelaySnapshot, SKETCH_RELAY_TIMERS } from "../server/arcade/sketch_relay";
import { HostActionSchema, PlayerActionSchema } from "../lib/contracts";
import type { RoomState } from "../server/types";
import type { SketchRelayLeg, SketchRelayUploadReceipt } from "../lib/arcade/sketch-relay";

const players = ["p1", "p2", "p3"];
function start(botIds: string[] = [], extended = false): RoomState {
  const room = createRoomState("SKETCH", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: extended }, 1000);
  for (const [i, id] of players.entries()) room.participants.push({ id, nickname: `Player ${i}`, nicknameNormalized: `player ${i}`, role: "player", seat: i + 1, lobbySlot: i + 1, avatar: i, color: "#fff", active: true, pendingActivation: false, bot: botIds.includes(id), lastSeenAt: 1000, removedAt: null });
  const started = applyHostAction(room, { type: "START_GAME", actionId: "start", expectedPhase: "LOBBY", roundId: "lobby", payload: {} }, 1001).next;
  // Saved relay matches keep their original rules after the showdown upgrade.
  started.sketchRelay = createSketchRelayMatch({ matchId: started.arcadeMatch!.id, players, botIds, now: 1001, timerAccessibility: extended }); started.deadlineAt = started.sketchRelay.deadline; return started;
}
function receipt(room: RoomState, playerId: string, leg: SketchRelayLeg = "drawing"): SketchRelayUploadReceipt {
  const m = room.sketchRelay!; const c = m.chains.find(c => c.round === m.round && (leg === "drawing" ? c.originalPlayerId : c.redrawPlayerId) === playerId)!;
  const assetId = `${m.matchId}-r${m.round}-${playerId}-${leg}`;
  return { matchId: m.matchId, round: m.round, chainId: c.chainId, leg, ...(leg === "drawing" ? { promptIndex: 1 } : {}), assetId, width: 512, height: 512, byteSize: 1000, objectKey: `sources/${assetId}.png`, contentType: "image/png" };
}
function submitCaption(room: RoomState, playerId: string, text: string, now: number) {
  const m = room.sketchRelay!; const c = m.chains.find(c => c.round === m.round && c.captionPlayerId === playerId)!;
  return applyPlayerAction(room, playerId, { type: "SUBMIT_SKETCH_CAPTION", actionId: `${playerId}-${m.round}-caption`, expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: { matchId: m.matchId, round: m.round, chainId: c.chainId, caption: text } }, now);
}
function hostNext(room: RoomState, now: number) {
  const m = room.sketchRelay!; return applyHostAction(room, { type: "ADVANCE_SKETCH_RELAY", actionId: `advance-${now}`, expectedPhase: room.phase, roundId: "lobby", payload: { matchId: m.matchId, round: m.round, phase: m.phase, transition: "next" } }, now);
}
function finishImage(room: RoomState, r: SketchRelayUploadReceipt, now: number) {
  const l = room.sketchRelay!.chains.find(c => c.chainId === r.chainId)![r.leg]!;
  return applySketchRelayImageResult(room, { matchId: r.matchId, round: r.round, chainId: r.chainId, leg: r.leg, sourceAssetId: r.assetId, jobId: l.image.jobId!, status: "READY", assetId: `${r.assetId}-art` }, now).next;
}

test("Sketch relay creates fixed three-person rings for every round and rejects invalid rosters", () => {
  const m = createSketchRelayMatch({ matchId: "relay", players, now: 0 }); assert.equal(m.chains.length, 9); assert.equal(m.chains[0]!.captionPlayerId, "p2"); assert.equal(m.chains[0]!.redrawPlayerId, "p3"); assert.equal(m.chains[2]!.captionPlayerId, "p1"); assert.equal(isValidSketchRelayMatch(m), true);
  assert.throws(() => createSketchRelayMatch({ matchId: "relay", players: ["p1", "p2"], now: 0 })); assert.throws(() => createSketchRelayMatch({ matchId: "relay", players: ["p1", "p1", "p3"], now: 0 }));
  const room = start(); assert.deepEqual(room.arcadeMatch?.controllerIds, players); assert.deepEqual(deserializeRoomState(serializeRoomState(room)).sketchRelay, room.sketchRelay);
});

test("Upload accepts authenticated assignments once and atomically emits source, image job and participation score", () => {
  const room = start(); const r = receipt(room, "p1"); const result = applySketchRelayUpload(room, "p1", r, 1002); assert.deepEqual(result.effects.map(e => e.type), ["sketch_source", "job", "score"]); assert.equal(result.next.sketchRelay?.scores.p1, 100); const job = result.effects.find(e => e.type === "job")!; assert.equal(job.type === "job" && job.kind, "SKETCH_TRANSFORM"); assert.equal(JSON.stringify(job).includes("penguin"), false); assert.deepEqual(applySketchRelayUpload(result.next, "p1", r, 1003).effects, []);
  assert.throws(() => applySketchRelayUpload(room, "p2", r, 1002), /UNAUTHORIZED/); assert.throws(() => applySketchRelayUpload(room, "p1", { ...r, round: 2 }, 1002), /STALE/); assert.throws(() => applySketchRelayUpload(room, "p1", { ...r, width: 513 }, 1002)); assert.throws(() => applySketchRelayUpload(room, "p1", { ...r, height: 300 }, 1002)); assert.throws(() => applySketchRelayUpload(room, "p1", { ...r, byteSize: 450001 }, 1002)); assert.throws(() => applySketchRelayUpload(room, "p1", { ...r, promptIndex: undefined }, 1002), /PROMPT_REQUIRED/);
});

test("Private snapshots show only the assigned image, then only the assigned caption", async () => {
  let room = start(); const r = receipt(room, "p1"); room = applySketchRelayUpload(room, "p1", r, 1002).next; room = finishImage(room, r, 1003);
  assert.equal(canViewSketchRelayAsset(room, null, r.assetId), false); assert.equal(canViewSketchRelayAsset(room, "p3", `${r.assetId}-art`), false); assert.equal(hostSnapshot(room, 1003).sketchRelay?.self, undefined);
  room = (await advanceState(room, room.deadlineAt!)).next; room = (await advanceState(room, room.sketchRelay!.updatedAt + 1)).next; assert.equal(room.sketchRelay?.phase, "captioning");
  const snap = playerSnapshot(room, room.participants[1]!, room.sketchRelay!.updatedAt).sketchRelay!; assert.equal(snap.self?.sourceImage?.assetId, `${r.assetId}-art`); assert.equal(snap.self?.prompt, undefined); assert.equal(snap.self?.promptChoices, undefined); assert.equal(snap.reveal, undefined); assert.equal(canViewSketchRelayAsset(room, "p2", `${r.assetId}-art`), true); assert.equal(canViewSketchRelayAsset(room, "p2", r.assetId), false);
  room = submitCaption(room, "p2", "A royal duck balancing a cake", room.sketchRelay!.updatedAt + 1).next; room = (await advanceState(room, room.deadlineAt!)).next;
  const redraw = playerSnapshot(room, room.participants[2]!, room.sketchRelay!.updatedAt).sketchRelay!; assert.equal(redraw.self?.caption, "A royal duck balancing a cake"); assert.equal(redraw.self?.sourceImage, undefined); assert.equal(redraw.self?.prompt, undefined); assert.equal(redraw.self?.chainId, r.chainId); assert.equal(canViewSketchRelayAsset(room, "p3", `${r.assetId}-art`), false);
});

test("Transform timeout freezes the actual submitted sketch and rejects late output", async () => {
  let room = start(); const r = receipt(room, "p1"); room = applySketchRelayUpload(room, "p1", r, 1002).next; const jobId = room.sketchRelay!.chains[0]!.drawing!.image.jobId!; room = (await advanceState(room, room.deadlineAt!)).next; assert.equal(room.sketchRelay!.phase, "transforming"); const deadline = room.deadlineAt!;
  const stale = applySketchRelayImageResult(room, { ...r, sourceAssetId: r.assetId, jobId, status: "READY", assetId: "late-art" }, deadline); assert.equal(stale.next, room);
  room = (await advanceState(room, deadline)).next; const image = room.sketchRelay!.chains[0]!.drawing!.image; assert.equal(image.status, "FALLBACK"); assert.equal(image.assetId, r.assetId); assert.equal(finishImage(room, r, deadline + 1), room); assert.deepEqual(deserializeRoomState(serializeRoomState(room)).sketchRelay, room.sketchRelay);
});

test("Late and paused image results serialize safely and pause/resume preserves remaining stage time", () => {
  let room = start(); const r = receipt(room, "p1"); room = applySketchRelayUpload(room, "p1", r, 1002).next; room = finishImage(room, r, room.deadlineAt! + 50); assert.doesNotThrow(() => deserializeRoomState(serializeRoomState(room)));
  let fresh = start(); const receipt2 = receipt(fresh, "p1"); fresh = applySketchRelayUpload(fresh, "p1", receipt2, 1002).next; const paused = applyHostAction(fresh, { type: "PAUSE", actionId: "pause", expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: {} }, 2000).next; const remaining = paused.remainingMs; const finished = finishImage(paused, receipt2, 100_000); assert.doesNotThrow(() => deserializeRoomState(serializeRoomState(finished))); assert.equal(finished.paused, true); assert.throws(() => applySketchRelayUpload(paused, "p2", receipt(paused, "p2"), 2001), /GAME_PAUSED/);
  const resumed = applyHostAction(finished, { type: "RESUME", actionId: "resume", expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: {} }, 100_001).next; assert.equal(resumed.sketchRelay!.deadline, 100_001 + remaining!); assert.equal(resumed.deadlineAt, resumed.sketchRelay!.deadline);
});

test("Three complete rounds award reproducible participation and one eligible applause per voter per round, then replay", async () => {
  let room = start(); let now = 1001;
  for (let round = 1; round <= 3; round++) {
    for (const p of players) { const r = receipt(room, p); room = applySketchRelayUpload(room, p, r, ++now).next; room = finishImage(room, r, ++now); }
    room = (await advanceState(room, ++now)).next; room = (await advanceState(room, ++now)).next; assert.equal(room.sketchRelay!.phase, "captioning");
    for (const p of players) room = submitCaption(room, p, `${p} saw a tiny dragon`, ++now).next;
    room = (await advanceState(room, ++now)).next;
    for (const p of players) { const r = receipt(room, p, "redraw"); room = applySketchRelayUpload(room, p, r, ++now).next; room = finishImage(room, r, ++now); }
    room = (await advanceState(room, ++now)).next; room = (await advanceState(room, ++now)).next; assert.equal(room.sketchRelay!.phase, "revealing");
    const c = room.sketchRelay!.chains.find(c => c.round === round)!;
    const applause = { matchId: room.sketchRelay!.matchId, round, chainId: c.chainId, leg: "drawing" as const };
    assert.throws(() => applyPlayerAction(room, c.originalPlayerId, { type: "SUBMIT_SKETCH_APPLAUSE", actionId: `own-${round}`, expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: applause }, ++now), /INVALID_APPLAUSE/);
    const voter = c.captionPlayerId; const submitted = applyPlayerAction(room, voter, { type: "SUBMIT_SKETCH_APPLAUSE", actionId: `applause-${round}`, expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: applause }, ++now); room = submitted.next; assert.equal(submitted.effects.filter(e => e.type === "score").length, 1); const duplicate = applyPlayerAction(room, voter, { type: "SUBMIT_SKETCH_APPLAUSE", actionId: `again-${round}`, expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: applause }, ++now); assert.deepEqual(duplicate.effects, []);
    while (room.sketchRelay!.phase === "revealing") room = hostNext(room, ++now).next;
    assert.equal(room.sketchRelay!.phase, "round-results"); room = hostNext(room, ++now).next;
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.arcadeMatch!.status, "COMPLETE"); assert.equal(room.sketchRelay!.phase, "complete"); assert.equal(room.sketchRelay!.scores.p1, 975); assert.equal(room.sketchRelay!.scores.p2, 900); assert.equal(room.sketchRelay!.scores.p3, 900); assert.equal(room.scoreEvents.length, 30); assert.equal(new Set(room.scoreEvents.map(e => e.eventKey)).size, 30); assert.equal(hostSnapshot(room, now).sketchRelay!.chains!.length, 9); assert.deepEqual(deserializeRoomState(serializeRoomState(room)).sketchRelay, room.sketchRelay);
  const replay = applyHostAction(room, { type: "ADVANCE_SKETCH_RELAY", actionId: "replay", expectedPhase: "ARCADE_RESULTS", roundId: "lobby", payload: { matchId: room.sketchRelay!.matchId, round: 3, phase: "complete", transition: "replay" } }, ++now).next; assert.equal(replay.phase, "LOBBY"); assert.equal(replay.sketchRelay, null); assert.equal(replay.code, room.code); assert.equal(replay.matchNumber, 2); assert.equal(replay.scoreEvents.length, 0);
});

test("Bots use deterministic practice with zero paid image effects and timed missing submissions finish", async () => {
  let room = start(players); assert.equal(room.sketchRelay!.chains[0]!.drawing!.practice, true); assert.equal(sketchRelaySnapshot(room.sketchRelay!, { role: "host" }).self, undefined); let steps = 0;
  while (room.phase === "ARCADE_ACTIVE" && steps++ < 60) { const transition = await advanceState(room, Math.max(room.sketchRelay!.updatedAt + 1, room.deadlineAt!)); assert.equal(transition.changed, true); assert.equal(transition.effects.some(e => e.type === "job" || e.type === "sketch_source"), false); room = transition.next; }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.deepEqual(room.sketchRelay!.scores, { p1: 900, p2: 900, p3: 900 }); assert.equal(hostSnapshot(room, room.sketchRelay!.updatedAt).sketchRelay!.chains!.every(c => c.drawing?.practice && c.redraw?.practice), true);
  let empty = start(); for (let i = 0; i < 36 && empty.phase === "ARCADE_ACTIVE"; i++) empty = (await advanceState(empty, empty.deadlineAt!)).next; assert.equal(empty.phase, "ARCADE_RESULTS"); assert.deepEqual(empty.sketchRelay!.scores, { p1: 0, p2: 0, p3: 0 });
});

test("Serialization rejects corrupted scores, assignments, source metadata, future contributions and lifecycle", () => {
  const room = start(); const badScore = structuredClone(room); badScore.sketchRelay!.scores.p1 = 100; assert.throws(() => deserializeRoomState(JSON.stringify(badScore)), /Sketch|sketch/);
  const badRing = structuredClone(room); badRing.sketchRelay!.chains[0]!.redrawPlayerId = "p1"; assert.throws(() => deserializeRoomState(JSON.stringify(badRing)), /Sketch|sketch/);
  const badFuture = structuredClone(room); badFuture.sketchRelay!.chains[0]!.caption = "Forged caption"; badFuture.sketchRelay!.chains[0]!.captionAt = 1001; badFuture.sketchRelay!.scores.p2 = 100; assert.throws(() => deserializeRoomState(JSON.stringify(badFuture)), /Sketch|sketch/);
  const missing = structuredClone(room); missing.sketchRelay = null; assert.throws(() => deserializeRoomState(JSON.stringify(missing)), /Sketch|sketch/);
  assert.throws(() => hostNext(room, 1002), /TOO_EARLY/);
  assert.throws(() => applyHostAction(room, { type: "ADVANCE_SKETCH_RELAY", actionId: "stale", expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: { matchId: room.sketchRelay!.matchId, round: 1, phase: "captioning", transition: "next" } }, 1002), /STALE/);
});

test("Maximum extended match remains below nineteen minutes and image waits never scale", () => {
  const players10 = Array.from({ length: 10 }, (_, i) => `p${i}`); let m = createSketchRelayMatch({ matchId: "extended", players: players10, now: 0, timerAccessibility: true });
  const started = 0; while (m.phase !== "complete") m = advanceSketchRelay(m, m.deadline).state;
  assert.ok(m.updatedAt - started < 19 * 60_000); assert.equal(m.updatedAt, 18 * 60_000 + 45_000); assert.equal(SKETCH_RELAY_TIMERS.transforming, 35_000); assert.equal(SKETCH_RELAY_TIMERS["transforming-redraw"], 35_000); assert.equal(SKETCH_RELAY_TIMERS.revealing, 12_000);
});

test("Action contracts enforce bounded 140-character captions and closed phase/match payloads", () => {
  const common = { actionId: "sketch-action", expectedPhase: "ARCADE_ACTIVE", roundId: "lobby" }; const payload = { matchId: "m", round: 1, chainId: "c", caption: "x".repeat(140) }; assert.equal(PlayerActionSchema.safeParse({ ...common, type: "SUBMIT_SKETCH_CAPTION", payload }).success, true); assert.equal(PlayerActionSchema.safeParse({ ...common, type: "SUBMIT_SKETCH_CAPTION", payload: { ...payload, caption: "x".repeat(141) } }).success, false); assert.equal(HostActionSchema.safeParse({ ...common, type: "ADVANCE_SKETCH_RELAY", payload: { matchId: "m", round: 1, phase: "drawing", transition: "next" } }).success, true);
});


test("Host replay restarts only the current reveal timeline and stale replay requests are rejected", async () => {
  let room = start(); while (room.sketchRelay!.phase !== "revealing") room = (await advanceState(room, room.deadlineAt!)).next;
  room = hostNext(room, room.sketchRelay!.updatedAt + 1).next;
  const original = room.sketchRelay!; const now = original.updatedAt + 3000;
  const replay = applyHostAction(room, { type: "ADVANCE_SKETCH_RELAY", actionId: "replay-current", expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: { matchId: original.matchId, round: original.round, phase: "revealing", transition: "replay" } }, now);
  assert.equal(replay.next.phase, "ARCADE_ACTIVE"); assert.equal(replay.next.sketchRelay!.phase, "revealing"); assert.equal(replay.next.sketchRelay!.revealIndex, original.revealIndex); assert.equal(replay.next.sketchRelay!.round, original.round); assert.equal(replay.next.deadlineAt, now + 12000); assert.deepEqual(replay.next.sketchRelay!.scores, original.scores); assert.deepEqual(replay.effects, []); assert.equal(replay.next.matchNumber, room.matchNumber); assert.doesNotThrow(() => deserializeRoomState(serializeRoomState(replay.next)));
  assert.throws(() => applyHostAction(room, { type: "ADVANCE_SKETCH_RELAY", actionId: "replay-stale", expectedPhase: "ARCADE_ACTIVE", roundId: "lobby", payload: { matchId: original.matchId, round: 2, phase: "revealing", transition: "replay" } }, now), /STALE/);
});


test("Snapshots discover only active current-round queued image job IDs without private payloads", async () => {
  const initial = start(); assert.equal(hostSnapshot(initial, 1001).imageJobsPending, false); assert.equal(hostSnapshot(initial, 1001).sketchImageJobs, undefined);
  let room = initial; const r = receipt(room, "p1"); room = applySketchRelayUpload(room, "p1", r, 1002).next; const jobId = room.sketchRelay!.chains[0]!.drawing!.image.jobId!;
  for (const snapshot of [hostSnapshot(room, 1002), playerSnapshot(room, room.participants[1]!, 1002)]) {
    assert.equal(snapshot.imageJobsPending, true); assert.deepEqual(snapshot.sketchImageJobs, [jobId]); assert.equal(snapshot.sketchRelay?.reveal, undefined); assert.equal(JSON.stringify(snapshot).includes(r.objectKey), false); assert.equal(JSON.stringify(snapshot).includes("sourceAssetId"), false); assert.equal(JSON.stringify(snapshot).includes("promptIndex"), false);
  }
  const ready = finishImage(room, r, 1003); assert.equal(hostSnapshot(ready, 1003).imageJobsPending, false); assert.equal(hostSnapshot(ready, 1003).sketchImageJobs, undefined);
  room = (await advanceState(room, room.deadlineAt!)).next; room = (await advanceState(room, room.deadlineAt!)).next; assert.equal(room.sketchRelay!.phase, "captioning"); assert.equal(hostSnapshot(room, room.sketchRelay!.updatedAt).sketchImageJobs, undefined);
  const inactive = structuredClone(initial); inactive.phase = "ARCADE_RESULTS"; inactive.arcadeMatch!.status = "COMPLETE"; inactive.sketchRelay = structuredClone(applySketchRelayUpload(initial, "p1", r, 1002).next.sketchRelay); assert.equal(hostSnapshot(inactive, 1003).sketchImageJobs, undefined); assert.equal(hostSnapshot(inactive, 1003).imageJobsPending, false);
  const future = structuredClone(initial); const nextRoundChain = future.sketchRelay!.chains.find(c => c.round === 2)!; nextRoundChain.drawing = structuredClone(applySketchRelayUpload(initial, "p1", r, 1002).next.sketchRelay!.chains[0]!.drawing); assert.equal(hostSnapshot(future, 1003).sketchImageJobs, undefined);
});
