import { createHash } from "node:crypto";
import {
  FISH_ART_DEFAULTS, FishArtMetadataSchema, FishFinaleActionSchema, FishFinaleStateSchema,
  type FishArtMetadata, type FishFinaleAction, type FishFinaleActor, type FishFinaleCinematicEvent,
  type FishFinaleEntry, type FishFinalePhase, type FishFinalePublicEntry, type FishFinaleResult,
  type FishFinaleSnapshot, type FishFinaleState,
} from "../../lib/arcade/fish-finale";

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const fail = (code: string): never => { throw new Error(code); };
const unique = (ids: string[]) => new Set(ids).size === ids.length;
/** Domain-separated SHA-256 prevents visible art traits/IDs from exposing the private tie seed. */
function digest(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function hash(value: string): number { return Number.parseInt(digest(value).slice(0, 8), 16); }
function shuffled(ids: string[], seed: string) { return [...ids].sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`) || a.localeCompare(b)); }
function at(s: FishFinaleState, now: number) { return Math.max(s.phaseStartedAt, s.pausedAt ?? now); }
function elapsed(s: FishFinaleState, now: number) { return Math.max(0, at(s, now) - s.phaseStartedAt); }
const rankLimit = (s: FishFinaleState) => Math.min(3, Math.max(0, s.eligibleEntryIds.length - 1));
const voterIds = (s: FishFinaleState) => s.eligibleEntryIds.map(id => s.entries.find(e => e.id === id)!.playerId);
function changed(s: FishFinaleState, now: number) {
  s.updatedAt = now; s.revision += 1;
  const key = presentationKey(s, now); if (key === undefined) delete s.presentationKey; else s.presentationKey = key;
  return s;
}
function checkNow(s: FishFinaleState, now: number) { if (!Number.isFinite(now) || now < s.updatedAt) fail("FISH_INVALID_TIME"); }
function enter(s: FishFinaleState, phase: FishFinalePhase, now: number, duration = 0) { s.phase = phase; s.phaseStartedAt = now; s.deadline = duration ? now + duration : 0; delete s.earlyCloseAt; }
function newEntry(s: FishFinaleState, playerId: string, now: number, assetId?: string, metadata = FISH_ART_DEFAULTS): FishFinaleEntry {
  return { ...copy(metadata), id: `fish-${digest(`${s.seed}:entry:${playerId}`).slice(0, 32)}`, playerId, assetId, practice: !assetId, appearanceSeed: hash(`${s.seed}:art:${playerId}`), submittedAt: now };
}
function startDrawing(s: FishFinaleState, now: number) {
  enter(s, "drawing", now, s.drawingSeconds * 1000);
  for (const p of s.players.filter(p => p.bot && s.participantIds.includes(p.id))) if (!s.entries.some(e => e.playerId === p.id)) s.entries.push(newEntry(s, p.id, now));
}
function freezeEntries(s: FishFinaleState, now: number) {
  s.eligibleEntryIds = shuffled(s.entries.filter(e => !s.unavailableEntryIds.includes(e.id)).map(e => e.id), `${s.seed}:introductions`);
  s.revealOrder = [...s.eligibleEntryIds];
  if (!s.eligibleEntryIds.length) { enter(s, "closed", now); s.closedReason = "no-fish"; return; }
  enter(s, "reveal", now, (s.eligibleEntryIds.length + 1) * 3000);
}
function rows(s: FishFinaleState): FishFinaleResult["ranking"] {
  const k = rankLimit(s);
  const tally = s.eligibleEntryIds.map(entryId => ({ entryId, points: 0, firsts: 0, seconds: 0, tieDraw: false }));
  for (const ballot of s.ballots) for (const [i, id] of ballot.ranking.entries()) {
    const row = tally.find(r => r.entryId === id)!; row.points += k - i; if (i === 0) row.firsts++; if (i === 1) row.seconds++;
  }
  for (const row of tally) row.tieDraw = tally.some(other => other !== row && other.points === row.points && other.firsts === row.firsts && other.seconds === row.seconds);
  return tally.sort((a, b) => b.points - a.points || b.firsts - a.firsts || b.seconds - a.seconds || hash(`${s.seed}:tie:${a.entryId}`) - hash(`${s.seed}:tie:${b.entryId}`) || a.entryId.localeCompare(b.entryId));
}
function luckyRows(s: FishFinaleState): FishFinaleResult["ranking"] {
  return shuffled(s.eligibleEntryIds, `${s.seed}:lucky`).map(entryId => ({ entryId, points: 0, firsts: 0, seconds: 0, tieDraw: true }));
}
function lockResult(s: FishFinaleState, now: number) {
  if (s.result) return;
  const n = s.eligibleEntryIds.length, selections = s.ballots.reduce((sum, b) => sum + b.ranking.length, 0);
  const kind: FishFinaleResult["kind"] = n === 1 ? "solo" : n === 2 ? (s.showcaseOnly ? "showcase" : "lucky") : selections ? "voted" : "no-votes";
  const ranked = kind === "voted" ? rows(s) : kind === "lucky" ? luckyRows(s) : [];
  s.result = { kind, ranking: ranked, championEntryId: ranked[0]?.entryId, lockedAt: now, receivedBallots: s.ballots.length, expectedBallots: n >= 3 ? n : 0, selections };
  if (!ranked.length) { s.mode = "peaceful"; enter(s, "artists", now, 8000); return; }
  enter(s, "cinematic", now, cinematicPlan(s).reduce((sum, shot) => sum + shot.durationMs, 0));
}
/** Timeline is derived only from a locked outcome; it never uses renderer positions or client clocks. */
function cinematicPlan(s: FishFinaleState): Array<Omit<FishFinaleCinematicEvent, "startedAt" | "elapsedMs">> {
  if (!s.result?.championEntryId) return [];
  const ids = s.result.ranking.map(r => r.entryId);
  if (s.mode === "peaceful") {
    const duration = Math.min(18000, 10000 + ids.length * 800), each = Math.floor(duration / ids.length);
    return [...ids].reverse().map((targetEntryId, i) => ({ id: `${s.finaleId}:awards:${i}`, kind: "peaceful-awards", durationMs: i === ids.length - 1 ? duration - each * i : each, targetEntryId }));
  }
  return [
    { id: `${s.finaleId}:tension`, kind: "tension", durationMs: 4000 },
    { id: `${s.finaleId}:entry`, kind: "shark-entry", durationMs: 4000 },
    ...ids.slice(2).reverse().map((targetEntryId, i) => ({ id: `${s.finaleId}:hunt:${i}`, kind: "hunt" as const, durationMs: 4200, targetEntryId, biteAtMs: 3000 })),
    { id: `${s.finaleId}:final-two`, kind: "final-two", durationMs: 10000, targetEntryId: ids[1], biteAtMs: 8000 },
    { id: `${s.finaleId}:charge`, kind: "charge", durationMs: 4000, targetEntryId: ids[0] },
  ];
}
/** Only disclosure boundaries change the saved presentation checkpoint, never every animation frame. */
function presentationKey(s: FishFinaleState, now: number): string | undefined {
  const e = elapsed(s, now);
  if (s.phase === "reveal") { const frame = revealFrame(s, now); return `reveal:${frame.entryId ?? "all"}:${frame.introducedCount}`; }
  if (s.phase === "cinematic") {
    const frame = cinematicFrame(s, now);
    return JSON.stringify(["cinematic", frame.event?.id, frame.eliminatedEntryIds]);
  }
  if (s.phase === "aquarium") return e < 4000 ? "aquarium:revival" : "aquarium:rest";
  return undefined;
}
function revealFrame(s: FishFinaleState, now: number) {
  const index = Math.floor(elapsed(s, now) / 3000);
  return { entryId: s.revealOrder[index], introducedCount: Math.min(s.revealOrder.length, index + 1) };
}
function cinematicFrame(s: FishFinaleState, now: number): NonNullable<FishFinaleSnapshot["cinematic"]> {
  const e = elapsed(s, now); let start = 0;
  const eliminatedEntryIds: string[] = []; let event: FishFinaleCinematicEvent | undefined;
  for (const shot of cinematicPlan(s)) {
    if (shot.targetEntryId && shot.biteAtMs !== undefined && e >= start + shot.biteAtMs) eliminatedEntryIds.push(shot.targetEntryId);
    if (e >= start && e < start + shot.durationMs) event = { ...shot, startedAt: s.phaseStartedAt + start, elapsedMs: e - start };
    start += shot.durationMs;
  }
  return { event, durationMs: start, eliminatedEntryIds };
}
function startVoting(s: FishFinaleState, now: number) {
  enter(s, "voting", now, 35000);
  // Only explicitly configured practice seats produce free deterministic practice ballots.
  for (const p of s.players.filter(p => p.bot && voterIds(s).includes(p.id))) {
    const own = s.entries.find(e => e.playerId === p.id)!.id;
    s.ballots.push({ playerId: p.id, ranking: shuffled(s.eligibleEntryIds.filter(id => id !== own), `${s.seed}:bot-vote:${p.id}`).slice(0, rankLimit(s)), lockedAt: now });
  }
  earlyClose(s, now);
}
function earlyClose(s: FishFinaleState, now: number) { if (s.ballots.length === s.eligibleEntryIds.length) { s.earlyCloseAt = Math.min(s.deadline, now + 3000); s.deadline = s.earlyCloseAt; } }
function advance(s: FishFinaleState, now: number) {
  switch (s.phase) {
    case "tutorial": startDrawing(s, now); break;
    case "drawing": enter(s, "grace", now, 10000); break;
    case "grace": enter(s, "readiness", now, 10000); break;
    case "readiness": freezeEntries(s, now); break;
    case "reveal": if (s.eligibleEntryIds.length >= 3) startVoting(s, now); else lockResult(s, now); break;
    case "voting": lockResult(s, now); break;
    case "cinematic": enter(s, "champion", now, 10000); break;
    case "champion": enter(s, "artists", now, 8000); break;
    case "artists": enter(s, "aquarium", now); break;
    default: fail("FISH_PHASE");
  }
}

export function createFishFinale(input: { matchId: string; players: Array<{ id: string; name: string; bot?: boolean }>; seed: string; now: number }): FishFinaleState {
  const s: FishFinaleState = { version: 1, matchId: input.matchId, finaleId: `fish-${hash(`${input.matchId}:${input.seed}`).toString(36)}`, seed: input.seed, revision: 0, phase: "configure", mode: "peaceful", drawingSeconds: 240, createdAt: input.now, updatedAt: input.now, phaseStartedAt: input.now, deadline: 0, players: input.players.map(p => ({ ...p, bot: Boolean(p.bot) })), participantIds: [], eligibleEntryIds: [], entries: [], unavailableEntryIds: [], readinessChecked: false, revealOrder: [], ballots: [], graceExtended: false, showcaseOnly: false };
  if (!isValidFishFinale(s)) fail("FISH_INVALID"); return s;
}

/** Caller must authenticate the seat and validate/store the immutable alpha PNG before calling. No job is created. */
export function submitFish(state: FishFinaleState, playerId: string, assetId: string, now: number, metadata: FishArtMetadata = FISH_ART_DEFAULTS): FishFinaleState {
  checkNow(state, now);
  if (!state.participantIds.includes(playerId) || state.players.find(p => p.id === playerId)?.bot) fail("FISH_UNAUTHORIZED");
  const previous = state.entries.find(e => e.playerId === playerId);
  if (previous) { if (previous.assetId === assetId && JSON.stringify(previous.anchors) === JSON.stringify(metadata.anchors) && previous.width === metadata.width && previous.height === metadata.height && JSON.stringify(previous.bounds) === JSON.stringify(metadata.bounds)) return state; fail("FISH_ALREADY_SUBMITTED"); }
  if (state.pausedAt !== undefined || !["drawing", "grace"].includes(state.phase) || now >= state.deadline) fail("FISH_CLOSED");
  if (!assetId || assetId.length > 200 || !FishArtMetadataSchema.safeParse(metadata).success || metadata.bounds.x + metadata.bounds.width > 1.000001 || metadata.bounds.y + metadata.bounds.height > 1.000001) fail("FISH_INVALID");
  const s = copy(state); s.entries.push(newEntry(s, playerId, now, assetId, metadata)); return changed(s, now);
}

export function applyFishFinaleAction(state: FishFinaleState, actor: FishFinaleActor, input: FishFinaleAction, now: number): FishFinaleState {
  const parsed = FishFinaleActionSchema.safeParse(input); if (!parsed.success) return fail("FISH_INVALID_ACTION");
  const action = parsed.data; checkNow(state, now);
  if (action.payload.matchId !== state.matchId || action.payload.finaleId !== state.finaleId || action.payload.phase !== state.phase) fail("FISH_STALE_PHASE");
  if (action.type !== "FISH_BALLOT" && !actor.host) fail("FISH_UNAUTHORIZED");
  if (state.phase === "closed") fail("FISH_CLOSED");
  if (state.pausedAt !== undefined && !["FISH_RESUME", "FISH_EXIT"].includes(action.type)) fail("FISH_PAUSED");
  const s = copy(state);
  switch (action.type) {
    case "FISH_CONFIGURE": if (s.phase !== "configure") fail("FISH_PHASE"); s.mode = action.payload.mode; s.drawingSeconds = action.payload.drawingSeconds; break;
    case "FISH_BACK": if (s.phase !== "configure") fail("FISH_PHASE"); return state; // The room service removes the unstarted optional state.
    case "FISH_START": if (s.phase !== "configure") fail("FISH_PHASE"); s.participantIds = s.players.map(p => p.id); enter(s, "tutorial", now, 8000); break;
    case "FISH_ADVANCE":
      if (s.phase === "readiness") fail("FISH_READINESS_REQUIRES_RECONCILIATION");
      if (!["tutorial", "reveal", "champion", "artists"].includes(s.phase) && (!s.deadline || now < s.deadline)) fail("FISH_TOO_EARLY");
      advance(s, now); break;
    case "FISH_ADD_TIME": if (s.phase !== "drawing" || now >= s.deadline) fail("FISH_PHASE"); s.deadline += 30000; break;
    case "FISH_EXTEND_GRACE": if (s.phase !== "grace" || s.graceExtended || now >= s.deadline) fail("FISH_PHASE"); s.graceExtended = true; s.deadline += 15000; break;
    case "FISH_PAUSE": if (!s.deadline) fail("FISH_PHASE"); if (now >= s.deadline) fail("FISH_CLOSED"); s.pausedAt = now; break;
    case "FISH_RESUME": {
      const pausedAt = s.pausedAt; if (pausedAt === undefined) return fail("FISH_PHASE"); const delta = now - pausedAt; s.phaseStartedAt += delta; if (s.deadline) s.deadline += delta; if (s.earlyCloseAt) s.earlyCloseAt += delta; delete s.pausedAt; break;
    }
    case "FISH_EXIT": s.closedReason = s.result ? "finished" : "abandoned"; delete s.pausedAt; enter(s, "closed", now); break;
    case "FISH_SKIP": if (!s.result) fail("FISH_RESULT_NOT_LOCKED"); if (["artists", "aquarium"].includes(s.phase)) return state; enter(s, "artists", now, 8000); break;
    case "FISH_SHOWCASE": if (s.phase !== "reveal" || s.eligibleEntryIds.length !== 2 || s.result) fail("FISH_PHASE"); s.mode = "peaceful"; s.showcaseOnly = true; break;
    case "FISH_BALLOT": {
      const playerId = actor.id; if (!playerId || !voterIds(s).includes(playerId)) return fail("FISH_UNAUTHORIZED");
      if (s.phase !== "voting" || now >= s.deadline) fail("FISH_CLOSED");
      const ranking = action.payload.ranking, old = s.ballots.find(b => b.playerId === actor.id);
      if (old) { if (JSON.stringify(old.ranking) === JSON.stringify(ranking)) return state; fail("FISH_ALREADY_LOCKED"); }
      const own = s.entries.find(e => e.playerId === actor.id)!.id;
      if (!unique(ranking) || ranking.length > rankLimit(s) || ranking.some(id => id === own || !s.eligibleEntryIds.includes(id))) fail("FISH_INVALID_BALLOT");
      s.ballots.push({ playerId, ranking: [...ranking], lockedAt: now }); earlyClose(s, now); break;
    }
  }
  return changed(s, now);
}

/** The authenticated room service resolves availability against stored jobs and MEDIA at the bounded readiness cutoff.
 * Passing an empty list explicitly confirms every accepted object is ready. Failed entries remain stored for recovery.
 * This is an authority-only helper, deliberately absent from the player/host action union. */
export function markUnavailableFish(state: FishFinaleState, unavailableEntryIds: string[], now: number): FishFinaleState {
  checkNow(state, now);
  if (state.phase !== "readiness" || state.pausedAt !== undefined) fail("FISH_PHASE");
  if (unavailableEntryIds.length > 10 || !unique(unavailableEntryIds) || unavailableEntryIds.some(id => !state.entries.some(e => e.id === id))) fail("FISH_INVALID_ASSET_RECONCILIATION");
  const ids = [...unavailableEntryIds].sort();
  if (state.readinessChecked && JSON.stringify(ids) === JSON.stringify(state.unavailableEntryIds)) return state;
  const s = copy(state); s.unavailableEntryIds = ids; s.readinessChecked = true; return changed(s, now);
}

/** Advance at most one phase, avoiding a burst of missed cinematic beats after a disconnected display.
 * The room service must reconcile readiness at its cutoff, marking failed/transient objects unavailable
 * on the final bounded attempt. Other bonus timers require no storage/provider work or main-game mutation.
 */
export function tickFishFinale(state: FishFinaleState, now: number): FishFinaleState {
  if (state.pausedAt !== undefined) return state;
  if (state.deadline && now >= state.deadline && (state.phase !== "readiness" || state.readinessChecked)) {
    checkNow(state, now); const s = copy(state); advance(s, now); return changed(s, now);
  }
  const key = presentationKey(state, now);
  if (key === undefined || key === state.presentationKey) return state;
  checkNow(state, now); return changed(copy(state), now);
}

export function fishFinaleSnapshot(s: FishFinaleState, viewerId?: string, host = false, now = s.updatedAt, testPreview = false): FishFinaleSnapshot {
  const e = elapsed(s, now), own = s.entries.find(entry => entry.playerId === viewerId);
  const revealed = ["reveal", "voting", "cinematic", "champion", "artists", "aquarium"].includes(s.phase) || s.phase === "closed" && Boolean(s.result);
  const allArtists = ["artists", "aquarium"].includes(s.phase) || s.phase === "closed" && Boolean(s.result);
  const championVisible = ["champion", "artists", "aquarium"].includes(s.phase) || s.phase === "closed" && Boolean(s.result);
  const winner = championVisible && s.result?.championEntryId ? s.entries.find(entry => entry.id === s.result!.championEntryId) : undefined;
  const reveal = s.phase === "reveal" ? revealFrame(s, now) : undefined;
  const introducedIds = s.revealOrder.slice(0, reveal?.introducedCount ?? (revealed ? s.revealOrder.length : 0));
  const candidates = revealed
    ? host || s.phase !== "reveal"
      ? s.revealOrder.map(id => s.entries.find(entry => entry.id === id)!)
      : [...new Set([...introducedIds, ...(own ? [own.id] : [])])].map(id => s.entries.find(entry => entry.id === id)!)
    : host && testPreview && ["drawing", "grace", "readiness"].includes(s.phase) ? s.entries.filter(entry => !s.unavailableEntryIds.includes(entry.id)) : own ? [own] : [];
  const entries: FishFinalePublicEntry[] = candidates.map(entry => ({ id: entry.id, label: s.revealOrder.includes(entry.id) ? String.fromCharCode(65 + s.revealOrder.indexOf(entry.id)) : host && testPreview ? "Fish" : "Your fish", assetId: entry.assetId, practice: entry.practice, appearanceSeed: entry.appearanceSeed, width: entry.width, height: entry.height, anchors: copy(entry.anchors), bounds: copy(entry.bounds), ...(allArtists || winner?.id === entry.id ? { artistName: s.players.find(p => p.id === entry.playerId)!.name, playerId: entry.playerId } : {}) }));
  const introducedCount = reveal?.introducedCount ?? (revealed ? s.revealOrder.length : 0);
  const selfBallot = s.ballots.find(b => b.playerId === viewerId);
  const snapshot: FishFinaleSnapshot = {
    version: 1, matchId: s.matchId, finaleId: s.finaleId, revision: s.revision, phase: s.phase, mode: s.mode, drawingSeconds: s.drawingSeconds,
    phaseStartedAt: s.phaseStartedAt, deadline: s.deadline, serverNow: now, paused: s.pausedAt !== undefined, elapsedMs: e,
    participantCount: s.participantIds.length, submittedCount: s.entries.length, eligibleCount: s.eligibleEntryIds.length, unavailableCount: s.unavailableEntryIds.length, ballotCount: s.ballots.length,
    expectedBallotCount: s.eligibleEntryIds.length >= 3 ? s.eligibleEntryIds.length : 0, rankLimit: rankLimit(s), entries,
    revealEntryId: reveal?.entryId,
    revealedEntryIds: s.revealOrder.slice(0, introducedCount),
    ...(viewerId ? { self: { participant: s.participantIds.includes(viewerId), submitted: Boolean(own), ownEntryId: own?.id, eligible: Boolean(own && s.eligibleEntryIds.includes(own.id)), ballotLocked: Boolean(selfBallot), ranking: selfBallot ? [...selfBallot.ranking] : undefined, ballotOptions: s.phase === "voting" && own && s.eligibleEntryIds.includes(own.id) ? shuffled(s.eligibleEntryIds.filter(id => id !== own.id), `${s.seed}:ballot:${viewerId}`) : [] } } : {}),
    canChooseShowcase: host && s.phase === "reveal" && s.eligibleEntryIds.length === 2, graceExtended: s.graceExtended, closedReason: s.closedReason,
  };
  if (s.eligibleEntryIds.length === 2 && ["reveal", "cinematic", "champion"].includes(s.phase)) snapshot.notice = s.showcaseOnly ? "A peaceful showcase — everyone's staying." : "With two fish, this is a lucky draw, not a vote.";
  if (s.result?.kind === "no-votes") snapshot.notice = "No votes — everyone's staying.";
  if (s.result?.kind === "solo") snapshot.notice = "One beautiful fish — let's celebrate its artist.";
  if (s.unavailableEntryIds.length) snapshot.notice = `${snapshot.notice ? `${snapshot.notice} ` : ""}Some fish could not load and are sitting this one out. Their artwork is kept.`;
  if (s.phase === "cinematic") snapshot.cinematic = cinematicFrame(s, now);
  if (winner) snapshot.champion = { entryId: winner.id, artistName: s.players.find(p => p.id === winner.playerId)!.name, label: s.result!.kind === "lucky" ? "Lucky Tank Champion" : "Tank Champion" };
  if (championVisible && s.result) snapshot.result = copy(s.result);
  return snapshot;
}

/** Structural plus semantic validation for the saved-state boundary; absent bonuses need no migration. */
export function isValidFishFinale(value: unknown): value is FishFinaleState {
  const parsed = FishFinaleStateSchema.safeParse(value); if (!parsed.success) return false;
  const s = parsed.data, players = s.players.map(p => p.id), owners = s.entries.map(e => e.playerId), ids = s.entries.map(e => e.id);
  if (!unique(players) || !unique(s.participantIds) || s.participantIds.some(id => !players.includes(id)) || !unique(ids) || !unique(owners) || !unique(s.eligibleEntryIds) || !unique(s.revealOrder) || !unique(s.unavailableEntryIds) || !unique(s.ballots.map(b => b.playerId))) return false;
  if (s.updatedAt < s.createdAt || s.phaseStartedAt > s.updatedAt || s.pausedAt !== undefined && (s.pausedAt > s.updatedAt || !s.deadline) || s.deadline && s.deadline < s.phaseStartedAt) return false;
  if (s.phase === "configure" ? s.participantIds.length > 0 : s.phase !== "closed" && s.participantIds.length !== s.players.length) return false;
  if (s.entries.some(e => !s.participantIds.includes(e.playerId) || e.practice !== Boolean(s.players.find(p => p.id === e.playerId)?.bot) || e.practice === Boolean(e.assetId) || e.submittedAt > s.updatedAt || e.bounds.x + e.bounds.width > 1.000001 || e.bounds.y + e.bounds.height > 1.000001)) return false;
  if (s.unavailableEntryIds.length > 0 && !s.readinessChecked) return false;
  if (s.unavailableEntryIds.some(id => !ids.includes(id)) || s.eligibleEntryIds.some(id => !ids.includes(id) || s.unavailableEntryIds.includes(id)) || s.revealOrder.length !== s.eligibleEntryIds.length || s.revealOrder.some(id => !s.eligibleEntryIds.includes(id))) return false;
  if ((s.eligibleEntryIds.length > 0 || ["reveal", "voting", "cinematic", "champion", "artists", "aquarium"].includes(s.phase)) && !s.readinessChecked) return false;
  if (s.ballots.some(b => !voterIds(s).includes(b.playerId) || b.lockedAt > s.updatedAt || !unique(b.ranking) || b.ranking.length > rankLimit(s) || b.ranking.some(id => !s.eligibleEntryIds.includes(id) || s.entries.find(e => e.id === id)?.playerId === b.playerId))) return false;
  if (s.result) {
    const r = s.result, selections = s.ballots.reduce((sum, b) => sum + b.ranking.length, 0), n = s.eligibleEntryIds.length;
    if (r.lockedAt > s.updatedAt || r.receivedBallots !== s.ballots.length || r.expectedBallots !== (n >= 3 ? n : 0) || r.selections !== selections) return false;
    if (r.kind === "voted" ? n < 3 || !selections || JSON.stringify(r.ranking) !== JSON.stringify(rows(s)) : r.kind === "lucky" ? n !== 2 || JSON.stringify(r.ranking) !== JSON.stringify(luckyRows(s)) : r.ranking.length > 0 || Boolean(r.championEntryId)) return false;
    if ((r.kind === "voted" || r.kind === "lucky") && r.championEntryId !== r.ranking[0]?.entryId) return false;
    if (r.kind === "solo" && n !== 1 || r.kind === "showcase" && (n !== 2 || !s.showcaseOnly) || r.kind === "no-votes" && (n < 3 || selections > 0)) return false;
    if (["solo", "showcase", "no-votes"].includes(r.kind) && s.mode !== "peaceful") return false;
  } else if (["cinematic", "champion", "artists", "aquarium"].includes(s.phase)) return false;
  return true;
}
