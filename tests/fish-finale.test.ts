import assert from "node:assert/strict";
import test from "node:test";
import { FishFinaleStateSchema, type FishFinaleAction, type FishFinaleState } from "../lib/arcade/fish-finale";
import { applyFishFinaleAction, createFishFinale, fishFinaleSnapshot, isValidFishFinale, markUnavailableFish, submitFish, tickFishFinale } from "../server/arcade/fish_finale";

const roster = ["a", "b", "c", "d"].map(id => ({ id, name: `Artist ${id}` }));
const fresh = (count = 4) => createFishFinale({ matchId: "complete-main", players: roster.slice(0, count), seed: "private-seed", now: 1000 });
function action(s: FishFinaleState, type: FishFinaleAction["type"], fields: Record<string, unknown> = {}, id?: string, now = s.updatedAt + 1) {
  return applyFishFinaleAction(s, { host: !id, id }, { type, payload: { matchId: s.matchId, finaleId: s.finaleId, phase: s.phase, ...fields } } as FishFinaleAction, now);
}
function draw(count = 4, mode: "peaceful" | "shark" = "peaceful") {
  let s = fresh(); s = action(s, "FISH_CONFIGURE", { mode, drawingSeconds: 120 }); s = action(s, "FISH_START"); s = action(s, "FISH_ADVANCE");
  for (const p of roster.slice(0, count)) s = submitFish(s, p.id, `asset-${p.id}`, s.updatedAt + 1);
  return s;
}
function reveal(count = 4, mode: "peaceful" | "shark" = "peaceful") {
  let s = draw(count, mode); while (!["reveal", "closed"].includes(s.phase)) s = readinessTick(s); return s;
}
function voting(mode: "peaceful" | "shark" = "peaceful") { const s = reveal(4, mode); return tickFishFinale(s, s.deadline); }
const readinessTick = (s: FishFinaleState) => tickFishFinale(s.phase === "readiness" ? markUnavailableFish(s, [], s.deadline) : s, s.deadline);
const entry = (s: FishFinaleState, playerId: string) => s.entries.find(e => e.playerId === playerId)!.id;

test("fish configuration stays untimed, freezes mode and uses a separate persisted clock", () => {
  const base = fresh(); assert.equal(base.mode, "peaceful"); assert.equal(base.deadline, 0); assert.deepEqual(tickFishFinale(base, 999999), base);
  const drawing = draw(); assert.equal(drawing.phase, "drawing"); assert.equal(drawing.deadline - drawing.phaseStartedAt, 120000);
  assert.throws(() => action(drawing, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }), /PHASE/);
  assert.ok(isValidFishFinale(JSON.parse(JSON.stringify(drawing)))); assert.equal("scores" in drawing, false);
});
test("only frozen participants submit and canonical art locks with idempotent retries", () => {
  const s = draw(1), old = s.entries[0]!;
  assert.deepEqual(submitFish(s, "a", old.assetId!, s.updatedAt + 1), s);
  assert.throws(() => submitFish(s, "a", "replacement", s.updatedAt + 1), /ALREADY/);
  assert.throws(() => submitFish(s, "late", "late-art", s.updatedAt + 1), /UNAUTHORIZED/);
  const g = tickFishFinale(s, s.deadline); assert.equal(g.phase, "grace");
  const accepted = submitFish(g, "b", "in-flight", g.updatedAt + 9999); assert.equal(accepted.entries.length, 2);
  assert.throws(() => submitFish(g, "b", "too-late", g.deadline), /CLOSED/);
});
test("authorities reject forged, stale and hostless phase actions", () => {
  const s = voting();
  assert.throws(() => action(s, "FISH_ADD_TIME", {}, "a"), /UNAUTHORIZED/);
  assert.throws(() => action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }), /UNAUTHORIZED/);
  assert.throws(() => applyFishFinaleAction(s, { id: "a", host: false }, { type: "FISH_BALLOT", payload: { matchId: "other", finaleId: s.finaleId, phase: s.phase, ranking: [] } }, s.updatedAt + 1), /STALE/);
  assert.throws(() => action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a", s.deadline), /CLOSED/);
});
test("ranked voting uses fixed k for partial ballots and excludes self, duplicate and unknown fish", () => {
  let s = voting(); assert.equal(fishFinaleSnapshot(s, "a").rankLimit, 3);
  for (const ranking of [[entry(s, "a")], [entry(s, "b"), entry(s, "b")], ["forged"]]) assert.throws(() => action(s, "FISH_BALLOT", { ranking }, "a"), /INVALID/);
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a");
  assert.deepEqual(action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"), s);
  assert.throws(() => action(s, "FISH_BALLOT", { ranking: [] }, "a"), /ALREADY/);
  s = tickFishFinale(s, s.deadline); assert.equal(s.result!.ranking.find(r => r.entryId === entry(s, "b"))!.points, 3);
  assert.equal(s.result!.receivedBallots, 1); assert.equal(s.result!.expectedBallots, 4);
});
test("all explicit locks including abstention produce a server three-second early-close countdown", () => {
  let s = voting(); for (const p of roster) s = action(s, "FISH_BALLOT", { ranking: [] }, p.id);
  assert.equal(s.deadline - s.updatedAt, 3000); assert.equal(tickFishFinale(s, s.deadline - 1).phase, "voting");
  s = tickFishFinale(s, s.deadline); assert.equal(s.result!.kind, "no-votes"); assert.equal(s.phase, "artists");
});
test("exact tie draws are persisted, disclosed and independent of submission or ballot order", () => {
  let s = voting("shark");
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a");
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "a")] }, "b");
  const one = tickFishFinale(s, s.deadline), two = tickFishFinale(JSON.parse(JSON.stringify(s)), s.deadline);
  assert.deepEqual(one.result, two.result); assert.equal(one.result!.ranking.filter(r => r.tieDraw).length, 4);
  assert.equal(one.result!.ranking[0]!.points, one.result!.ranking[1]!.points);
});
test("private snapshot hides identities, seed and complete outcomes until their staged reveal", () => {
  let s = voting("shark"), snap = fishFinaleSnapshot(s, "a", true);
  assert.equal(snap.entries.some(e => e.artistName || e.playerId), false); assert.equal(JSON.stringify(snap).includes("private-seed"), false);
  assert.equal(snap.self!.ownEntryId, entry(s, "a"));
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"); s = tickFishFinale(s, s.deadline);
  snap = fishFinaleSnapshot(s, "a", true); assert.equal(snap.result, undefined); assert.equal(snap.champion, undefined);
  s = tickFishFinale(s, s.deadline); snap = fishFinaleSnapshot(s, undefined, true);
  assert.ok(snap.champion); assert.equal(snap.entries.filter(e => e.artistName).length, 1);
  s = tickFishFinale(s, s.deadline); assert.equal(fishFinaleSnapshot(s).entries.filter(e => e.artistName).length, 4);
});
test("two fish skip voting, disclose lucky draw and may choose an unranked peaceful showcase", () => {
  let s = reveal(2, "shark"); assert.match(fishFinaleSnapshot(s).notice!, /lucky draw, not a vote/);
  const lucky = tickFishFinale(s, s.deadline); assert.equal(lucky.result!.kind, "lucky"); assert.equal(lucky.phase, "cinematic");
  assert.deepEqual(tickFishFinale(JSON.parse(JSON.stringify(s)), s.deadline).result, lucky.result);
  s = action(s, "FISH_SHOWCASE"); s = tickFishFinale(s, s.deadline);
  assert.equal(s.mode, "peaceful"); assert.equal(s.result!.kind, "showcase"); assert.equal(s.result!.championEntryId, undefined);
});
test("zero, one and no-vote fish finish without manufacturing a competitive champion", () => {
  const empty = reveal(0, "shark"); assert.equal(empty.phase, "closed"); assert.equal(empty.closedReason, "no-fish");
  let solo = reveal(1, "shark"); solo = tickFishFinale(solo, solo.deadline);
  assert.equal(solo.phase, "artists"); assert.equal(solo.mode, "peaceful"); assert.equal(solo.result!.kind, "solo"); assert.equal(solo.result!.championEntryId, undefined);
  let none = voting("shark"); none = tickFishFinale(none, none.deadline); assert.equal(none.phase, "artists"); assert.equal(none.result!.kind, "no-votes");
});
test("pause/resume preserves the authoritative phase elapsed time and deadline across reload", () => {
  let s = draw(1); const paused = action(s, "FISH_PAUSE", {}, undefined, s.updatedAt + 5000);
  const before = fishFinaleSnapshot(paused, "a", true, paused.updatedAt + 20000);
  assert.deepEqual(tickFishFinale(paused, paused.deadline + 100000), paused);
  s = action(JSON.parse(JSON.stringify(paused)), "FISH_RESUME", {}, undefined, paused.updatedAt + 20000);
  assert.equal(s.deadline, paused.deadline + 20000); assert.equal(fishFinaleSnapshot(s, "a", true, s.updatedAt).elapsedMs, before.elapsedMs);
});
test("shark playback is a bounded reconstruction of stored eliminations and skip never reranks", () => {
  let s = voting("shark"); s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"); s = tickFishFinale(s, s.deadline);
  const ranking = s.result!.ranking.map(r => r.entryId), eliminated: string[] = [];
  assert.ok(s.deadline - s.phaseStartedAt <= 75000);
  for (let t = s.phaseStartedAt; t < s.deadline; t += 100) {
    const snap = fishFinaleSnapshot(s, undefined, true, t);
    for (const id of snap.cinematic!.eliminatedEntryIds) if (!eliminated.includes(id)) eliminated.push(id);
  }
  assert.deepEqual(eliminated, ranking.slice(1).reverse()); assert.equal(eliminated.includes(ranking[0]!), false);
  const skipped = action(s, "FISH_SKIP"); assert.equal(skipped.phase, "artists"); assert.deepEqual(skipped.result, s.result);
});
test("peaceful playback never emits attacks or removals and every fish remains for aquarium", () => {
  let s = voting(); s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"); s = tickFishFinale(s, s.deadline);
  for (let t = s.phaseStartedAt; t < s.deadline; t += 1000) {
    const c = fishFinaleSnapshot(s, undefined, true, t).cinematic!; assert.deepEqual(c.eliminatedEntryIds, []); assert.equal(c.event!.kind, "peaceful-awards");
  }
  while (s.phase !== "aquarium") s = tickFishFinale(s, s.deadline);
  assert.equal(fishFinaleSnapshot(s).entries.length, 4); assert.equal(new Set(s.entries.map(e => e.id)).size, 4);
});
test("practice bot art and ballots are deterministic data without paid image jobs", () => {
  const make = () => createFishFinale({ matchId: "practice", players: roster.map(p => ({ ...p, bot: true })), seed: "same", now: 1000 });
  let s = action(action(make(), "FISH_START"), "FISH_ADVANCE"); assert.equal(s.entries.length, 4); assert.ok(s.entries.every(e => e.practice && !e.assetId));
  while (s.phase !== "voting") s = readinessTick(s);
  assert.equal(s.ballots.length, 4); assert.equal(JSON.stringify(s).includes("job"), false); assert.deepEqual(action(action(make(), "FISH_START"), "FISH_ADVANCE").entries, drawBots());
  function drawBots() { return action(action(make(), "FISH_START"), "FISH_ADVANCE").entries; }
});
test("persisted schema rejects corrupted eligibility, ballots, dimensions and result tampering", () => {
  const s = voting(); const duplicate = structuredClone(s); duplicate.eligibleEntryIds.push(duplicate.eligibleEntryIds[0]!); assert.equal(isValidFishFinale(duplicate), false);
  const bad = structuredClone(s); bad.entries[0]!.bounds.width = 2; assert.equal(FishFinaleStateSchema.safeParse(bad).success, false);
  const forged = structuredClone(s); forged.ballots.push({ playerId: "a", ranking: [entry(s, "a")], lockedAt: s.updatedAt }); assert.equal(isValidFishFinale(forged), false);
});

test("three and ten candidates keep fixed rank limits and determinism regardless of submission order", () => {
  for (const count of [3, 10]) {
    const players = Array.from({ length: count }, (_, i) => ({ id: `seat-${i}`, name: `Artist ${i}` }));
    function make(reverse: boolean) {
      let s = createFishFinale({ matchId: "scale", players, seed: "stable", now: 1000 });
      s = action(action(s, "FISH_START"), "FISH_ADVANCE");
      for (const p of reverse ? [...players].reverse() : players) s = submitFish(s, p.id, `asset-${p.id}`, s.updatedAt + 1);
      while (s.phase !== "voting") s = readinessTick(s);
      return s;
    }
    const one = make(false), two = make(true);
    assert.deepEqual(one.revealOrder, two.revealOrder); assert.equal(fishFinaleSnapshot(one, "seat-0").rankLimit, Math.min(3, count - 1));
    assert.deepEqual(fishFinaleSnapshot(one, "seat-0").self!.ballotOptions, fishFinaleSnapshot(two, "seat-0").self!.ballotOptions);
    assert.equal(fishFinaleSnapshot(one, "seat-0").self!.ballotOptions.includes(entry(one, "seat-0")), false);
  }
});
test("first-place then second-place vote counts decide equal-point rankings before exact-tie draws", () => {
  let s = voting();
  // A receives one first and two thirds (5 points); B receives one first and one second (5), so B wins on seconds.
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b"), entry(s, "c"), entry(s, "a")] }, "d");
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "d"), entry(s, "b"), entry(s, "a")] }, "c");
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "a")] }, "b");
  s = tickFishFinale(s, s.deadline);
  const a = s.result!.ranking.find(r => r.entryId === entry(s, "a"))!, b = s.result!.ranking.find(r => r.entryId === entry(s, "b"))!;
  assert.equal(a.points, b.points); assert.equal(a.firsts, b.firsts); assert.ok(b.seconds > a.seconds);
  assert.ok(s.result!.ranking.indexOf(b) < s.result!.ranking.indexOf(a)); assert.equal(a.tieDraw, false);
});
test("pause cannot extend an expired vote and repeated skip preserves artists/aquarium state", () => {
  let s = voting("shark"); assert.throws(() => action(s, "FISH_PAUSE", {}, undefined, s.deadline), /CLOSED/);
  assert.throws(() => action(s, "FISH_SKIP"), /NOT_LOCKED/);
  s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"); s = tickFishFinale(s, s.deadline);
  s = action(s, "FISH_SKIP"); assert.deepEqual(action(s, "FISH_SKIP"), s);
  s = tickFishFinale(s, s.deadline); assert.deepEqual(action(s, "FISH_SKIP"), s);
});

test("saved outcomes cannot change a lucky draw's tally, champion, ownership or peaceful promise", () => {
  const before = reveal(2, "shark"), s = tickFishFinale(before, before.deadline);
  assert.ok(isValidFishFinale(s));
  const points = structuredClone(s); points.result!.ranking[0]!.points = 99; assert.equal(isValidFishFinale(points), false);
  const winner = structuredClone(s); winner.result!.championEntryId = winner.result!.ranking[1]!.entryId; assert.equal(isValidFishFinale(winner), false);
  const owner = structuredClone(s); owner.entries[0]!.playerId = "forged"; assert.equal(isValidFishFinale(owner), false);
  let solo = reveal(1); solo = tickFishFinale(solo, solo.deadline); solo.mode = "shark"; assert.equal(isValidFishFinale(solo), false);
});

test("anonymous fish identifiers have enough opaque entropy to avoid enumerating known seat identities", () => {
  const s = voting(), snapshot = fishFinaleSnapshot(s, "a");
  for (const e of snapshot.entries) assert.match(e.id, /^fish-[a-f0-9]{32}$/u);
  assert.equal(snapshot.entries.some(e => roster.some(p => e.id.includes(`:${p.id}`))), false);
});

test("readiness requires storage reconciliation and unavailable fish retain acknowledged art without gaining votes", () => {
  let s = draw(3, "shark"); s = tickFishFinale(s, s.deadline); s = tickFishFinale(s, s.deadline);
  assert.equal(s.phase, "readiness");
  assert.throws(() => action(s, "FISH_ADVANCE"), /READINESS/);
  assert.throws(() => action(s, "FISH_ADVANCE", {}, undefined, s.deadline), /READINESS/);
  assert.deepEqual(tickFishFinale(s, s.deadline + 1000), s);
  const missing = entry(s, "c"), stored = structuredClone(s.entries);
  assert.throws(() => markUnavailableFish(s, ["forged"], s.deadline), /INVALID/);
  s = markUnavailableFish(s, [missing], s.deadline); s = tickFishFinale(s, s.updatedAt);
  assert.equal(s.phase, "reveal"); assert.equal(s.eligibleEntryIds.length, 2); assert.deepEqual(s.entries, stored);
  assert.equal(s.eligibleEntryIds.includes(missing), false); assert.ok(isValidFishFinale(s));
  const snap = fishFinaleSnapshot(s, "c"); assert.equal(snap.self!.submitted, true); assert.equal(snap.self!.eligible, false); assert.equal(snap.unavailableCount, 1);
  s = tickFishFinale(s, s.deadline); assert.equal(s.result!.kind, "lucky"); assert.equal(s.result!.expectedBallots, 0);
});

test("presentation checkpoints touch revision only when an introduction, shot, bite or revival disclosure changes", () => {
  let s = reveal(4, "shark"); const start = s.phaseStartedAt;
  assert.equal(tickFishFinale(s, start + 2999), s);
  const intro = tickFishFinale(s, start + 3000); assert.equal(intro.revision, s.revision + 1);
  assert.notEqual(fishFinaleSnapshot(intro, undefined, true, start + 3000).revealEntryId, fishFinaleSnapshot(s, undefined, true, start).revealEntryId);
  assert.equal(tickFishFinale(intro, start + 3100), intro);
  const fullTank = tickFishFinale(intro, start + s.eligibleEntryIds.length * 3000);
  assert.equal(fishFinaleSnapshot(fullTank, undefined, true, fullTank.updatedAt).revealEntryId, undefined);
  assert.equal(fishFinaleSnapshot(fullTank, undefined, true, fullTank.updatedAt).revealedEntryIds.length, 4);
  assert.equal(tickFishFinale(fullTank, fullTank.updatedAt + 100), fullTank);
  s = tickFishFinale(fullTank, fullTank.deadline); s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"); s = tickFishFinale(s, s.deadline);
  const cinemaStart = s.phaseStartedAt;
  assert.equal(tickFishFinale(s, cinemaStart + 3999), s);
  s = tickFishFinale(s, cinemaStart + 4000); const entryRevision = s.revision;
  assert.equal(fishFinaleSnapshot(s, undefined, true, cinemaStart + 4000).cinematic!.event!.kind, "shark-entry");
  assert.equal(tickFishFinale(s, cinemaStart + 4100), s);
  s = tickFishFinale(s, cinemaStart + 8000); assert.equal(s.revision, entryRevision + 1);
  const hunt = fishFinaleSnapshot(s, undefined, true, cinemaStart + 8000).cinematic!; assert.equal(hunt.event!.kind, "hunt"); assert.deepEqual(hunt.eliminatedEntryIds, []);
  const beforeBite = s; s = tickFishFinale(s, cinemaStart + 11000); assert.equal(s.revision, beforeBite.revision + 1);
  const bite = fishFinaleSnapshot(s, undefined, true, cinemaStart + 11000); assert.equal(bite.cinematic!.eliminatedEntryIds.length, 1); assert.equal(bite.result, undefined); assert.equal(bite.champion, undefined);
  assert.equal(tickFishFinale(s, cinemaStart + 11100), s);
  while (s.phase !== "aquarium") s = tickFishFinale(s, s.deadline);
  const aquarium = s; assert.equal(tickFishFinale(s, s.phaseStartedAt + 3999), s);
  s = tickFishFinale(s, s.phaseStartedAt + 4000); assert.equal(s.revision, aquarium.revision + 1);
  assert.equal(tickFishFinale(s, s.phaseStartedAt + 9000), s);
});

test("reveal snapshots disclose introduced fish and own art while host can preload all candidates", () => {
  const s = reveal(4); const first = s.revealOrder[0]!, second = s.revealOrder[1]!;
  const ownEntry = s.entries.find(e => e.id === second)!;
  const ownerId = ownEntry.playerId;
  const initial = fishFinaleSnapshot(s, ownerId, false, s.phaseStartedAt);
  assert.deepEqual(initial.entries.map(e => e.id), [first, second]);
  assert.equal(initial.entries[1]!.assetId, ownEntry.assetId);
  const host = fishFinaleSnapshot(s, undefined, true, s.phaseStartedAt);
  assert.deepEqual(host.entries.map(e => e.id), s.revealOrder);
  assert.equal(host.entries[1]!.label, "B");
  const paused = action(s, "FISH_PAUSE", {}, undefined, s.phaseStartedAt + 1000);
  const held = fishFinaleSnapshot(paused, ownerId, false, paused.pausedAt! + 9000);
  assert.deepEqual(held.entries.map(e => e.id), [first, second]);
  assert.equal(held.entries[1]!.assetId, ownEntry.assetId);
  const resumed = action(paused, "FISH_RESUME", {}, undefined, paused.pausedAt! + 5000);
  const later = fishFinaleSnapshot(resumed, ownerId, false, resumed.phaseStartedAt + 6000);
  assert.ok(later.entries.some(e => e.id === s.revealOrder[2]));
  assert.equal(later.entries.find(e => e.id === second)!.label, "B");
});

test("optional presentation checkpoints recover saved bonuses and remain frozen through cinematic pause", () => {
  let s = voting("shark"); s = action(s, "FISH_BALLOT", { ranking: [entry(s, "b")] }, "a"); s = tickFishFinale(s, s.deadline);
  const oldSaved = structuredClone(s); delete oldSaved.presentationKey; assert.ok(isValidFishFinale(oldSaved));
  const recovered = tickFishFinale(oldSaved, oldSaved.updatedAt); assert.equal(recovered.revision, oldSaved.revision + 1); assert.equal(tickFishFinale(recovered, recovered.updatedAt + 1), recovered);
  const start = s.phaseStartedAt; s = action(s, "FISH_PAUSE", {}, undefined, start + 2000);
  assert.equal(tickFishFinale(s, start + 10000), s);
  s = action(s, "FISH_RESUME", {}, undefined, start + 12000);
  assert.equal(tickFishFinale(s, start + 13999), s);
  const next = tickFishFinale(s, start + 14000); assert.equal(next.revision, s.revision + 1);
  assert.equal(fishFinaleSnapshot(next, undefined, true, start + 14000).cinematic!.event!.kind, "shark-entry");
});


test("temporary test aquarium previews committed art without publishing identities or ballots",()=>{
 const state=draw(2);
 const normal=fishFinaleSnapshot(state,undefined,true,state.updatedAt);
 assert.equal(normal.entries.length,0,"normal bonus keeps staged anonymous reveal");
 const preview=fishFinaleSnapshot(state,undefined,true,state.updatedAt,true);
 assert.equal(preview.entries.length,2);
 assert.ok(preview.entries.every(e=>!e.playerId&&!e.artistName&&e.label==="Fish"));
 assert.equal(preview.eligibleCount,0);assert.equal(preview.result,undefined);
 assert.equal(fishFinaleSnapshot(state,"a",false,state.updatedAt,true).entries.length,1);
 assert.equal(fishFinaleSnapshot(state,undefined,false,state.updatedAt,true).entries.length,0);
});


test("fish defaults to four minutes and each supported host duration controls the authoritative deadline", () => {
  assert.equal(fresh().drawingSeconds, 240);
  for (const seconds of [90,120,180,240,300,360]) {
    let s = action(fresh(), "FISH_CONFIGURE", { mode: "peaceful", drawingSeconds: seconds });
    s = action(action(s, "FISH_START"), "FISH_ADVANCE");
    assert.equal(s.deadline - s.phaseStartedAt, seconds * 1000);
    assert.ok(isValidFishFinale(JSON.parse(JSON.stringify(s))));
  }
});
