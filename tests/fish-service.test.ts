import assert from "node:assert/strict";
import test from "node:test";
import { advanceState, applyHostAction, createRoomState } from "../server/engine";
import { createSketchRelayMatch, sketchRelayScoreEvents } from "../server/arcade/sketch_relay";
import { applyFishRequest, canViewFishAsset, FishRequestSchema, requireFishMatch } from "../server/fish-service";
import { applyFishFinaleAction, createFishFinale, markUnavailableFish, submitFish, tickFishFinale } from "../server/arcade/fish_finale";
import { deserializeRoomState, serializeRoomState } from "../server/serialization";
import { displaySnapshot, hostSnapshot, playerSnapshot } from "../server/snapshots";
import type { RoomState } from "../server/types";

const seats = ["artist-a", "artist-b", "artist-c"];
const host = { id: "host-screen-without-seat", host: true };
/** Only normal engine/helper progression is used: no HTTP test switches, state-completion edits or paid work. */
function active(rulesVersion: 2 | 3 | "legacy" = 3): RoomState {
  const room = createRoomState("FISH", { gameLength: "arcade", arcadeGameId: "sketch-relay", contentMode: "party", timerAccessibility: false }, 1000);
  for (const [i, id] of seats.entries()) room.participants.push({ id, nickname: `Artist ${i + 1}`, nicknameNormalized: `artist ${i + 1}`, role: "player", seat: i + 1, lobbySlot: i + 1, avatar: i, color: "#46DBDC", active: true, pendingActivation: false, bot: true, lastSeenAt: 1000, removedAt: null });
  const next = applyHostAction(room, { type: "START_GAME", actionId: "start-main", expectedPhase: "LOBBY", roundId: "lobby", payload: {} }, 1001).next;
  next.sketchRelay = createSketchRelayMatch({ matchId: next.arcadeMatch!.id, players: seats, botIds: seats, now: 1001, ...(rulesVersion === "legacy" ? {} : { rulesVersion }) });
  next.deadlineAt = next.sketchRelay.deadline;
  return deserializeRoomState(serializeRoomState(next));
}
async function complete(rulesVersion: 2 | 3 | "legacy" = 3): Promise<RoomState> {
  let room = active(rulesVersion);
  for (let step = 0; room.phase === "ARCADE_ACTIVE" && step < 100; step++) {
    const transition = await advanceState(room, Math.max(room.sketchRelay!.updatedAt + 1, room.deadlineAt!));
    assert.equal(transition.effects.some(e => e.type === "job" || e.type === "sketch_source"), false);
    room = transition.next;
  }
  assert.equal(room.phase, "ARCADE_RESULTS"); assert.equal(room.status, "COMPLETE"); assert.equal(room.arcadeMatch!.status, "COMPLETE");
  return deserializeRoomState(serializeRoomState(room));
}
const completed = complete();
const now = (r: RoomState) => Math.max(r.updatedAt, r.sketchRelay!.updatedAt, r.sketchRelay!.finale?.updatedAt ?? 0) + 1;
function request(r: RoomState, type: string, fields: Record<string, unknown> = {}, actor = host, at = now(r)) {
  const f = r.sketchRelay!.finale;
  const body = FishRequestSchema.parse({ actionId: `fish-${type.toLowerCase()}-${at}`, type, payload: { matchId: r.sketchRelay!.matchId, ...(f ? { finaleId: f.finaleId, phase: f.phase } : {}), ...fields } });
  return applyFishRequest(r, actor, body, at);
}
function mainOnly(r: RoomState) { const copy = structuredClone(r); delete copy.sketchRelay!.finale; return copy; }

test("opening fish on an engine-completed v3 match preserves every main result and score event", async () => {
  const before = await completed, saved = structuredClone(before);
  assert.equal(before.sketchRelay!.showdown!.version, 3); assert.equal(before.arcadeMatch!.result!.roundsPlayed, 3); assert.ok(before.scoreEvents.length > 0);
  const opened = request(before, "FISH_OPEN");
  assert.deepEqual(mainOnly(opened), before); assert.deepEqual(before, saved);
  assert.deepEqual(opened.arcadeMatch!.result, before.arcadeMatch!.result); assert.deepEqual(sketchRelayScoreEvents(opened.sketchRelay!), sketchRelayScoreEvents(before.sketchRelay!));
  assert.deepEqual(opened.scoreEvents, before.scoreEvents); assert.equal(opened.matchNumber, before.matchNumber);
  assert.deepEqual(opened.sketchRelay!.finale!.players.map(p => p.id), seats); assert.equal(opened.sketchRelay!.finale!.players.some(p => p.id === host.id), false);
  assert.throws(() => request(opened, "FISH_OPEN"), /BONUS_ALREADY_OFFERED/);
});

test("fish media access keeps owner access and allows all-candidate preload only to trusted display roles", async () => {
  let f = createFishFinale({ matchId: "media", players: seats.map(id => ({ id, name: id })), seed: "media-seed", now: 1000 });
  const act = (type: "FISH_START" | "FISH_ADVANCE") => applyFishFinaleAction(f, { host: true }, { type, payload: { matchId: f.matchId, finaleId: f.finaleId, phase: f.phase } }, f.updatedAt + 1);
  f = act("FISH_START"); f = act("FISH_ADVANCE");
  for (const id of seats) f = submitFish(f, id, `private-${id}`, f.updatedAt + 1);
  while (f.phase !== "reveal") { if (f.phase === "readiness") f = markUnavailableFish(f, [], f.deadline); f = tickFishFinale(f, f.deadline); }
  const room = { sketchRelay: { finale: f } } as RoomState;
  const future = f.revealOrder[1]!, futureEntry = f.entries.find(e => e.id === future)!;
  const early = f.revealOrder[0]!, earlyEntry = f.entries.find(e => e.id === early)!;
  assert.equal(canViewFishAsset(room, futureEntry.playerId, futureEntry.assetId!, false, f.phaseStartedAt), true);
  assert.equal(canViewFishAsset(room, "unrelated-player", futureEntry.assetId!, false, f.phaseStartedAt), false);
  assert.equal(canViewFishAsset(room, undefined, futureEntry.assetId!, false, f.phaseStartedAt), false);
  assert.equal(canViewFishAsset(room, undefined, futureEntry.assetId!, true, f.phaseStartedAt), true);
  assert.equal(canViewFishAsset(room, "unrelated-player", earlyEntry.assetId!, false, f.phaseStartedAt), true);
});

test("display snapshot retains the host's all-candidate reveal preload", async () => {
  const base = await completed;
  let room = request(base, "FISH_OPEN"); room = request(room, "FISH_CONFIGURE", { mode: "peaceful", drawingSeconds: 120 });
  room = request(request(room, "FISH_START"), "FISH_ADVANCE");
  while (room.sketchRelay!.finale!.phase !== "reveal") {
    let f = room.sketchRelay!.finale!;
    if (f.phase === "readiness") f = markUnavailableFish(f, [], f.deadline);
    room.sketchRelay!.finale = tickFishFinale(f, f.deadline);
  }
  const f = room.sketchRelay!.finale!;
  const display = displaySnapshot(room, f.phaseStartedAt).sketchRelay!.finale!;
  assert.equal(display.entries.length, f.revealOrder.length);
  assert.deepEqual(display.entries.map(entry => entry.id), f.revealOrder);
});

test("optional fish state and its independent paused clock survive enclosing room serialization", async () => {
  const before = await completed;
  assert.equal(deserializeRoomState(serializeRoomState(before)).sketchRelay!.finale, undefined);
  let room = request(before, "FISH_OPEN"); room = request(room, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }); room = request(room, "FISH_START"); room = request(room, "FISH_ADVANCE");
  const drawing = structuredClone(room.sketchRelay!.finale!);
  room = request(room, "FISH_PAUSE", {}, host, now(room) + 1000);
  const paused = deserializeRoomState(serializeRoomState(room)); assert.deepEqual(paused.sketchRelay!.finale, room.sketchRelay!.finale);
  assert.equal(paused.deadlineAt, null); assert.equal(paused.paused, false); assert.ok(paused.sketchRelay!.finale!.pausedAt);
  const resumeAt = now(paused) + 5000, delta = resumeAt - paused.sketchRelay!.finale!.pausedAt!;
  room = request(paused, "FISH_RESUME", {}, host, resumeAt);
  assert.equal(room.sketchRelay!.finale!.deadline, drawing.deadline + delta);
  assert.deepEqual(mainOnly(deserializeRoomState(serializeRoomState(room))), before);
});

test("legacy relay, saved v2, active main matches and broken lifecycle identities cannot open fish", async () => {
  for (const room of [await complete("legacy"), await complete(2), active()]) {
    assert.throws(() => requireFishMatch(room), /FISH_REQUIRES_COMPLETED_MATCH/);
    assert.throws(() => request(room, "FISH_OPEN"), /FISH_REQUIRES_COMPLETED_MATCH/);
    assert.equal(deserializeRoomState(serializeRoomState(room)).sketchRelay!.finale, undefined);
  }
  const base = await completed;
  for (const field of ["status", "arcade-status", "arcade-id"] as const) {
    const broken = structuredClone(base);
    if (field === "status") broken.status = "ACTIVE";
    if (field === "arcade-status") broken.arcadeMatch!.status = "ACTIVE";
    if (field === "arcade-id") broken.arcadeMatch!.id = "different-match";
    assert.throws(() => requireFishMatch(broken), /FISH_REQUIRES_COMPLETED_MATCH/);
  }
});

test("player and forged actors cannot open or configure fish and a host screen gains no seat ballot", async () => {
  const base = await completed;
  for (const actor of [{ id: seats[0]!, host: false }, { id: "forged-seat", host: false }]) assert.throws(() => request(base, "FISH_OPEN", {}, actor), /HOST_REQUIRED/);
  const opened = request(base, "FISH_OPEN");
  assert.throws(() => request(opened, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }, { id: seats[0]!, host: false }), /FISH_UNAUTHORIZED/);
  assert.throws(() => request(opened, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }, { id: "forged-seat", host: false }), /PLAYER_REQUIRED/);
  for (const field of ["active", "removedAt"] as const) {
    const inactive = structuredClone(opened); const player = inactive.participants.find(p => p.id === seats[0])!;
    if (field === "active") player.active = false; else player.removedAt = now(inactive);
    assert.throws(() => request(inactive, "FISH_CONFIGURE", { mode: "peaceful", drawingSeconds: 120 }, { id: player.id, host: false }), /PLAYER_REQUIRED/);
  }
  const configured = request(opened, "FISH_CONFIGURE", { mode: "peaceful", drawingSeconds: 120 });
  assert.equal(configured.sketchRelay!.finale!.mode, "peaceful"); assert.deepEqual(configured.sketchRelay!.finale!.ballots, []);
  const running = request(request(configured, "FISH_START"), "FISH_ADVANCE");
  for (let step = 0; running.sketchRelay!.finale!.phase !== "voting" && step < 8; step++) {
    let finale = running.sketchRelay!.finale!;
    if (finale.phase === "readiness") finale = markUnavailableFish(finale, [], finale.deadline);
    running.sketchRelay!.finale = tickFishFinale(finale, finale.deadline);
  }
  assert.equal(running.sketchRelay!.finale!.phase, "voting");
  assert.equal(running.sketchRelay!.finale!.eligibleEntryIds.length, seats.length);
  assert.equal(running.sketchRelay!.finale!.ballots.some(b => b.playerId === host.id), false);
  assert.throws(() => request(running, "FISH_BALLOT", { ranking: [] }), /FISH_UNAUTHORIZED/);
});

test("fish requests reject wrong match, wrong finale and a stale phase after host advancement", async () => {
  const base = await completed;
  assert.throws(() => request(base, "FISH_OPEN", { matchId: "old-main" }), /STALE_MATCH/);
  assert.throws(() => request(base, "FISH_START"), /BONUS_NOT_STARTED/);
  const opened = request(base, "FISH_OPEN");
  for (const fields of [{ matchId: "old-main" }, { finaleId: "old-bonus" }, { phase: "drawing" }]) assert.throws(() => request(opened, "FISH_CONFIGURE", { mode: "peaceful", drawingSeconds: 120, ...fields }), /FISH_STALE_PHASE/);
  const started = request(opened, "FISH_START");
  assert.throws(() => request(started, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90, phase: "configure" }), /FISH_STALE_PHASE/);
  assert.throws(() => request(started, "FISH_CONFIGURE", { mode: "shark", drawingSeconds: 90 }), /FISH_PHASE/);
});

test("independent openings use private random seeds despite identical public completed-match input", async () => {
  const base = await completed, opened = [request(base, "FISH_OPEN"), request(base, "FISH_OPEN")];
  assert.notEqual(opened[0]!.sketchRelay!.finale!.seed, opened[1]!.sketchRelay!.finale!.seed);
  assert.notEqual(opened[0]!.sketchRelay!.finale!.finaleId, opened[1]!.sketchRelay!.finale!.finaleId);
  for (const room of opened) {
    assert.deepEqual(mainOnly(room), base);
    const snapshots = [hostSnapshot(room, now(room)), playerSnapshot(room, room.participants[0]!, now(room))];
    for (const snapshot of snapshots) {
      assert.equal(snapshot.sketchRelay!.finale!.phase, "configure");
      assert.equal(JSON.stringify(snapshot.sketchRelay!.finale).includes(room.sketchRelay!.finale!.seed), false);
      assert.equal("seed" in snapshot.sketchRelay!.finale!, false);
    }
  }
});

test("enclosing persistence rejects cross-match, active-main and semantically corrupted bonus state", async () => {
  const opened = request(await completed, "FISH_OPEN");
  const crossMatch = structuredClone(opened); crossMatch.sketchRelay!.finale!.matchId = "unrelated-main";
  assert.throws(() => deserializeRoomState(JSON.stringify(crossMatch)), /Sketch|sketch/);
  const activeMain = active(); activeMain.sketchRelay!.finale = structuredClone(opened.sketchRelay!.finale!); activeMain.sketchRelay!.finale!.matchId = activeMain.sketchRelay!.matchId;
  assert.throws(() => serializeRoomState(activeMain), /Sketch|sketch/);
  const invalid = structuredClone(opened); invalid.sketchRelay!.finale!.players.push(structuredClone(invalid.sketchRelay!.finale!.players[0]!));
  assert.throws(() => deserializeRoomState(JSON.stringify(invalid)), /Sketch|sketch/);
});

test("configure Back restores the optional offer without resetting the completed main game", async () => {
  const base = await completed, opened = request(base, "FISH_OPEN");
  assert.throws(() => request(opened, "FISH_BACK", {}, { id: seats[0]!, host: false }), /FISH_UNAUTHORIZED/);
  assert.throws(() => request(opened, "FISH_BACK", { finaleId: "stale-bonus" }), /FISH_STALE_PHASE/);
  const returned = request(opened, "FISH_BACK");
  assert.equal(returned.sketchRelay!.finale, undefined); assert.deepEqual(returned, base);
  assert.deepEqual(mainOnly(deserializeRoomState(serializeRoomState(returned))), base);
  const reopened = request(returned, "FISH_OPEN"); assert.equal(reopened.sketchRelay!.finale!.phase, "configure");
  assert.notEqual(reopened.sketchRelay!.finale!.seed, opened.sketchRelay!.finale!.seed);
  const started = request(reopened, "FISH_START"); assert.throws(() => request(started, "FISH_BACK"), /FISH_PHASE/);
  assert.ok(started.sketchRelay!.finale); assert.deepEqual(mainOnly(started), base);
});


test("temporary test early art requires a trusted host while ordinary bonus stays private",()=>{
 let f=createFishFinale({matchId:"test-preview",players:seats.map(id=>({id,name:id})),seed:"safe-preview",now:1000});
 for(const type of ["FISH_START","FISH_ADVANCE"] as const)f=applyFishFinaleAction(f,{host:true},{type,payload:{matchId:f.matchId,finaleId:f.finaleId,phase:f.phase}},f.updatedAt+1);
 f=submitFish(f,seats[0]!,"accepted-art",f.updatedAt+1);
 const testRoom={sketchRelay:{finale:f,fishTest:true}} as RoomState;
 assert.equal(canViewFishAsset(testRoom,undefined,"accepted-art",true,f.updatedAt),true);
 assert.equal(canViewFishAsset(testRoom,seats[1],"accepted-art",false,f.updatedAt),false);
 assert.equal(canViewFishAsset(testRoom,undefined,"accepted-art",false,f.updatedAt),false);
 const normal={sketchRelay:{finale:f}} as RoomState;
 assert.equal(canViewFishAsset(normal,undefined,"accepted-art",true,f.updatedAt),false);
});
