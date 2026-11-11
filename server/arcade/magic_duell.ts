export const MAGIC_DUELL_PLAYERS = 10;
export const MAGIC_DUELL_ROUNDS = 5;
export const MAGIC_DUELL_HEALTH = 12;
export const MAGIC_DUELL_MAX_MANA = 5;
export const MAGIC_DUELL_LOADOUT_SIZE = 3;
export const MAGIC_DUELL_DRAFT_MS = 45_000;
export const MAGIC_DUELL_ROUND_MS = 30_000;

export type MagicDuellGesture = "bolt" | "shield" | "loop";
export type MagicDuellKind = "attack" | "guard" | "focus";
export interface MagicDuellPoint { x: number; y: number }
export interface MagicDuellSpell { id: string; name: string; description: string; kind: MagicDuellKind; glyph: MagicDuellGesture; cost: number; strength: number }
export interface MagicDuellCast { spellId: string; gesture: MagicDuellGesture; timedOut: boolean }
export interface MagicDuellRoundResult { round: number; casts: Record<string, MagicDuellCast>; health: Record<string, number>; mana: Record<string, number>; damage: Record<string, number>; timedOut: boolean }
export interface MagicDuellMatch {
  matchId: string; players: string[]; phase: "drafting" | "casting" | "revealed" | "complete"; round: number; roundCount: 5;
  loadouts: Record<string, string[]>; choices: Record<string, Omit<MagicDuellCast, "timedOut">>; health: Record<string, number>; mana: Record<string, number>;
  deadline: number; updatedAt: number; version: number; roundResults: MagicDuellRoundResult[];
  result?: { matchId: string; winnerPlayerId: string | null; outcome: "knockout" | "points" | "draw"; health: Record<string, number>; mana: Record<string, number>; roundsPlayed: number };
}
export type MagicDuellMutation = { ok: true; state: MagicDuellMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "ROUND_MISMATCH" | "ROUND_CLOSED" | "UNAUTHORIZED" | "INVALID_LOADOUT" | "SPELL_NOT_DRAFTED" | "INSUFFICIENT_MANA" | "GESTURE_MISMATCH" | "TOO_EARLY" | "ALREADY_LOCKED" };

export const MAGIC_DUELL_SPELLS: readonly MagicDuellSpell[] = [
  { id: "spark-bolt", name: "Spark Bolt", description: "A quick strike for 2 damage.", kind: "attack", glyph: "bolt", cost: 1, strength: 2 },
  { id: "comet-lance", name: "Comet Lance", description: "A heavier strike for 3 damage.", kind: "attack", glyph: "bolt", cost: 2, strength: 3 },
  { id: "prism-ward", name: "Prism Ward", description: "Shield 2 damage this round.", kind: "guard", glyph: "shield", cost: 1, strength: 2 },
  { id: "mirror-shield", name: "Mirror Shield", description: "Shield 3 damage this round.", kind: "guard", glyph: "shield", cost: 2, strength: 3 },
  { id: "stillwater", name: "Stillwater", description: "Recover 2 mana after the cast.", kind: "focus", glyph: "loop", cost: 0, strength: 2 },
  { id: "astral-flow", name: "Astral Flow", description: "Spend 1 mana to recover 3.", kind: "focus", glyph: "loop", cost: 1, strength: 3 },
];
export const MAGIC_DUELL_DEFAULT_LOADOUT = ["spark-bolt", "prism-ward", "stillwater"] as const;

const clone = <T,>(value: T): T => structuredClone(value);
const spellById = (id: string) => MAGIC_DUELL_SPELLS.find((spell) => spell.id === id);
const safeNow = (now: number, min: number) => Number.isSafeInteger(now) && now >= min;

/** Classifies a small normalized pointer trace; server and browser use the same deterministic rule. */
export function classifyMagicDuellGesture(stroke: readonly MagicDuellPoint[]): MagicDuellGesture | null {
  if (!Array.isArray(stroke) || stroke.length < 5 || stroke.length > 32 || stroke.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) return null;
  let length = 0;
  for (let i = 1; i < stroke.length; i += 1) length += Math.hypot(stroke[i]!.x - stroke[i - 1]!.x, stroke[i]!.y - stroke[i - 1]!.y);
  if (length < .45 || length > 5) return null;
  const xs = stroke.map((point) => point.x), ys = stroke.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  const closed = Math.hypot(stroke[0]!.x - stroke.at(-1)!.x, stroke[0]!.y - stroke.at(-1)!.y) <= .2;
  if (closed && width >= .35 && height >= .35) {
    let sharpCorners = 0;
    for (let i = 1; i < stroke.length - 1; i += 1) {
      const ax = stroke[i]!.x - stroke[i - 1]!.x, ay = stroke[i]!.y - stroke[i - 1]!.y;
      const bx = stroke[i + 1]!.x - stroke[i]!.x, by = stroke[i + 1]!.y - stroke[i]!.y;
      const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
      if (denominator > .0001 && Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / denominator))) > .65) sharpCorners += 1;
    }
    return sharpCorners >= 2 ? "shield" : "loop";
  }
  // Pointer devices emit many small samples between intentional corners. Track
  // horizontal movement relative to an anchor so interpolation does not erase
  // the bolt's left/right turns (or make a straight line look like many turns).
  const horizontalDirections: number[] = [];
  let horizontalAnchor = stroke[0]!.x;
  for (let i = 1; i < stroke.length; i += 1) {
    const dx = stroke[i]!.x - horizontalAnchor;
    if (Math.abs(dx) < .08) continue;
    const direction = Math.sign(dx);
    if (horizontalDirections.at(-1) !== direction) horizontalDirections.push(direction);
    horizontalAnchor = stroke[i]!.x;
  }
  let reversals = 0;
  for (let i = 1; i < horizontalDirections.length; i += 1) if (horizontalDirections[i] !== horizontalDirections[i - 1]) reversals += 1;
  return reversals >= 2 && width >= .35 && height >= .25 ? "bolt" : null;
}

function scoresValid(record: Record<string, number>, players: string[], maximum: number) { return record && Object.keys(record).length === players.length && players.every((id) => Number.isInteger(record[id]) && record[id]! >= 0 && record[id]! <= maximum); }
function compareRecord<T>(a: Record<string, T>, b: Record<string, T>, players: string[], equals: (x: T, y: T) => boolean) { return Boolean(a && b) && Object.keys(a).length === players.length && Object.keys(b).length === players.length && players.every((id) => Object.hasOwn(a, id) && Object.hasOwn(b, id) && equals(a[id]!, b[id]!)); }
function sameCast(a: MagicDuellCast, b: MagicDuellCast) { return a.spellId === b.spellId && a.gesture === b.gesture && a.timedOut === b.timedOut; }
function compareRoundResult(a: MagicDuellRoundResult, b: MagicDuellRoundResult, players: string[]) {
  return a.round === b.round && a.timedOut === b.timedOut && compareRecord(a.casts, b.casts, players, sameCast) && compareRecord(a.health, b.health, players, Object.is) && compareRecord(a.mana, b.mana, players, Object.is) && compareRecord(a.damage, b.damage, players, Object.is);
}
export function magicDuellTargets(players: readonly string[], health: Record<string, number>): Record<string, string | null> {
  const alive = players.filter((id) => health[id]! > 0);
  return Object.fromEntries(players.map((id) => [id, alive.includes(id) && alive.length > 1 ? alive[(alive.indexOf(id) + 1) % alive.length]! : null]));
}
function winnerFor(players: string[], health: Record<string, number>, mana: Record<string, number>) {
  const ordered = players.filter((id) => health[id]! > 0).sort((a, b) => health[b]! - health[a]! || mana[b]! - mana[a]!);
  return ordered.length && (!ordered[1] || health[ordered[0]!] !== health[ordered[1]] || mana[ordered[0]!] !== mana[ordered[1]]) ? ordered[0]! : null;
}
function finish(match: MagicDuellMatch, outcome: "knockout" | "points" | "draw") {
  const winnerPlayerId = winnerFor(match.players, match.health, match.mana);
  return { ...match, phase: "complete" as const, result: { matchId: match.matchId, winnerPlayerId, outcome: winnerPlayerId ? outcome : "draw" as const, health: { ...match.health }, mana: { ...match.mana }, roundsPlayed: match.roundResults.length } };
}
function resolveRound(match: MagicDuellMatch, casts: Record<string, MagicDuellCast>, round: number, priorHealth: Record<string, number>, priorMana: Record<string, number>) {
  const health = { ...priorHealth }, mana = { ...priorMana }, damage = Object.fromEntries(match.players.map((id) => [id, 0])) as Record<string, number>;
  for (const playerId of match.players) {
    if (priorHealth[playerId] === 0) continue;
    const cast = casts[playerId]!;
    const spell = cast.spellId === "rest" ? null : spellById(cast.spellId)!;
    const available = Math.min(MAGIC_DUELL_MAX_MANA, priorMana[playerId]! + 1);
    mana[playerId] = Math.min(MAGIC_DUELL_MAX_MANA, available - (spell?.cost ?? 0) + (spell?.kind === "focus" ? spell.strength : cast.spellId === "rest" ? 2 : 0));
  }
  const targets = magicDuellTargets(match.players, priorHealth);
  for (const playerId of match.players) {
    const opponent = targets[playerId];
    if (!opponent) continue;
    const spell = casts[playerId]!.spellId === "rest" ? null : spellById(casts[playerId]!.spellId)!;
    if (spell?.kind === "attack") {
      const defense = casts[opponent]!.spellId === "rest" ? 0 : spellById(casts[opponent]!.spellId)!.kind === "guard" ? spellById(casts[opponent]!.spellId)!.strength : 0;
      damage[opponent] = damage[opponent]! + Math.max(0, spell.strength - defense);
    }
  }
  for (const id of match.players) health[id] = Math.max(0, priorHealth[id]! - damage[id]!);
  const result = { round, casts: clone(casts), health, mana, damage, timedOut: match.players.some((id) => priorHealth[id]! > 0 && casts[id]!.timedOut) };
  return result;
}

export function isValidMagicDuellMatch(value: unknown): value is MagicDuellMatch {
  const match = value as MagicDuellMatch;
  if (!match || typeof match !== "object" || !/^[\w-]{1,120}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < 2 || match.players.length > MAGIC_DUELL_PLAYERS || match.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(match.players).size !== match.players.length || match.roundCount !== MAGIC_DUELL_ROUNDS || !["drafting", "casting", "revealed", "complete"].includes(match.phase) || !Number.isInteger(match.round) || match.round < 0 || match.round > MAGIC_DUELL_ROUNDS || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || !Number.isInteger(match.version) || match.version < 0 || !match.loadouts || !match.choices || !Array.isArray(match.roundResults) || !scoresValid(match.health, match.players, MAGIC_DUELL_HEALTH) || !scoresValid(match.mana, match.players, MAGIC_DUELL_MAX_MANA)) return false;
  if (Object.keys(match.loadouts).some((id) => !match.players.includes(id) || !Array.isArray(match.loadouts[id]) || match.loadouts[id]!.length !== MAGIC_DUELL_LOADOUT_SIZE || new Set(match.loadouts[id]).size !== MAGIC_DUELL_LOADOUT_SIZE || match.loadouts[id]!.some((spellId) => !spellById(spellId)))) return false;
  if (Object.keys(match.choices).some((id) => {
    if (!match.players.includes(id)) return true;
    const choice = match.choices[id]!;
    if (!choice || typeof choice !== "object") return true;
    if (choice.spellId === "rest") return match.phase === "casting" || match.roundResults.at(-1)?.casts[id]?.spellId !== "rest";
    const spell = spellById(choice.spellId);
    return !match.loadouts[id]?.includes(choice.spellId) || !spell || choice.gesture !== spell.glyph;
  })) return false;
  if (match.phase === "drafting") return match.players.every((id) => match.health[id] === MAGIC_DUELL_HEALTH && match.mana[id] === 2) && match.round === 0 && match.roundResults.length === 0 && Object.keys(match.choices).length === 0 && !match.result && match.deadline >= match.updatedAt;
  if (match.players.some((id) => !match.loadouts[id]) || match.round < 1 || match.roundResults.length !== match.round - (match.phase === "casting" ? 1 : 0)) return false;
  let priorHealth = Object.fromEntries(match.players.map((id) => [id, MAGIC_DUELL_HEALTH])) as Record<string, number>;
  let priorMana = Object.fromEntries(match.players.map((id) => [id, 2])) as Record<string, number>;
  let terminal = false;
  for (let index = 0; index < match.roundResults.length; index += 1) {
    const saved = match.roundResults[index]!;
    if (terminal || !saved || !saved.casts || match.players.some((id) => {
      const cast = saved.casts[id];
      if (!cast || typeof cast.timedOut !== "boolean" || !["bolt", "shield", "loop"].includes(cast.gesture)) return true;
      if (priorHealth[id] === 0) return cast.spellId !== "rest" || cast.gesture !== "loop" || cast.timedOut;
      if (cast.spellId === "rest") return !cast.timedOut || cast.gesture !== "loop";
      if (cast.timedOut) return true;
      const spell = spellById(cast.spellId);
      return !match.loadouts[id]!.includes(cast.spellId) || !spell || cast.gesture !== spell.glyph || spell.cost > Math.min(MAGIC_DUELL_MAX_MANA, priorMana[id]! + 1);
    })) return false;
    const expected = resolveRound(match, saved.casts, index + 1, priorHealth, priorMana);
    if (!compareRoundResult(saved, expected, match.players)) return false;
    priorHealth = expected.health; priorMana = expected.mana;
    terminal = match.players.filter((id) => priorHealth[id]! > 0).length <= 1 || index + 1 === MAGIC_DUELL_ROUNDS;
  }
  if ((match.phase === "complete") !== terminal) return false;
  if (!compareRecord(match.health, priorHealth, match.players, Object.is) || !compareRecord(match.mana, priorMana, match.players, Object.is) || (match.phase === "casting" && (match.deadline < match.updatedAt || match.result)) || (match.phase !== "casting" && (match.deadline !== match.updatedAt || match.phase === "revealed" && match.result))) return false;
  if (match.phase === "casting" && (match.players.some((id) => match.choices[id] && (match.health[id] === 0 || !match.loadouts[id]!.includes(match.choices[id]!.spellId) || spellById(match.choices[id]!.spellId)!.cost > Math.min(MAGIC_DUELL_MAX_MANA, match.mana[id]! + 1))) || match.roundResults.length !== match.round - 1)) return false;
  if (match.phase === "revealed" || match.phase === "complete") {
    const latest = match.roundResults.at(-1);
    if (!latest || match.players.some((id) => !match.choices[id] || match.choices[id]!.spellId !== latest.casts[id]!.spellId || match.choices[id]!.gesture !== latest.casts[id]!.gesture)) return false;
  }
  if ((match.phase === "complete") !== Boolean(match.result)) return false;
  if (!match.result) return true;
  const winner = winnerFor(match.players, match.health, match.mana);
  return match.result.matchId === match.matchId && match.result.winnerPlayerId === winner && match.result.outcome === (winner ? match.players.filter((id) => match.health[id]! > 0).length <= 1 ? "knockout" : "points" : "draw") && match.result.roundsPlayed === match.roundResults.length && compareRecord(match.result.health, match.health, match.players, Object.is) && compareRecord(match.result.mana, match.mana, match.players, Object.is);
}

export function createMagicDuellMatch(input: { matchId: string; players: string[]; now: number }): MagicDuellMatch {
  if (!input || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < 2 || input.players.length > MAGIC_DUELL_PLAYERS || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - MAGIC_DUELL_DRAFT_MS) throw new TypeError("Magic Duell requires two to ten valid players and a safe clock");
  const players = [...input.players];
  const match: MagicDuellMatch = { matchId: input.matchId, players, phase: "drafting", round: 0, roundCount: MAGIC_DUELL_ROUNDS, loadouts: {}, choices: {}, health: Object.fromEntries(players.map((id) => [id, MAGIC_DUELL_HEALTH])), mana: Object.fromEntries(players.map((id) => [id, 2])), deadline: input.now + MAGIC_DUELL_DRAFT_MS, updatedAt: input.now, version: 0, roundResults: [] };
  if (!isValidMagicDuellMatch(match)) throw new TypeError("Could not create a valid Magic Duell match");
  return match;
}
export function chooseMagicDuellLoadout(match: MagicDuellMatch, input: { matchId: string; playerId: string; spellIds: string[]; now: number }): MagicDuellMutation {
  if (!isValidMagicDuellMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || !Array.isArray(input.spellIds) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (!match.players.includes(input.playerId)) return { ok: false, code: "UNAUTHORIZED" };
  if (match.phase !== "drafting" || input.now >= match.deadline) return { ok: false, code: "ROUND_CLOSED" };
  if (match.loadouts[input.playerId]) return JSON.stringify(match.loadouts[input.playerId]) === JSON.stringify(input.spellIds) ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (input.spellIds.length !== MAGIC_DUELL_LOADOUT_SIZE || new Set(input.spellIds).size !== input.spellIds.length || input.spellIds.some((id) => !spellById(id))) return { ok: false, code: "INVALID_LOADOUT" };
  const next = clone(match); next.loadouts[input.playerId] = [...input.spellIds]; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}
export function beginMagicDuell(match: MagicDuellMatch, input: { now: number }): MagicDuellMutation {
  if (!isValidMagicDuellMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - MAGIC_DUELL_ROUND_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "drafting") return { ok: false, code: "ROUND_CLOSED" };
  if (match.players.some((id) => !match.loadouts[id]) && input.now < match.deadline) return { ok: false, code: "TOO_EARLY" };
  const loadouts = { ...match.loadouts };
  for (const id of match.players) if (!loadouts[id]) loadouts[id] = [...MAGIC_DUELL_DEFAULT_LOADOUT];
  return { ok: true, state: { ...clone(match), loadouts, phase: "casting", round: 1, deadline: input.now + MAGIC_DUELL_ROUND_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function chooseMagicDuellCast(match: MagicDuellMatch, input: { matchId: string; round: number; playerId: string; spellId: string; stroke: readonly MagicDuellPoint[]; now: number }): MagicDuellMutation {
  if (!isValidMagicDuellMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || typeof input.spellId !== "string" || !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.round !== match.round) return { ok: false, code: "ROUND_MISMATCH" };
  if (!match.players.includes(input.playerId) || match.health[input.playerId] === 0) return { ok: false, code: "UNAUTHORIZED" };
  if (match.phase !== "casting" || input.now >= match.deadline) return { ok: false, code: "ROUND_CLOSED" };
  const existing = match.choices[input.playerId];
  if (existing) return existing.spellId === input.spellId && existing.gesture === spellById(input.spellId)?.glyph ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (!match.loadouts[input.playerId]!.includes(input.spellId)) return { ok: false, code: "SPELL_NOT_DRAFTED" };
  const spell = spellById(input.spellId)!;
  if (spell.cost > Math.min(MAGIC_DUELL_MAX_MANA, match.mana[input.playerId]! + 1)) return { ok: false, code: "INSUFFICIENT_MANA" };
  const gesture = classifyMagicDuellGesture(input.stroke);
  if (gesture !== spell.glyph) return { ok: false, code: "GESTURE_MISMATCH" };
  const next = clone(match); next.choices[input.playerId] = { spellId: spell.id, gesture }; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}
export function revealMagicDuellRound(match: MagicDuellMatch, input: { now: number }): MagicDuellMutation {
  if (!isValidMagicDuellMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !safeNow(input.now, match.updatedAt)) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "casting") return { ok: false, code: "ROUND_CLOSED" };
  const missing = match.players.some((id) => match.health[id]! > 0 && !match.choices[id]);
  if (missing && input.now < match.deadline) return { ok: false, code: "TOO_EARLY" };
  const casts = Object.fromEntries(match.players.map((id) => [id, match.choices[id] ? { ...match.choices[id]!, timedOut: false } : { spellId: "rest", gesture: "loop", timedOut: match.health[id]! > 0 }])) as Record<string, MagicDuellCast>;
  const result = resolveRound(match, casts, match.round, match.health, match.mana);
  const next = clone(match); next.health = { ...result.health }; next.mana = { ...result.mana }; next.roundResults.push(result); next.choices = Object.fromEntries(match.players.map((id) => [id, { spellId: casts[id]!.spellId, gesture: casts[id]!.gesture }])); next.phase = "revealed"; next.deadline = input.now; next.updatedAt = input.now; next.version += 1;
  const knockout = next.players.filter((id) => next.health[id]! > 0).length <= 1;
  if (knockout || next.round === MAGIC_DUELL_ROUNDS) return { ok: true, state: finish(next, knockout ? "knockout" : "points") };
  return { ok: true, state: next };
}
export function advanceMagicDuellRound(match: MagicDuellMatch, input: { now: number }): MagicDuellMutation {
  if (!isValidMagicDuellMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - MAGIC_DUELL_ROUND_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "revealed" || match.round >= MAGIC_DUELL_ROUNDS) return { ok: false, code: "ROUND_CLOSED" };
  return { ok: true, state: { ...clone(match), phase: "casting", round: match.round + 1, choices: {}, deadline: input.now + MAGIC_DUELL_ROUND_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function magicDuellSnapshot(match: MagicDuellMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }): import("../../lib/contracts").SnapshotMagicDuell {
  if (!isValidMagicDuellMatch(match)) throw new TypeError("Invalid Magic Duell state");
  const base = { targets: magicDuellTargets(match.players, match.health), matchId: match.matchId, players: [...match.players], phase: match.phase, round: match.round, roundCount: MAGIC_DUELL_ROUNDS as 5, spells: clone([...MAGIC_DUELL_SPELLS]), health: { ...match.health }, mana: { ...match.mana }, deadline: match.deadline, version: match.version, draftSubmissionCount: Object.keys(match.loadouts).length, submissionCount: Object.keys(match.choices).length, submitted: viewer.role === "player" && Object.hasOwn(match.choices, viewer.playerId), draftSubmitted: viewer.role === "player" && Object.hasOwn(match.loadouts, viewer.playerId), roundResults: match.phase === "revealed" || match.phase === "complete" ? clone(match.roundResults) : [], result: match.result ? clone(match.result) : undefined };
  if (viewer.role === "player" && match.players.includes(viewer.playerId)) {
    const loadout = match.loadouts[viewer.playerId];
    const spellId = match.phase === "casting" ? match.choices[viewer.playerId]?.spellId : undefined;
    return { ...base, ...(loadout ? { ownLoadout: [...loadout] } : {}), ...(spellId ? { ownSpellId: spellId } : {}) };
  }
  return base;
}
