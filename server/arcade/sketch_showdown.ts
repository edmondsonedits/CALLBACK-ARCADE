import {SorceryWorkshopSchema,emptyWorkshop} from "../../lib/sorcery-workshop";
import {beginWorkshopClose,workshopSnapshot} from "../sorcery/workshop";
import { SKETCH_PROMPT_CATALOGUE } from "../../lib/content/sketch-prompts";
import { z } from "zod";
import { SHOWDOWN_TIMERS, SKETCH_EMOTES, SKETCH_CURSES, SKETCH_STARTERS, SKETCH_MODIFIERS, PrepareSketchFinalSchema, type SketchRelayPhase, type SnapshotSketchRelay, type ShowdownEntry } from "../../lib/arcade/sketch-relay";
import { deterministicShuffle, randomUuid, stableHash } from "../../lib/game/random";
import type { SketchRelayMatch } from "./sketch_relay";
export { SHOWDOWN_TIMERS } from "../../lib/arcade/sketch-relay";

const id = z.string().min(1).max(200);
const option = z.object({ id, text: z.string().min(3).max(140), original: z.boolean(), authorId: id.nullable() }).strict();
const ballot = z.object({ playerId: id, round: z.number().int().min(1).max(3), ranking: z.array(id).max(3) }).strict();
const guess = z.object({ playerId: id, round: z.number().int().min(1).max(3), guesses: z.array(z.object({ entryId: id, playerId: id }).strict()).max(3) }).strict();
export const ShowdownStateSchema = z.object({
  version: z.union([z.literal(2), z.literal(3), z.literal(4)]), sorceryLength: z.enum(["quick", "long"]).optional(), workshop: SorceryWorkshopSchema.optional(), promptWeights:z.record(z.string(),z.number().min(.5).max(2)).optional(), shuffleSeed: id.optional(), phaseStartedAt: z.number().int().nonnegative(), phaseDuration: z.number().int().nonnegative(),
  promptSubmissions: z.array(option).max(10), promptOptions: z.array(option).max(20), promptBallots: z.array(ballot).max(10),
  selectedPrompts: z.array(z.string().min(3).max(140)).max(3), ballots: z.array(ballot).max(30), guesses: z.array(guess).max(30),
  orders: z.array(z.array(id).max(10)).min(2).max(3), revealOrder: z.array(id).max(10), fallbackRounds: z.array(z.number().int().min(1).max(3)).max(3),
  curse: z.object({ chooserId: id, options: z.array(z.enum(SKETCH_CURSES)).length(3), selected: z.enum(SKETCH_CURSES).optional() }).strict().optional(),
  finalChoices: z.array(z.object({ playerId: id, modifier: PrepareSketchFinalSchema.shape.modifier, starter: z.enum(SKETCH_STARTERS) }).strict()).max(10).optional(),
  emote: z.object({ name: z.enum(SKETCH_EMOTES), playerId: id, entryId: id, expiresAt: z.number().int().nonnegative(), sequence: z.number().int().positive(), sentAt: z.number().int().nonnegative() }).strict().nullable(),
}).strict();

export const SHOWDOWN_EXAMPLES = SKETCH_PROMPT_CATALOGUE.map(({ id, text }) => ({ id, text, original: false, authorId: null }));

const clone = <T,>(m: T): T => structuredClone(m);
const chains = (m: SketchRelayMatch, round = m.round) => m.chains.filter(c => c.round === round);
const s = (m: SketchRelayMatch) => { if (!m.showdown) throw new Error("SHOWDOWN_REQUIRED"); return m.showdown; };
export const showdownRounds = (m: SketchRelayMatch): 2 | 3 => s(m).version >= 3 && !(s(m).version === 4 && s(m).sorceryLength === "quick") ? 3 : 2;
const multiplier = (m: SketchRelayMatch, round = m.round) => s(m).version >= 3 ? round : 1;
function featuredExamples(m:SketchRelayMatch){
 const d=s(m);if(d.version!==4||!d.promptWeights)return deterministicShuffle(SHOWDOWN_EXAMPLES,d.shuffleSeed+':examples');
 return [...SHOWDOWN_EXAMPLES].sort((a,b)=>{const key=(id:string)=>-Math.log((stableHash(d.shuffleSeed+':'+id)+1)/4294967297)/(d.promptWeights?.[id]??1);return key(a.id)-key(b.id);});
}
function finalChoice(m: SketchRelayMatch, playerId: string, modifier: typeof SKETCH_MODIFIERS[number]["id"], starter: typeof SKETCH_STARTERS[number]) {
  const d = s(m), c = chains(m, 3).find(c => c.originalPlayerId === playerId)!;
  (d.finalChoices ??= []).push({ playerId, modifier, starter });
  c.promptChoices[0] = `${d.selectedPrompts[2]} — ${SKETCH_MODIFIERS.find(v => v.id === modifier)!.suffix}`;
}
function defaultFinal(m: SketchRelayMatch, playerId: string) {
  const seed = `${s(m).shuffleSeed}:${playerId}:final`;
  finalChoice(m, playerId, deterministicShuffle(SKETCH_MODIFIERS, seed)[0]!.id, deterministicShuffle(SKETCH_STARTERS, seed)[0]!);
}
function touch(m: SketchRelayMatch, now: number) { if (!Number.isSafeInteger(now) || now < m.updatedAt) throw new Error("INVALID_CLOCK"); m.updatedAt = now; m.version++; }
function phase(m: SketchRelayMatch, value: SketchRelayPhase, now: number) {
  m.phase = value; const quick = s(m).version === 4 && s(m).sorceryLength === "quick";
  const duration = value === "drawing" && quick ? 120_000 : value === "revealing" && quick ? 12_000 : value === "showcase" ? Math.max(1, s(m).orders[m.round - 1]!.length) * (quick ? 6_000 : SHOWDOWN_TIMERS.showcase) : SHOWDOWN_TIMERS[value];
  s(m).phaseStartedAt = now; s(m).phaseDuration = Math.round(duration * (m.timerAccessibility && ["prompt-writing", "prompt-voting", "drawing", "laughter-voting", "artist-guessing", "curse-selection", "final-preparation"].includes(value) ? 1.5 : 1));
  m.deadline = now + s(m).phaseDuration; s(m).emote = null; touch(m, now);
}
export function createShowdown(input: { matchId: string; players: string[]; botIds?: string[]; now: number; timerAccessibility?: boolean; rulesVersion?: 1 | 2 | 3 | 4; sorceryLength?: "quick" | "long" }): SketchRelayMatch {
  if (input.players.length < 3 || input.players.length > 10 || new Set(input.players).size !== input.players.length || (input.botIds ?? []).some(p => !input.players.includes(p))) throw new Error("SKETCH_RELAY_NEEDS_THREE");
  const version = input.rulesVersion === 4 ? 4 : input.rulesVersion === 2 ? 2 : 3;
  const rounds = version >= 3 && !(version === 4 && input.sorceryLength === "quick") ? [1, 2, 3] : [1, 2];
  const m: SketchRelayMatch = { matchId: input.matchId, players: [...input.players], botIds: [...(input.botIds ?? [])], timerAccessibility: input.timerAccessibility ?? false, round: 1, phase: "prompt-writing", deadline: input.now, updatedAt: input.now, version: 0, revealIndex: 0, chains: rounds.flatMap(round => input.players.map(p => ({ chainId: randomUuid(), round, originalPlayerId: p, captionPlayerId: p, redrawPlayerId: p, promptChoices: SHOWDOWN_EXAMPLES.slice(0, 3).map(p => p.text), promptIndex: 0 }))), applause: [], scores: Object.fromEntries(input.players.map(p => [p, 0])), showdown: { version, ...(version === 4 ? { sorceryLength: input.sorceryLength ?? "long", workshop:emptyWorkshop() } : {}), shuffleSeed: randomUuid(), phaseStartedAt: input.now, phaseDuration: 0, promptSubmissions: [], promptOptions: [], promptBallots: [], selectedPrompts: [], ballots: [], guesses: [], orders: rounds.map(() => []), revealOrder: [], fallbackRounds: [], emote: null } };
  phase(m, "prompt-writing", input.now); practice(m, input.now); return m;
}
function voter<T extends { playerId: string; round: number }>(items: T[], m: SketchRelayMatch, playerId: string) { return items.find(b => b.playerId === playerId && b.round === m.round); }
export function showdownSubmitted(m: SketchRelayMatch, playerId: string): boolean {
  const d = s(m);
  switch (m.phase) {
    case "prompt-writing": return d.promptSubmissions.some(p => p.authorId === playerId);
    case "prompt-voting": return d.promptBallots.some(b => b.playerId === playerId);
    case "curse-selection": return playerId !== d.curse?.chooserId || Boolean(d.curse.selected);
    case "final-preparation": return Boolean(d.finalChoices?.some(c => c.playerId === playerId));
    case "drawing": return Boolean(chains(m).find(c => c.originalPlayerId === playerId)?.drawing);
    case "transforming": { const c = chains(m).find(c => c.originalPlayerId === playerId); return !c?.drawing || c.drawing.image.status !== "QUEUED"; }
    case "laughter-voting": return Boolean(voter(d.ballots, m, playerId));
    case "artist-guessing": return Boolean(voter(d.guesses, m, playerId));
    default: return true;
  }
}
export function showdownSubmittedCount(m: SketchRelayMatch) { return m.players.filter(p => showdownSubmitted(m, p)).length; }
export function canAdvanceShowdown(m: SketchRelayMatch, now: number) { if(m.phase==="drawing"&&s(m).workshop?.closeUntil&&now<s(m).workshop!.closeUntil!)return false; return m.phase !== "complete" && (now >= m.deadline || ["prompt-writing", "prompt-voting", "drawing", "transforming", "laughter-voting", "artist-guessing", "curse-selection", "final-preparation"].includes(m.phase) && showdownSubmittedCount(m) === m.players.length); }
export function replayShowdown(m: SketchRelayMatch, now: number) { if (m.phase !== "revealing") throw new Error("ROUND_CLOSED"); const n = clone(m); phase(n, "revealing", now); return n; }
export function laughterPoints(m: SketchRelayMatch, entryId: string): number { return s(m).ballots.filter(b => b.round === m.round).reduce((n, b) => { const rank = b.ranking.indexOf(entryId); return n + (rank < 0 ? 0 : [100, 75, 50][rank]!); }, 0); }
function disclosed(m: SketchRelayMatch, entryId: string) { const c = m.chains.find(c => c.chainId === entryId); return Boolean(c && (m.phase === "complete" || c.round < m.round || c.round === m.round && (m.phase === "round-results" || m.phase === "halfway" || m.phase === "revealing" && s(m).revealOrder.indexOf(entryId) >= 0 && s(m).revealOrder.indexOf(entryId) <= m.revealIndex))); }
export function showdownScoreEvents(m: SketchRelayMatch) {
  const events: Array<{ eventKey: string; round: number; playerId: string; points: number; kind: string }> = [];
  for (const b of s(m).ballots) for (const [rank, entryId] of b.ranking.entries()) {
    if (!disclosed(m, entryId)) continue; const c = m.chains.find(c => c.chainId === entryId)!;
    events.push({ eventKey: `${m.matchId}:r${b.round}:laughter:${b.playerId}:${rank}`, round: b.round, playerId: c.originalPlayerId, points: [100, 75, 50][rank]! * multiplier(m, b.round), kind: "SKETCH_LAUGHTER" });
    const g = s(m).guesses.find(g => g.round === b.round && g.playerId === b.playerId)?.guesses.find(g => g.entryId === entryId);
    if (g?.playerId === c.originalPlayerId) events.push({ eventKey: `${m.matchId}:r${b.round}:guess:${b.playerId}:${entryId}`, round: b.round, playerId: b.playerId, points: 50 * multiplier(m, b.round), kind: "SKETCH_ARTIST_GUESS" });
  }
  for(const [i,b] of (s(m).workshop?.ballots??[]).entries())if(b.acceptedAt!==undefined&&b.reward)events.push({eventKey:`${m.matchId}:workshop:${b.actor}:${i}`,round:b.round,playerId:b.actor,points:b.reward,kind:"SKETCH_WORKSHOP"});
  return events;
}
function scores(m: SketchRelayMatch) { m.scores = Object.fromEntries(m.players.map(p => [p, 0])); for (const e of showdownScoreEvents(m)) m.scores[e.playerId]! += e.points; }
function practice(m: SketchRelayMatch, now: number) {
  const d = s(m);
  for (const p of m.botIds) {
    if (m.phase === "prompt-writing" && !showdownSubmitted(m, p)) { const ex = SHOWDOWN_EXAMPLES[stableHash(`${m.matchId}:${p}`) % SHOWDOWN_EXAMPLES.length]!; d.promptSubmissions.push({ ...ex, id: randomUuid(), authorId: p }); }
    if (m.phase === "prompt-voting" && !showdownSubmitted(m, p)) d.promptBallots.push({ playerId: p, round: 1, ranking: deterministicShuffle(d.promptOptions.filter(o => o.authorId !== p), `${m.matchId}:${p}:prompts`).slice(0, 3).map(o => o.id) });
    if (m.phase === "curse-selection" && d.curse?.chooserId === p && !d.curse.selected) d.curse.selected = d.curse.options[0]!;
    if (m.phase === "final-preparation" && !showdownSubmitted(m, p)) defaultFinal(m, p);
    if (m.phase === "drawing" && !showdownSubmitted(m, p)) chains(m).find(c => c.originalPlayerId === p)!.drawing = { playerId: p, practice: true, submittedAt: now, image: { status: "MISSING" } };
    if (m.phase === "laughter-voting" && !showdownSubmitted(m, p)) d.ballots.push({ playerId: p, round: m.round, ranking: deterministicShuffle(chains(m).filter(c => c.drawing && c.originalPlayerId !== p), `${m.matchId}:${m.round}:${p}:votes`).slice(0, 3).map(c => c.chainId) });
    if (m.phase === "artist-guessing" && !showdownSubmitted(m, p)) { const names = deterministicShuffle(m.players.filter(id => id !== p), `${m.matchId}:${m.round}:${p}:guesses`); d.guesses.push({ playerId: p, round: m.round, guesses: (voter(d.ballots, m, p)?.ranking ?? []).map((entryId, i) => ({ entryId, playerId: names[i]! })) }); }
  }
}
export function advanceShowdown(m: SketchRelayMatch, now: number, host = false) {
  if (!canAdvanceShowdown(m, now) && !(host && ["showcase", "revealing", "round-results", "halfway"].includes(m.phase))) throw new Error("TOO_EARLY");
  const n = clone(m), d = s(n);
  d.shuffleSeed ??= randomUuid();
  switch (m.phase) {
    case "prompt-writing": {
      const unique = new Map<string, typeof d.promptOptions[number]>();
      for (const p of [...d.promptSubmissions].sort((a, b) => Number(b.original) - Number(a.original))) if (!unique.has(p.text.toLocaleLowerCase())) unique.set(p.text.toLocaleLowerCase(), p);
      for (const p of featuredExamples(n)) { if (unique.size >= Math.max(5, d.promptSubmissions.length)) break; if (!unique.has(p.text.toLocaleLowerCase())) unique.set(p.text.toLocaleLowerCase(), { ...p, id: randomUuid() }); }
      d.promptOptions = deterministicShuffle([...unique.values()], `${d.shuffleSeed}:pool`); phase(n, "prompt-voting", now); break;
    }
    case "prompt-voting": {
      const total = (id: string) => d.promptBallots.reduce((v, b) => { const i = b.ranking.indexOf(id); return v + (i < 0 ? 0 : 3 - i); }, 0);
      d.selectedPrompts = deterministicShuffle(d.promptOptions, `${d.shuffleSeed}:ties`).sort((a, b) => total(b.id) - total(a.id) || Number(b.original) - Number(a.original)).slice(0, showdownRounds(n)).map(p => p.text);
      for (const c of n.chains) { c.promptChoices[0] = d.selectedPrompts[c.round - 1]!; c.promptIndex = 0; }
      phase(n, "drawing", now); break;
    }
    case "curse-selection": d.curse!.selected ??= d.curse!.options[0]!; for (const c of chains(n)) c.restriction = d.curse!.selected; phase(n, "drawing", now); break;
    case "final-preparation": for (const p of n.players) if (!showdownSubmitted(n, p)) defaultFinal(n, p); phase(n, "drawing", now); break;
    case "drawing":
      if(d.version===4){
        if(showdownSubmittedCount(n)===n.players.length&&beginWorkshopClose(n,now)){touch(n,now);break;}
        if(d.workshop?.closeUntil&&now<d.workshop.closeUntil){touch(n,now);break;}
      }
      phase(n, "transforming", now); break;
    case "transforming": {
      const cs = chains(n); const fallback = cs.some(c => c.drawing && !c.drawing.practice && c.drawing.image.status !== "READY");
      if (fallback && !d.fallbackRounds.includes(n.round)) d.fallbackRounds.push(n.round);
      for (const c of cs) if (c.drawing?.image.status === "QUEUED") c.drawing.image = { status: "FALLBACK", assetId: c.drawing.assetId, jobId: c.drawing.image.jobId };
      d.orders[n.round - 1] = deterministicShuffle(cs.filter(c => c.drawing).map(c => c.chainId), `${d.shuffleSeed}:${m.round}:gallery`); phase(n, "showcase", now); break;
    }
    case "showcase": phase(n, "laughter-voting", now); break;
    case "laughter-voting": phase(n, "artist-guessing", now); break;
    case "artist-guessing": d.revealOrder = [...d.orders[n.round - 1]!].sort((a, b) => laughterPoints(n, a) - laughterPoints(n, b)); n.revealIndex = 0; phase(n, d.revealOrder.length ? "revealing" : "round-results", now); break;
    case "revealing": if (n.revealIndex + 1 < d.revealOrder.length) { n.revealIndex++; phase(n, "revealing", now); } else phase(n, "round-results", now); break;
    case "round-results":
      if(d.version===4&&d.workshop&&d.workshop.intermissionRound!==n.round){d.workshop.intermissionRound=n.round;phase(n,"round-results",now);n.deadline=now+30000;d.phaseDuration=30000;break;}
      phase(n, n.round === showdownRounds(n) ? "complete" : "halfway", now); break;
    case "halfway": {
      n.round++; n.revealIndex = 0; d.revealOrder = [];
      if (d.version >= 3 && n.round === 2) {
        const lowest = Math.min(...n.players.map(p => n.scores[p]!));
        const chooserId = deterministicShuffle(n.players.filter(p => n.scores[p] === lowest), `${d.shuffleSeed}:curse-tie`)[0]!;
        d.curse = { chooserId, options: deterministicShuffle(SKETCH_CURSES, `${d.shuffleSeed}:curse-options`).slice(0, 3) };
        phase(n, "curse-selection", now);
      } else if (d.version >= 3 && n.round === 3) { delete d.curse; d.finalChoices = []; phase(n, "final-preparation", now); }
      else phase(n, "drawing", now);
      break;
    }
    default: throw new Error("ROUND_CLOSED");
  }
  practice(n, now); scores(n); return { state: n, changed: true };
}
export function submitShowdownAction(m: SketchRelayMatch, playerId: string, action: { type: string; payload: Record<string, unknown> }, now: number) {
  const p = action.payload;
  if (!m.players.includes(playerId)) throw new Error("UNAUTHORIZED");
  if (p.matchId !== m.matchId || p.round !== m.round) throw new Error("STALE_SKETCH_RELAY_ASSIGNMENT");
  if (now >= m.deadline || m.phase === "complete") throw new Error("ROUND_CLOSED");
  const n = clone(m), d = s(n);
  const requirePhase = (value: SketchRelayPhase) => { if (m.phase !== value) throw new Error("WRONG_PHASE"); if (showdownSubmitted(m, playerId)) throw new Error("ALREADY_SUBMITTED"); };
  const ranking = () => { if (!Array.isArray(p.ranking) || p.ranking.length > 3 || p.ranking.some(id => typeof id !== "string") || new Set(p.ranking).size !== p.ranking.length) throw new Error("INVALID_RANKING"); return p.ranking as string[]; };
  switch (action.type) {
    case "CHOOSE_SKETCH_CURSE": {
      if (m.phase !== "curse-selection") throw new Error("WRONG_PHASE");
      if (d.curse?.chooserId !== playerId) throw new Error("UNAUTHORIZED");
      requirePhase("curse-selection");
      if (!d.curse.options.includes(p.curse as typeof SKETCH_CURSES[number])) throw new Error("INVALID_CHOICE");
      d.curse.selected = p.curse as typeof SKETCH_CURSES[number]; break;
    }
    case "PREPARE_SKETCH_FINAL": {
      requirePhase("final-preparation"); const choice = PrepareSketchFinalSchema.safeParse(p);
      if (!choice.success) throw new Error("INVALID_CHOICE");
      finalChoice(n, playerId, choice.data.modifier, choice.data.starter); break;
    }
    case "SUBMIT_SKETCH_PROMPT": { requirePhase("prompt-writing"); const text = typeof p.prompt === "string" ? p.prompt.trim().replace(/\s+/gu, " ") : ""; if (text.length < 3 || text.length > 140) throw new Error("INVALID_PROMPT"); const ex = SHOWDOWN_EXAMPLES.find(e => e.text.toLocaleLowerCase() === text.toLocaleLowerCase()); d.promptSubmissions.push({ id: randomUuid(), text, original: !ex, authorId: playerId }); break; }
    case "RANK_SKETCH_PROMPTS": { requirePhase("prompt-voting"); const ids = ranking(); if (ids.some(id => !d.promptOptions.some(o => o.id === id))) throw new Error("INVALID_RANKING"); if (ids.some(id => d.promptOptions.find(o => o.id === id)?.authorId === playerId)) throw new Error("SELF_VOTE"); d.promptBallots.push({ playerId, round: 1, ranking: ids }); break; }
    case "RANK_SKETCH_LAUGHTER": { requirePhase("laughter-voting"); const ids = ranking(); if (ids.some(id => !d.orders[n.round - 1]!.includes(id))) throw new Error("INVALID_RANKING"); if (ids.some(id => chains(n).find(c => c.chainId === id)?.originalPlayerId === playerId)) throw new Error("SELF_VOTE"); d.ballots.push({ playerId, round: n.round, ranking: ids }); break; }
    case "GUESS_SKETCH_ARTISTS": { requirePhase("artist-guessing"); const parsed = guess.shape.guesses.safeParse(p.guesses); if (!parsed.success) throw new Error("INVALID_GUESSES"); const allowed = voter(d.ballots, n, playerId)?.ranking ?? []; if (parsed.data.some(g => !allowed.includes(g.entryId) || !n.players.includes(g.playerId) || g.playerId === playerId) || new Set(parsed.data.map(g => g.entryId)).size !== parsed.data.length || new Set(parsed.data.map(g => g.playerId)).size !== parsed.data.length) throw new Error("INVALID_GUESSES"); d.guesses.push({ playerId, round: n.round, guesses: parsed.data }); break; }
    case "SKETCH_REVEAL_EMOTE": { if (m.phase !== "revealing" || p.entryId !== d.revealOrder[m.revealIndex] || chains(m).find(c => c.chainId === p.entryId)?.originalPlayerId !== playerId) throw new Error("UNAUTHORIZED"); if (!SKETCH_EMOTES.includes(p.emote as typeof SKETCH_EMOTES[number])) throw new Error("INVALID_EMOTE"); if (d.emote && now - d.emote.sentAt < 700) throw new Error("TOO_FAST"); d.emote = { name: p.emote as typeof SKETCH_EMOTES[number], playerId, entryId: String(p.entryId), sentAt: now, expiresAt: now + 2600, sequence: (d.emote?.sequence ?? 0) + 1 }; break; }
    default: throw new Error("INVALID_ACTION");
  }
  touch(n, now); return { state: n, changed: true };
}
export function validShowdown(m: SketchRelayMatch) {
  const d = s(m);
  const rounds = showdownRounds(m);
  if (m.round > rounds || new Set(m.players).size !== m.players.length || new Set(m.botIds).size !== m.botIds.length || m.botIds.some(p => !m.players.includes(p)) || m.chains.length !== m.players.length * rounds || new Set(m.chains.map(c => c.chainId)).size !== m.chains.length) return false;
  for (const r of Array.from({ length: rounds }, (_, i) => i + 1)) { const cs = chains(m, r); if (cs.length !== m.players.length || new Set(cs.map(c => c.originalPlayerId)).size !== m.players.length || cs.some(c => !m.players.includes(c.originalPlayerId) || c.round > m.round && c.drawing)) return false; }
  if (d.orders.length !== rounds || d.version === 2 && (d.curse || d.finalChoices || ["curse-selection", "final-preparation"].includes(m.phase))) return false;
  if (d.version >= 3) {
    const roundTwo = chains(m, 2);
    const curseApplied = m.round > 2 || m.round === 2 && m.phase !== "curse-selection";
    if (m.chains.some(c => c.promptIndex !== 0 || c.round !== 2 && c.restriction || c.round === m.round && ["prompt-writing", "prompt-voting", "curse-selection", "final-preparation"].includes(m.phase) && c.drawing)) return false;
    if (curseApplied ? roundTwo.some(c => !c.restriction || c.restriction !== roundTwo[0]!.restriction || m.round === 2 && c.restriction !== d.curse?.selected) : roundTwo.some(c => c.restriction)) return false;
    if (m.phase === "curse-selection" && m.round !== 2 || m.phase === "final-preparation" && m.round !== 3) return false;
    if (d.curse && (m.round !== 2 || !m.players.includes(d.curse.chooserId) || new Set(d.curse.options).size !== 3 || d.curse.selected && !d.curse.options.includes(d.curse.selected))) return false;
    if (m.round === 2 && (!d.curse || m.phase !== "curse-selection" && !d.curse.selected)) return false;
    const choices = d.finalChoices ?? [];
    if (choices.length && m.round !== 3 || new Set(choices.map(c => c.playerId)).size !== choices.length || choices.some(c => !m.players.includes(c.playerId))) return false;
    if (m.round === 3 && m.phase !== "final-preparation" && choices.length !== m.players.length) return false;
    for (const choice of choices) if (chains(m, 3).find(c => c.originalPlayerId === choice.playerId)?.promptChoices[0] !== `${d.selectedPrompts[2]} — ${SKETCH_MODIFIERS.find(v => v.id === choice.modifier)!.suffix}`) return false;
  }
  if (new Set(d.promptSubmissions.map(o => o.authorId)).size !== d.promptSubmissions.length || d.promptSubmissions.some(o => !o.authorId || !m.players.includes(o.authorId))) return false;
  if (!["prompt-writing", "prompt-voting"].includes(m.phase) && d.selectedPrompts.length !== rounds) return false;
  for (const [items, isPrompt] of [[d.promptBallots, true], [d.ballots, false]] as const) {
    if (new Set(items.map(b => `${b.round}:${b.playerId}`)).size !== items.length) return false;
    for (const b of items) if (!m.players.includes(b.playerId) || b.round > m.round || new Set(b.ranking).size !== b.ranking.length || b.ranking.some(id => isPrompt ? !d.promptOptions.some(o => o.id === id && o.authorId !== b.playerId) : !m.chains.some(c => c.chainId === id && c.round === b.round && c.originalPlayerId !== b.playerId && c.drawing))) return false;
  }
  if (new Set(d.guesses.map(g => `${g.round}:${g.playerId}`)).size !== d.guesses.length || d.guesses.some(g => !m.players.includes(g.playerId) || g.round > m.round || new Set(g.guesses.map(a => a.entryId)).size !== g.guesses.length || new Set(g.guesses.map(a => a.playerId)).size !== g.guesses.length || g.guesses.some(a => !d.ballots.some(b => b.playerId === g.playerId && b.round === g.round && b.ranking.includes(a.entryId)) || !m.players.includes(a.playerId) || a.playerId === g.playerId))) return false;
  for (const [i, order] of d.orders.entries()) if (new Set(order).size !== order.length || order.some(id => !m.chains.some(c => c.chainId === id && c.round === i + 1 && c.drawing))) return false;
  if (d.revealOrder.some(id => !d.orders[m.round - 1]!.includes(id)) || new Set(d.revealOrder).size !== d.revealOrder.length || m.phase === "revealing" && !d.revealOrder[m.revealIndex]) return false;
  if (m.chains.some(c => c.drawing && (c.drawing.playerId !== c.originalPlayerId || Boolean(c.drawing.practice) !== m.botIds.includes(c.originalPlayerId) || !c.drawing.practice && (!c.drawing.source || c.drawing.assetId !== c.drawing.source.assetId) || c.drawing.practice && (c.drawing.assetId || c.drawing.image.assetId || c.drawing.image.jobId) || c.drawing.submittedAt > m.updatedAt))) return false;
  const expected = clone(m); scores(expected); return Object.keys(m.scores).length === m.players.length && m.players.every(p => expected.scores[p] === m.scores[p]);
}
export function showdownSnapshot(m: SketchRelayMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }, now=m.updatedAt): SnapshotSketchRelay {
  const d = s(m), playerId = viewer.role === "player" && m.players.includes(viewer.playerId) ? viewer.playerId : "";
  const fallback = d.fallbackRounds.includes(m.round);
  const entry = (entryId: string, reveal = false): ShowdownEntry => {
    const c = m.chains.find(c => c.chainId === entryId)!, l = c.drawing;
    const index = d.orders[c.round - 1]!.indexOf(entryId); const points = d.ballots.filter(b => b.round === c.round).reduce((n, b) => { const rank = b.ranking.indexOf(entryId); return n + (rank < 0 ? 0 : [100, 75, 50][rank]!); }, 0);
    const original = d.fallbackRounds.includes(c.round); const image = original ? { status: "FALLBACK" as const, ...(l?.assetId ? { assetId: l.assetId } : {}) } : { status: l?.image.status ?? "MISSING" as const, ...(l?.image.assetId ? { assetId: l.image.assetId } : {}) };
    return { entryId, letter: String.fromCharCode(65 + Math.max(0, index)), image, ...(l?.practice ? { practice: true, practiceStyle: { ...(c.restriction ? { restriction: c.restriction } : {}), ...(c.round === 3 ? { starter: d.finalChoices?.find(v => v.playerId === c.originalPlayerId)?.starter } : {}) } } : {}), ...(reveal ? { playerId: c.originalPlayerId, originalAssetId: l?.assetId, prompt: c.promptChoices[c.promptIndex], round: c.round, ...(c.round === 3 ? { starter: d.finalChoices?.find(v => v.playerId === c.originalPlayerId)?.starter } : {}), laughterPoints: points * multiplier(m, c.round), votes: d.ballots.filter(b => b.round === c.round && b.ranking.includes(entryId)).length, place: 1 + d.orders[c.round - 1]!.filter(id => { const ps = d.ballots.filter(b => b.round === c.round).reduce((n, b) => { const rank = b.ranking.indexOf(id); return n + (rank < 0 ? 0 : [100, 75, 50][rank]!); }, 0); return ps > points; }).length } : {}) };
  };
  const publicGallery = ["showcase", "laughter-voting", "artist-guessing", "revealing", "round-results", "halfway", "complete"].includes(m.phase);
  const revealed = m.chains.filter(c => c.drawing && disclosed(m, c.chainId)).map(c => entry(c.chainId, true));
  const own = chains(m).find(c => c.originalPlayerId === playerId);
  return { matchId: m.matchId, round: m.round, totalRounds: showdownRounds(m), phase: m.phase, deadline: m.deadline, players: [...m.players], totalPlayers: m.players.length, submittedCount: showdownSubmittedCount(m), scores: { ...m.scores }, revealIndex: m.revealIndex, revealTotal: d.revealOrder.length, applauseOptions: [], applauded: false,
    ...(playerId && own ? { self: { chainId: own.chainId, submitted: showdownSubmitted(m, playerId), prompt: own.promptChoices[own.promptIndex], ...(m.round === 2 && d.curse?.selected ? { restriction: d.curse.selected } : {}), ...(m.round === 3 ? { starter: d.finalChoices?.find(v => v.playerId === playerId)?.starter } : {}), practice: m.botIds.includes(playerId) } } : {}),
    showdown: { workshop: workshopSnapshot(m,playerId,now), sorceryLength: d.sorceryLength, multiplier: multiplier(m), ...(m.round === 2 && d.curse ? { curse: clone(d.curse) } : {}), ...(playerId && m.round === 3 ? { finalChoice: d.finalChoices?.find(v => v.playerId === playerId) ? { modifier: d.finalChoices.find(v => v.playerId === playerId)!.modifier, starter: d.finalChoices.find(v => v.playerId === playerId)!.starter } : undefined } : {}), phaseStartedAt: d.phaseStartedAt, phaseDuration: d.phaseDuration, prompt: d.selectedPrompts[m.round - 1], examples: featuredExamples(m).map(({ id, text, original }) => ({ id, text, original })),
      ...(m.phase === "prompt-voting" ? { promptOptions: d.promptOptions.map(({ id, text, original }) => ({ id, text, original })) } : {}),
      ...(playerId ? { ownPromptId: d.promptSubmissions.find(p => p.authorId === playerId)?.id, promptSubmitted: d.promptSubmissions.some(p => p.authorId === playerId), promptRanking: d.promptBallots.find(b => b.playerId === playerId)?.ranking, ownEntryId: own?.chainId, laughterRanking: voter(d.ballots, m, playerId)?.ranking, guesses: voter(d.guesses, m, playerId)?.guesses } : {}),
      entries: publicGallery ? d.orders[m.round - 1]!.map(id => entry(id)) : [], submitted: Boolean(playerId && showdownSubmitted(m, playerId)), pendingPlayers: ["drawing", "prompt-writing"].includes(m.phase) ? m.players.filter(p => !showdownSubmitted(m, p)) : [],
      revealedEntries: revealed, ...(m.phase === "revealing" && d.revealOrder[m.revealIndex] ? { revealEntry: entry(d.revealOrder[m.revealIndex]!, true) } : {}),
      ...(d.emote ? { emote: { name: d.emote.name, playerId: d.emote.playerId, expiresAt: d.emote.expiresAt, sequence: d.emote.sequence } } : {}),
      ...(playerId ? { guessResults: (voter(d.guesses, m, playerId)?.guesses ?? []).filter(g => disclosed(m, g.entryId)).map(g => ({ entryId: g.entryId, correct: m.chains.find(c => c.chainId === g.entryId)?.originalPlayerId === g.playerId, points: m.chains.find(c => c.chainId === g.entryId)?.originalPlayerId === g.playerId ? 50 * multiplier(m) : 0 })) } : {}),
      fallback, champions: m.phase === "complete" ? m.players.filter(p => m.scores[p] === Math.max(...Object.values(m.scores))) : [],
    } };
}
export function canViewShowdownAsset(m: SketchRelayMatch, viewerId: string | null, assetId: string) {
  for (const c of m.chains) { const l = c.drawing; if (!l || l.assetId !== assetId && l.image.assetId !== assetId) continue;
    if (viewerId === c.originalPlayerId || disclosed(m, c.chainId)) return true;
    if (c.round === m.round && ["showcase", "laughter-voting", "artist-guessing", "revealing", "round-results", "halfway", "complete"].includes(m.phase) && s(m).orders[m.round - 1]!.includes(c.chainId)) return s(m).fallbackRounds.includes(m.round) ? assetId === l.assetId : l.image.status === "READY" && assetId === l.image.assetId;
  }
  return false;
}
