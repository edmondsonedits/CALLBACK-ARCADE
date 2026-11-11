import { FishFinaleStateSchema } from "../../lib/arcade/fish-finale";
import { fishFinaleSnapshot, isValidFishFinale } from "./fish_finale";
import { z } from "zod";
import { showdownRounds, replayShowdown, ShowdownStateSchema, createShowdown, validShowdown, showdownScoreEvents, showdownSubmittedCount, canAdvanceShowdown, advanceShowdown, showdownSnapshot, canViewShowdownAsset } from "./sketch_showdown";
import { SKETCH_CURSES, SKETCH_RELAY_TIMERS, SketchRelayLegSchema, SketchRelayPhaseSchema, type SketchRelayLeg, type SketchRelayPhase, type SketchRelaySnapshotChain, type SketchRelayTransformPayload, type SketchRelayUploadReceipt, type SnapshotSketchRelay } from "../../lib/arcade/sketch-relay";
import { deterministicShuffle, stableHash } from "../../lib/game/random";
import type { DbEffect, RoomState, ScoreEventState } from "../types";

export const SKETCH_RELAY_ROUNDS = 3;
export { SKETCH_RELAY_TIMERS } from "../../lib/arcade/sketch-relay";
const PROMPTS = ["A penguin carrying a birthday cake", "A dragon riding a bicycle", "A cat inside a teacup", "A pirate watering a cactus", "A frog wearing a crown", "A robot walking a tiny dog", "A giraffe eating spaghetti", "A wizard stuck in an umbrella", "A duck driving a tractor", "A bear on roller skates", "A shark blowing bubbles", "An octopus playing drums", "A rabbit on the moon", "A fox flying a kite", "A snail carrying a castle", "A turtle in a racing car", "A ghost making pancakes", "A dinosaur holding a balloon", "A squirrel sailing a walnut boat", "A sheep wearing sunglasses", "A lion reading a newspaper", "A mouse lifting a huge cheese", "A whale with a tiny hat", "A chicken juggling oranges", "A raccoon camping in a boot", "A dog painting a rainbow", "An owl eating ice cream", "A crab carrying a suitcase", "A horse riding a skateboard", "A flamingo brushing its teeth"];
const id = z.string().min(1).max(200);
const imageSchema = z.object({ status: z.enum(["QUEUED", "READY", "FALLBACK", "MISSING"]), assetId: id.optional(), jobId: id.optional() }).strict();
const sourceSchema = z.object({ assetId: id, width: z.number().int().min(1).max(512), height: z.number().int().min(1).max(512), byteSize: z.number().int().min(1).max(450_000), contentType: z.literal("image/png"), objectKey: z.string().min(1).max(500) }).strict().refine(s => s.width === s.height, "Sketches must be square");
const legSchema = z.object({ playerId: id, assetId: id.optional(), source: sourceSchema.optional(), practice: z.boolean().optional(), submittedAt: z.number().int().nonnegative(), image: imageSchema }).strict();
const chainSchema = z.object({ chainId: id, round: z.number().int().min(1).max(3), originalPlayerId: id, captionPlayerId: id, redrawPlayerId: id, promptChoices: z.array(z.string().min(1).max(240)).length(3), promptIndex: z.number().int().min(0).max(2), restriction: z.enum(SKETCH_CURSES).optional(), drawing: legSchema.optional(), caption: z.string().min(1).max(140).optional(), captionAt: z.number().int().nonnegative().optional(), redraw: legSchema.optional() }).strict();
const applauseSchema = z.object({ voterId: id, chainId: id, leg: SketchRelayLegSchema, playerId: id, round: z.number().int().min(1).max(3) }).strict();
export const SketchRelayMatchSchema = z.object({ matchId: id, fishTest: z.boolean().optional(), fishTestPreviousJoiningLocked: z.boolean().optional(), players: z.array(id).min(3).max(10), timerAccessibility: z.boolean(), botIds: z.array(id).max(10), round: z.number().int().min(1).max(3), phase: SketchRelayPhaseSchema, deadline: z.number().int().nonnegative(), updatedAt: z.number().int().nonnegative(), version: z.number().int().nonnegative(), revealIndex: z.number().int().min(0).max(9), chains: z.array(chainSchema).min(3).max(30), applause: z.array(applauseSchema).max(30), scores: z.record(z.string(), z.number().int().nonnegative()), showdown: ShowdownStateSchema.optional(), finale: FishFinaleStateSchema.optional() }).strict();
export type SketchRelayMatch = z.infer<typeof SketchRelayMatchSchema>;
type Chain = SketchRelayMatch["chains"][number];
type Mutation = { state: SketchRelayMatch; changed: boolean };
const copy = <T,>(value: T): T => structuredClone(value);
const roundChains = (m: SketchRelayMatch) => m.chains.filter(c => c.round === m.round);
function clock(m: SketchRelayMatch, now: number) { if (!Number.isSafeInteger(now) || now < m.updatedAt) throw new Error("INVALID_CLOCK"); }
function touch(m: SketchRelayMatch, now: number) { m.updatedAt = now; m.version += 1; }
function setPhase(m: SketchRelayMatch, phase: SketchRelayPhase, now: number) { m.phase = phase; m.deadline = now + SKETCH_RELAY_TIMERS[phase] * (m.timerAccessibility && ["drawing", "captioning", "redrawing"].includes(phase) ? 1.5 : 1); touch(m, now); }
export function sketchRelayScoreEvents(m: SketchRelayMatch): Array<{ eventKey: string; round: number; playerId: string; points: number; kind: string }> {
  if (m.showdown) return showdownScoreEvents(m);
  const events: ReturnType<typeof sketchRelayScoreEvents> = [];
  for (const c of m.chains) {
    for (const leg of ["drawing", "redraw"] as const) if (c[leg]) events.push({ eventKey: `${m.matchId}:r${c.round}:${c.chainId}:${leg}`, round: c.round, playerId: c[leg]!.playerId, points: 100, kind: `SKETCH_${leg.toUpperCase()}` });
    if (c.caption !== undefined) events.push({ eventKey: `${m.matchId}:r${c.round}:${c.chainId}:caption`, round: c.round, playerId: c.captionPlayerId, points: 100, kind: "SKETCH_CAPTION" });
  }
  for (const a of m.applause) events.push({ eventKey: `${m.matchId}:r${a.round}:applause:${a.voterId}`, round: a.round, playerId: a.playerId, points: 25, kind: "SKETCH_APPLAUSE" });
  return events;
}
function updateScores(m: SketchRelayMatch) { m.scores = Object.fromEntries(m.players.map(p => [p, 0])); for (const e of sketchRelayScoreEvents(m)) m.scores[e.playerId]! += e.points; }
export function isValidSketchRelayMatch(value: unknown): value is SketchRelayMatch {
  const parsed = SketchRelayMatchSchema.safeParse(value); if (!parsed.success) return false; const m = parsed.data;
  if (m.fishTest) {
    if (m.fishTestPreviousJoiningLocked === undefined || !m.showdown || m.showdown.version !== 3 || m.phase !== "prompt-writing" || m.round !== 1 || !m.finale || !isValidFishFinale(m.finale) || m.finale.matchId !== m.matchId || m.finale.players.length !== m.players.length || m.finale.players.some((player, index) => player.id !== m.players[index] || player.bot !== m.botIds.includes(player.id)) || m.players.every(id => m.botIds.includes(id)) || Object.values(m.scores).some(score => score !== 0) || sketchRelayScoreEvents(m).length || m.chains.some(chain => chain.drawing || chain.caption || chain.redraw) || m.showdown.promptSubmissions.length || m.showdown.promptBallots.length || m.showdown.selectedPrompts.length || m.showdown.ballots.length || m.showdown.guesses.length) return false;
    return validShowdown(m);
  }
  if (m.finale && (!isValidFishFinale(m.finale) || m.matchId !== m.finale.matchId || m.phase !== "complete" || m.showdown?.version !== 3)) return false;
  if (m.showdown) return validShowdown(m);
  if (new Set(m.players).size !== m.players.length || new Set(m.botIds).size !== m.botIds.length || m.botIds.some(p => !m.players.includes(p)) || m.chains.length !== m.players.length * 3 || new Set(m.chains.map(c => c.chainId)).size !== m.chains.length || m.revealIndex >= m.players.length) return false;
  for (let r = 1; r <= 3; r++) {
    const cs = m.chains.filter(c => c.round === r); if (cs.length !== m.players.length) return false;
    for (const [i, c] of cs.entries()) {
      if (c.originalPlayerId !== m.players[i] || c.captionPlayerId !== m.players[(i + 1) % m.players.length] || c.redrawPlayerId !== m.players[(i + 2) % m.players.length] || new Set(c.promptChoices).size !== 3) return false;
      for (const leg of ["drawing", "redraw"] as const) { const l = c[leg]; if (l && (l.playerId !== (leg === "drawing" ? c.originalPlayerId : c.redrawPlayerId) || Boolean(l.practice) !== m.botIds.includes(l.playerId) || (!l.practice && (!l.source || l.assetId !== l.source.assetId)) || (l.practice && (l.assetId || l.source || l.image.assetId || l.image.jobId)) || (l.image.status === "FALLBACK" && l.image.assetId !== l.assetId) || (l.image.status === "QUEUED" && !l.image.jobId))) return false; }
      if ((c.caption === undefined) !== (c.captionAt === undefined)) return false;
      if (r > m.round && (c.drawing || c.caption || c.redraw)) return false;
      if (r === m.round && (["drawing", "transforming"].includes(m.phase) && (c.caption !== undefined || c.redraw) || m.phase === "captioning" && c.redraw)) return false;
      if (c.captionAt !== undefined && c.captionAt > m.updatedAt || c.drawing && c.drawing.submittedAt > m.updatedAt || c.redraw && c.redraw.submittedAt > m.updatedAt) return false;
    }
  }
  const applauseKeys = new Set<string>();
  for (const a of m.applause) { const c = m.chains.find(c => c.chainId === a.chainId && c.round === a.round); const key = `${a.round}:${a.voterId}`; if (!c?.[a.leg] || a.round > m.round || a.playerId !== c[a.leg]!.playerId || a.playerId === a.voterId || !m.players.includes(a.voterId) || applauseKeys.has(key)) return false; applauseKeys.add(key); }
  const canonical = copy(m); updateScores(canonical); return Object.keys(m.scores).length === m.players.length && m.players.every(p => m.scores[p] === canonical.scores[p]);
}
function practice(m: SketchRelayMatch, now: number) {
  for (const c of roundChains(m)) {
    if (m.phase === "drawing" && m.botIds.includes(c.originalPlayerId) && !c.drawing) c.drawing = { playerId: c.originalPlayerId, practice: true, submittedAt: now, image: { status: "MISSING" } };
    if (m.phase === "captioning" && m.botIds.includes(c.captionPlayerId) && c.caption === undefined) { c.caption = "A tiny creature carrying a very large hat"; c.captionAt = now; }
    if (m.phase === "redrawing" && m.botIds.includes(c.redrawPlayerId) && !c.redraw) c.redraw = { playerId: c.redrawPlayerId, practice: true, submittedAt: now, image: { status: "MISSING" } };
  }
  updateScores(m);
}
export function createSketchRelayMatch(input: { matchId: string; players: string[]; botIds?: string[]; now: number; seed?: number; timerAccessibility?: boolean; rulesVersion?: 1 | 2 | 3 | 4; sorceryLength?: "quick" | "long" }): SketchRelayMatch {
  if (input.rulesVersion === 2 || input.rulesVersion === 3 || input.rulesVersion === 4) return createShowdown(input);
  if (input.players.length < 3 || input.players.length > 10 || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0) throw new Error("SKETCH_RELAY_NEEDS_THREE");
  const chains = Array.from({ length: 3 }, (_, r) => input.players.map((p, i) => ({ chainId: `${input.matchId}-r${r + 1}-c${i}`, round: r + 1, originalPlayerId: p, captionPlayerId: input.players[(i + 1) % input.players.length]!, redrawPlayerId: input.players[(i + 2) % input.players.length]!, promptChoices: deterministicShuffle(PROMPTS, `${input.seed ?? 0}:${r}:${i}`).slice(0, 3), promptIndex: 0 }))).flat();
  const m: SketchRelayMatch = { matchId: input.matchId, players: [...input.players], botIds: [...(input.botIds ?? [])], timerAccessibility: input.timerAccessibility ?? false, round: 1, phase: "drawing", deadline: input.now + SKETCH_RELAY_TIMERS.drawing * (input.timerAccessibility ? 1.5 : 1), updatedAt: input.now, version: 0, revealIndex: 0, chains, applause: [], scores: {} }; practice(m, input.now); if (!isValidSketchRelayMatch(m)) throw new Error("INVALID_SKETCH_RELAY_STATE"); return m;
}
function bound(m: SketchRelayMatch, input: { matchId: string; round: number; chainId: string }, now: number): Chain { clock(m, now); if (input.matchId !== m.matchId || input.round !== m.round) throw new Error("STALE_SKETCH_RELAY_ASSIGNMENT"); const c = roundChains(m).find(c => c.chainId === input.chainId); if (!c) throw new Error("STALE_SKETCH_RELAY_ASSIGNMENT"); return c; }
export function selectSketchPrompt(m: SketchRelayMatch, playerId: string, input: { matchId: string; round: number; chainId: string; promptIndex: number }, now: number): Mutation {
  if (m.showdown) throw new Error("WRONG_PHASE");
  const c = bound(m, input, now); if (m.phase !== "drawing" || now >= m.deadline) throw new Error("ROUND_CLOSED"); if (c.originalPlayerId !== playerId) throw new Error("UNAUTHORIZED"); if (!Number.isInteger(input.promptIndex) || input.promptIndex < 0 || input.promptIndex > 2) throw new Error("INVALID_PROMPT"); if (c.drawing) throw new Error("ALREADY_SUBMITTED"); if (c.promptIndex === input.promptIndex) return { state: m, changed: false }; const next = copy(m); next.chains.find(x => x.chainId === c.chainId)!.promptIndex = input.promptIndex; touch(next, now); return { state: next, changed: true };
}
export function submitSketchCaption(m: SketchRelayMatch, playerId: string, input: { matchId: string; round: number; chainId: string; caption: string }, now: number): Mutation {
  if (m.showdown) throw new Error("WRONG_PHASE");
  const c = bound(m, input, now); if (m.phase !== "captioning" || now >= m.deadline) throw new Error("ROUND_CLOSED"); if (c.captionPlayerId !== playerId) throw new Error("UNAUTHORIZED"); const caption = input.caption.trim(); if (!caption || caption.length > 140) throw new Error("INVALID_CAPTION"); if (c.caption !== undefined) { if (c.caption === caption) return { state: m, changed: false }; throw new Error("ALREADY_SUBMITTED"); } const next = copy(m); const chain = next.chains.find(x => x.chainId === c.chainId)!; chain.caption = caption; chain.captionAt = now; touch(next, now); updateScores(next); return { state: next, changed: true };
}
function revealed(m: SketchRelayMatch, c: Chain) { return c.round < m.round || m.phase === "complete" || (c.round === m.round && (m.phase === "round-results" || (m.phase === "revealing" && roundChains(m).indexOf(c) <= m.revealIndex))); }
export function applauseOptions(m: SketchRelayMatch, playerId: string) { return m.chains.filter(c => c.round === m.round && revealed(m, c)).flatMap(c => (["drawing", "redraw"] as const).filter(l => c[l] && c[l]!.playerId !== playerId).map(l => ({ chainId: c.chainId, playerId: c[l]!.playerId, leg: l }))); }
export function submitSketchApplause(m: SketchRelayMatch, playerId: string, input: { matchId: string; round: number; chainId: string; leg: SketchRelayLeg }, now: number): Mutation {
  if (m.showdown) throw new Error("WRONG_PHASE");
  const c = bound(m, input, now); if (!["revealing", "round-results"].includes(m.phase)) throw new Error("ROUND_CLOSED"); if (!m.players.includes(playerId)) throw new Error("UNAUTHORIZED"); const prior = m.applause.find(a => a.round === m.round && a.voterId === playerId); if (prior) { if (prior.chainId === input.chainId && prior.leg === input.leg) return { state: m, changed: false }; throw new Error("ALREADY_APPLAUDED"); } if (!revealed(m, c) || !c[input.leg] || c[input.leg]!.playerId === playerId) throw new Error("INVALID_APPLAUSE"); const next = copy(m); next.applause.push({ voterId: playerId, chainId: c.chainId, leg: input.leg, playerId: c[input.leg]!.playerId, round: m.round }); updateScores(next); touch(next, now); return { state: next, changed: true };
}
export function sketchRelaySubmittedCount(m: SketchRelayMatch) { if (m.showdown) return showdownSubmittedCount(m); return roundChains(m).filter(c => m.phase === "drawing" ? c.drawing : m.phase === "captioning" ? c.caption !== undefined : m.phase === "redrawing" ? c.redraw : m.phase === "transforming" ? !c.drawing || c.drawing.image.status !== "QUEUED" : m.phase === "transforming-redraw" ? !c.redraw || c.redraw.image.status !== "QUEUED" : true).length; }
export function canAdvanceSketchRelay(m: SketchRelayMatch, now: number) { if (m.fishTest) return false; if (m.showdown) return canAdvanceShowdown(m, now); return m.phase !== "complete" && (now >= m.deadline || sketchRelaySubmittedCount(m) === m.players.length && !["revealing", "round-results"].includes(m.phase)); }
function freezeImages(m: SketchRelayMatch, leg: SketchRelayLeg) { for (const c of roundChains(m)) { const l = c[leg]; if (l?.image.status === "QUEUED") l.image = { ...l.image, status: "FALLBACK", assetId: l.assetId }; } }
export function replaySketchRelayReveal(m: SketchRelayMatch, now: number): SketchRelayMatch { if (m.showdown) return replayShowdown(m, now); clock(m, now); if (m.phase !== "revealing") throw new Error("ROUND_CLOSED"); const next = copy(m); setPhase(next, "revealing", now); return next; }
export function advanceSketchRelay(m: SketchRelayMatch, now: number, host = false): Mutation {
  if (m.fishTest) throw new Error("FISH_TEST_ACTIVE");
  if (m.showdown) return advanceShowdown(m, now, host);
  clock(m, now); if (m.phase === "complete") throw new Error("ROUND_CLOSED"); if (!canAdvanceSketchRelay(m, now) && !(host && ["revealing", "round-results"].includes(m.phase))) throw new Error("TOO_EARLY"); const next = copy(m);
  switch (m.phase) {
    case "drawing": setPhase(next, "transforming", now); break;
    case "transforming": freezeImages(next, "drawing"); setPhase(next, "captioning", now); break;
    case "captioning": setPhase(next, "redrawing", now); break;
    case "redrawing": setPhase(next, "transforming-redraw", now); break;
    case "transforming-redraw": freezeImages(next, "redraw"); next.revealIndex = 0; setPhase(next, "revealing", now); break;
    case "revealing": if (m.revealIndex + 1 < m.players.length) { next.revealIndex++; setPhase(next, "revealing", now); } else setPhase(next, "round-results", now); break;
    case "round-results": if (m.round === 3) setPhase(next, "complete", now); else { next.round++; next.revealIndex = 0; setPhase(next, "drawing", now); } break;
  }
  practice(next, now); return { state: next, changed: true };
}
function publicChain(c: Chain): SketchRelaySnapshotChain { const leg = (l: Chain["drawing"]) => l ? { playerId: l.playerId, ...(l.assetId ? { assetId: l.assetId } : {}), ...(l.practice ? { practice: true } : {}), image: copy(l.image) } : undefined; return { chainId: c.chainId, round: c.round, prompt: c.promptChoices[c.promptIndex]!, originalPlayerId: c.originalPlayerId, captionPlayerId: c.captionPlayerId, redrawPlayerId: c.redrawPlayerId, drawing: leg(c.drawing), caption: c.caption, redraw: leg(c.redraw) }; }
export function sketchRelaySnapshot(m: SketchRelayMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }, now=m.updatedAt): SnapshotSketchRelay {
  if (m.showdown) { const out = showdownSnapshot(m, viewer, now); if (m.fishTest) out.fishTest = true; if (m.finale) out.finale = fishFinaleSnapshot(m.finale, viewer.role === "player" ? viewer.playerId : undefined, viewer.role === "host", Date.now(), Boolean(m.fishTest)); return out; }
  const isPlayer = viewer.role === "player" && m.players.includes(viewer.playerId); const playerId = isPlayer && viewer.role === "player" ? viewer.playerId : "";
  const out: SnapshotSketchRelay = { matchId: m.matchId, round: m.round, totalRounds: 3, phase: m.phase, deadline: m.deadline, players: [...m.players], totalPlayers: m.players.length, submittedCount: sketchRelaySubmittedCount(m), scores: { ...m.scores }, revealIndex: m.revealIndex, revealTotal: m.players.length, applauseOptions: isPlayer ? applauseOptions(m, playerId) : [], applauded: isPlayer && m.applause.some(a => a.round === m.round && a.voterId === playerId) };
  const cs = roundChains(m);
  if (m.phase === "revealing") out.reveal = publicChain(cs[m.revealIndex]!);
  if (m.phase === "round-results") out.chains = cs.map(publicChain);
  if (m.phase === "complete") out.chains = m.chains.map(publicChain);
  if (isPlayer) {
    const c = cs.find(c => m.phase === "captioning" ? c.captionPlayerId === playerId : ["redrawing", "transforming-redraw"].includes(m.phase) ? c.redrawPlayerId === playerId : c.originalPlayerId === playerId)!;
    if (m.phase === "drawing" || m.phase === "transforming") out.self = { chainId: c.chainId, submitted: Boolean(c.drawing), promptChoices: m.phase === "drawing" ? [...c.promptChoices] : undefined, prompt: c.promptChoices[c.promptIndex], practice: m.botIds.includes(playerId) };
    if (m.phase === "captioning") out.self = { chainId: c.chainId, submitted: c.caption !== undefined, sourceImage: c.drawing ? copy(c.drawing.image) : { status: "MISSING" }, caption: c.caption, practice: Boolean(c.drawing?.practice) };
    if (m.phase === "redrawing" || m.phase === "transforming-redraw") out.self = { chainId: c.chainId, submitted: Boolean(c.redraw), caption: c.caption ?? "A mysterious doodle", practice: m.botIds.includes(playerId) };
  }
  return out;
}

export function syncSketchRelayRoom(next: RoomState, effects: DbEffect[], now: number): void {
  const m = next.sketchRelay; if (!m || !next.arcadeMatch) throw new Error("ARCADE_LIFECYCLE_REQUIRED"); next.deadlineAt = m.phase === "complete" ? null : m.deadline;
  for (const e of sketchRelayScoreEvents(m)) { if (next.scoreEvents.some(s => s.eventKey === e.eventKey)) continue; const event: ScoreEventState = { id: `score-${e.eventKey}`, eventKey: e.eventKey, roundId: `${m.matchId}-r${e.round}`, playerId: e.playerId, kind: e.kind, points: e.points, detail: { matchId: m.matchId } }; next.scoreEvents.push(event); effects.push({ type: "score", event }); }
  if (m.phase === "complete" && next.arcadeMatch.status === "ACTIVE") { const result = { matchId: m.matchId, scores: { ...m.scores }, winners: m.players.filter(p => m.scores[p] === Math.max(...Object.values(m.scores))), roundsPlayed: m.showdown ? showdownRounds(m) : 3 }; next.phase = "ARCADE_RESULTS"; next.phaseStartedAt = now; next.status = "COMPLETE"; next.arcadeMatch = { ...next.arcadeMatch, status: "COMPLETE", endedAt: now, result }; effects.push({ type: "arcade_finalize", match: next.arcadeMatch, event: { eventId: `${m.matchId}:sketch-relay:complete`, matchId: m.matchId, type: "result", playerId: null, points: 0, occurredAt: now, payload: result } }); }
}
function uploadContext(room: RoomState, playerId: string, input: { matchId: string; round: number; chainId: string; leg: SketchRelayLeg; promptIndex?: number }, now: number) {
  if (room.gameLength !== "arcade" || room.arcadeGameId !== "sketch-relay" || room.phase !== "ARCADE_ACTIVE" || !room.sketchRelay || room.arcadeMatch?.id !== input.matchId || room.arcadeMatch.status !== "ACTIVE") throw new Error("ARCADE_LIFECYCLE_REQUIRED"); if (room.paused) throw new Error("GAME_PAUSED"); const p = room.participants.find(p => p.id === playerId && p.active && p.role === "player" && !p.bot && !p.removedAt); if (!p) throw new Error("UNAUTHORIZED"); const m = room.sketchRelay; if(m.phase === "drawing" && m.showdown?.workshop?.closedRound === m.round) throw new Error("ROUND_CLOSED"); if (m.showdown && (input.leg !== "drawing" || input.promptIndex !== 0)) throw new Error("INVALID_PROMPT"); const c = bound(m, input, now); if (m.phase !== (input.leg === "drawing" ? "drawing" : "redrawing") || now >= m.deadline) throw new Error("ROUND_CLOSED"); if ((input.leg === "drawing" ? c.originalPlayerId : c.redrawPlayerId) !== playerId) throw new Error("UNAUTHORIZED"); if (input.leg === "drawing" && input.promptIndex === undefined) throw new Error("PROMPT_REQUIRED"); if (input.promptIndex !== undefined && (input.leg !== "drawing" || !Number.isInteger(input.promptIndex) || input.promptIndex < 0 || input.promptIndex > 2)) throw new Error("INVALID_PROMPT"); return { m, c };
}
export function validateSketchRelayUpload(room: RoomState, playerId: string, input: { matchId: string; round: number; chainId: string; leg: SketchRelayLeg; promptIndex?: number }, now: number): void { const { c } = uploadContext(room, playerId, input, now); if (c[input.leg]) throw new Error("ALREADY_SUBMITTED"); }
export function applySketchRelayUpload(room: RoomState, playerId: string, receipt: SketchRelayUploadReceipt, now: number): { next: RoomState; effects: DbEffect[] } {
  const { c } = uploadContext(room, playerId, receipt, now); const existing = c[receipt.leg]; if (existing) { if (existing.assetId === receipt.assetId) return { next: room, effects: [] }; throw new Error("ALREADY_SUBMITTED"); } const source = sourceSchema.parse({ assetId: receipt.assetId, width: receipt.width, height: receipt.height, byteSize: receipt.byteSize, contentType: receipt.contentType, objectKey: receipt.objectKey });
  const next = copy(room); const m = next.sketchRelay!; const chain = m.chains.find(c => c.chainId === receipt.chainId)!; if (receipt.promptIndex !== undefined) chain.promptIndex = receipt.promptIndex; const jobId = `sketch-transform-${receipt.assetId}`; chain[receipt.leg] = { playerId, assetId: receipt.assetId, source, submittedAt: now, image: { status: "QUEUED", jobId } }; touch(m, now); updateScores(m);
  const payload: SketchRelayTransformPayload = { kind: "SKETCH_TRANSFORM", matchId: m.matchId, round: m.round, chainId: chain.chainId, leg: receipt.leg, sourceAssetId: receipt.assetId, jobId, ...(m.showdown ? { prompt: chain.promptChoices[chain.promptIndex] } : {}) };
  const effects: DbEffect[] = [{ type: "sketch_source", id: receipt.assetId, roundId: `${m.matchId}-r${m.round}`, promptHash: String(stableHash(receipt.assetId)), prompt: { ...receipt, playerId }, objectKey: receipt.objectKey, byteSize: receipt.byteSize, now }, { type: "job", id: jobId, roundId: `${m.matchId}-r${m.round}`, kind: "SKETCH_TRANSFORM", promptHash: String(stableHash(JSON.stringify(payload))), prompt: payload, now }]; syncSketchRelayRoom(next, effects, now); return { next, effects };
}
export function isCurrentSketchRelayJob(room: RoomState, input: SketchRelayTransformPayload, now?: number): boolean { const m = room.sketchRelay; if (!m || (now !== undefined && !room.paused && now >= m.deadline && ["transforming", "transforming-redraw"].includes(m.phase)) || room.arcadeMatch?.id !== input.matchId || room.arcadeMatch.status !== "ACTIVE" || room.arcadeGameId !== "sketch-relay" || room.phase !== "ARCADE_ACTIVE" || m.round !== input.round) return false; const c = m.chains.find(c => c.chainId === input.chainId && c.round === input.round); const l = c?.[input.leg]; return Boolean(l && !l.practice && l.assetId === input.sourceAssetId && l.image.jobId === input.jobId && l.image.status === "QUEUED" && (input.leg === "drawing" ? ["drawing", "transforming"].includes(m.phase) : ["redrawing", "transforming-redraw"].includes(m.phase))); }
export function applySketchRelayImageResult(room: RoomState, input: Omit<SketchRelayTransformPayload, "kind"> & { status: "READY" | "FALLBACK"; assetId?: string }, now: number): { next: RoomState; effects: DbEffect[] } {
  if (!isCurrentSketchRelayJob(room, { ...input, kind: "SKETCH_TRANSFORM" }, now)) return { next: room, effects: [] }; clock(room.sketchRelay!, now); if (input.status === "READY" && !input.assetId) throw new Error("INVALID_IMAGE_RESULT"); const next = copy(room); const l = next.sketchRelay!.chains.find(c => c.chainId === input.chainId)![input.leg]!; l.image = { status: input.status, assetId: input.status === "FALLBACK" ? input.sourceAssetId : input.assetId, jobId: input.jobId }; touch(next.sketchRelay!, now); return { next, effects: [] };
}
export function canViewSketchRelayAsset(room: RoomState, viewerId: string | null, assetId: string): boolean { const m = room.sketchRelay; if (m?.showdown) return canViewShowdownAsset(m, viewerId, assetId); if (!m || room.arcadeGameId !== "sketch-relay") return false; for (const c of m.chains) for (const leg of ["drawing", "redraw"] as const) { const l = c[leg]; if (!l || (l.assetId !== assetId && l.image.assetId !== assetId)) continue; if (m.phase === "complete" || c.round === m.round && (m.phase === "round-results" || m.phase === "revealing" && roundChains(m).indexOf(c) === m.revealIndex)) return true; if (viewerId === l.playerId && c.round === m.round) return true; if (leg === "drawing" && c.round === m.round && m.phase === "captioning" && viewerId === c.captionPlayerId && l.image.assetId === assetId) return true; } return false; }
