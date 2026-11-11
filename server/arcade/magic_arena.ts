export const MAGIC_ARENA_PLAYERS = 10;
export const MAGIC_ARENA_ROUNDS = 5;
export const MAGIC_ARENA_HEALTH = 6;
export const MAGIC_ARENA_MAX_ENERGY = 3;
export const MAGIC_ARENA_ROUND_MS = 30_000;
export type MagicArenaAction = "strike" | "guard" | "focus";
export interface MagicArenaRoundResult { round: number; actions: Record<string, MagicArenaAction>; health: Record<string, number>; energy: Record<string, number>; damage: Record<string, number>; outcome: "hit" | "blocked" | "no-damage" | "knockout" | "timeout" }
export interface MagicArenaMatch { matchId: string; players: string[]; round: number; roundCount: 5; phase: "choosing" | "revealed" | "complete"; choices: Record<string, MagicArenaAction>; health: Record<string, number>; energy: Record<string, number>; deadline: number; updatedAt: number; version: number; roundResults: MagicArenaRoundResult[]; result?: { matchId: string; winnerPlayerId: string | null; outcome: "knockout" | "points" | "draw"; health: Record<string, number>; energy: Record<string, number>; roundsPlayed: number } }
export type MagicArenaMutation = { ok: true; state: MagicArenaMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "ROUND_MISMATCH" | "ROUND_CLOSED" | "UNAUTHORIZED" | "INSUFFICIENT_ENERGY" | "TOO_EARLY" | "ALREADY_LOCKED" };
const clone = <T,>(value: T): T => structuredClone(value);
const validClock = (now: number, updatedAt: number): boolean => Number.isSafeInteger(now) && now >= updatedAt;
/** Every living fighter attacks the next living fighter in roster order. */
export function magicArenaTargets(players: readonly string[], health: Record<string, number>): Record<string, string | null> {
  const alive = players.filter((id) => health[id]! > 0);
  return Object.fromEntries(players.map((id) => [id, alive.includes(id) && alive.length > 1 ? alive[(alive.indexOf(id) + 1) % alive.length]! : null]));
}
const sameRecord = <T,>(a: Record<string, T>, b: Record<string, T>, players: string[]) => Boolean(a && b && Object.keys(a).length === players.length && Object.keys(b).length === players.length && players.every((id) => Object.hasOwn(a, id) && Object.hasOwn(b, id) && a[id] === b[id]));
function winnerFor(match: MagicArenaMatch): string | null {
  const alive = match.players.filter((id) => match.health[id]! > 0);
  const ordered = alive.sort((a, b) => match.health[b]! - match.health[a]! || match.energy[b]! - match.energy[a]!);
  return ordered.length && (!ordered[1] || match.health[ordered[0]!] !== match.health[ordered[1]] || match.energy[ordered[0]!] !== match.energy[ordered[1]]) ? ordered[0]! : null;
}
function resolveRound(players: string[], priorHealth: Record<string, number>, priorEnergy: Record<string, number>, actions: Record<string, MagicArenaAction>, round: number, timedOut: boolean): MagicArenaRoundResult {
  const health = { ...priorHealth }, energy = { ...priorEnergy };
  const targets = magicArenaTargets(players, priorHealth);
  const damage = Object.fromEntries(players.map((id) => [id, 0])) as Record<string, number>;
  for (const attacker of players) {
    const defender = targets[attacker];
    if (defender && actions[attacker] === "strike" && actions[defender] !== "guard") damage[defender] = damage[defender]! + 2;
  }
  for (const id of players) {
    if (priorHealth[id] === 0) continue;
    health[id] = Math.max(0, priorHealth[id]! - damage[id]!);
    energy[id] = Math.min(MAGIC_ARENA_MAX_ENERGY, priorEnergy[id]! + (actions[id] === "strike" ? -1 : actions[id] === "guard" ? 1 : 2));
  }
  const ko = players.some((id) => priorHealth[id]! > 0 && health[id] === 0);
  const outcome = ko ? "knockout" : timedOut ? "timeout" : Object.values(damage).some((value) => value > 0) ? "hit" : players.some((id) => priorHealth[id]! > 0 && actions[id] === "guard") ? "blocked" : "no-damage";
  return { round, actions: { ...actions }, health, energy, damage, outcome };
}
/** Replays every saved simultaneous round; roster expansion cannot authorize invented stats. */
export function isValidMagicArenaMatch(value: unknown): value is MagicArenaMatch {
  const match = value as MagicArenaMatch;
  if (!match || !/^[\w-]{1,100}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < 2 || match.players.length > MAGIC_ARENA_PLAYERS || match.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(match.players).size !== match.players.length || !Number.isInteger(match.round) || match.round < 1 || match.round > MAGIC_ARENA_ROUNDS || match.roundCount !== MAGIC_ARENA_ROUNDS || !["choosing", "revealed", "complete"].includes(match.phase) || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || !Number.isSafeInteger(match.version) || match.version < 0 || !match.choices || Object.keys(match.choices).some((id) => !match.players.includes(id) || !["strike", "guard", "focus"].includes(match.choices[id]!)) || !match.health || !match.energy || !Array.isArray(match.roundResults) || match.roundResults.length !== match.round - (match.phase === "choosing" ? 1 : 0)) return false;
  let health = Object.fromEntries(match.players.map((id) => [id, MAGIC_ARENA_HEALTH])) as Record<string, number>;
  let energy = Object.fromEntries(match.players.map((id) => [id, 2])) as Record<string, number>;
  let terminal = false;
  for (const [index, saved] of match.roundResults.entries()) {
    if (terminal || !saved || !saved.actions || Object.keys(saved.actions).length !== match.players.length || match.players.some((id) => !["strike", "guard", "focus"].includes(saved.actions[id]!) || (health[id] === 0 && saved.actions[id] !== "focus") || (saved.actions[id] === "strike" && energy[id]! < 1)) || (saved.outcome === "timeout" && !match.players.some((id) => health[id]! > 0 && saved.actions[id] === "focus"))) return false;
    const expected = resolveRound(match.players, health, energy, saved.actions, index + 1, saved.outcome === "timeout");
    if (saved.round !== expected.round || saved.outcome !== expected.outcome || !sameRecord(saved.health, expected.health, match.players) || !sameRecord(saved.energy, expected.energy, match.players) || !sameRecord(saved.damage, expected.damage, match.players)) return false;
    health = expected.health; energy = expected.energy;
    terminal = match.players.filter((id) => health[id]! > 0).length <= 1 || index + 1 === MAGIC_ARENA_ROUNDS;
  }
  if (!sameRecord(match.health, health, match.players) || !sameRecord(match.energy, energy, match.players) || (match.phase === "complete") !== terminal || (match.phase === "complete") !== Boolean(match.result)) return false;
  if (match.phase === "choosing") {
    if (match.deadline < match.updatedAt || Object.keys(match.choices).some((id) => health[id] === 0 || (match.choices[id] === "strike" && energy[id]! < 1))) return false;
  } else if (match.deadline !== match.updatedAt || Object.keys(match.choices).some((id) => match.roundResults.at(-1)!.actions[id] !== match.choices[id])) return false;
  if (match.result) {
    const winner = winnerFor(match);
    const outcome = winner ? match.players.filter((id) => health[id]! > 0).length <= 1 ? "knockout" : "points" : "draw";
    if (match.result.matchId !== match.matchId || match.result.winnerPlayerId !== winner || match.result.outcome !== outcome || match.result.roundsPlayed !== match.roundResults.length || !sameRecord(match.result.health, health, match.players) || !sameRecord(match.result.energy, energy, match.players)) return false;
  }
  return true;
}
const valid = isValidMagicArenaMatch;
function finalResult(match: MagicArenaMatch, outcome: "knockout" | "points" | "draw"): MagicArenaMatch {
  const winnerPlayerId = winnerFor(match);
  return { ...match, phase: "complete", result: { matchId: match.matchId, winnerPlayerId, outcome: winnerPlayerId ? outcome : "draw", health: { ...match.health }, energy: { ...match.energy }, roundsPlayed: match.roundResults.length } };
}
export function createMagicArenaMatch(input: { matchId: string; players: string[]; now: number }): MagicArenaMatch {
  if (!input || !/^[\w-]{1,100}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < 2 || input.players.length > MAGIC_ARENA_PLAYERS || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - MAGIC_ARENA_ROUND_MS) throw new TypeError("Magic Arena requires two to ten valid players and a safe clock");
  const players = [...input.players];
  return { matchId: input.matchId, players, round: 1, roundCount: MAGIC_ARENA_ROUNDS, phase: "choosing", choices: {}, health: Object.fromEntries(players.map((id) => [id, MAGIC_ARENA_HEALTH])), energy: Object.fromEntries(players.map((id) => [id, 2])), deadline: input.now + MAGIC_ARENA_ROUND_MS, updatedAt: input.now, version: 0, roundResults: [] };
}
export function chooseMagicArenaAction(match: MagicArenaMatch, input: { matchId: string; round: number; playerId: string; action: MagicArenaAction; now: number }): MagicArenaMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || !["strike", "guard", "focus"].includes(input.action) || !Number.isSafeInteger(input.round) || !validClock(input.now, match.updatedAt)) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.round !== match.round) return { ok: false, code: "ROUND_MISMATCH" };
  if (!match.players.includes(input.playerId) || match.health[input.playerId] === 0) return { ok: false, code: "UNAUTHORIZED" };
  if (match.choices[input.playerId]) return match.choices[input.playerId] === input.action ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (match.phase !== "choosing" || input.now >= match.deadline) return { ok: false, code: "ROUND_CLOSED" };
  if (input.action === "strike" && match.energy[input.playerId]! < 1) return { ok: false, code: "INSUFFICIENT_ENERGY" };
  const next = clone(match); next.choices[input.playerId] = input.action; next.updatedAt = input.now; next.version += 1; return { ok: true, state: next };
}
export function revealMagicArenaRound(match: MagicArenaMatch, input: { now: number }): MagicArenaMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !validClock(input.now, match.updatedAt)) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "ROUND_CLOSED" };
  const timedOut = input.now >= match.deadline;
  if (!timedOut && match.players.some((id) => match.health[id]! > 0 && !match.choices[id])) return { ok: false, code: "TOO_EARLY" };
  const next = clone(match); const actions = Object.fromEntries(match.players.map((id) => [id, match.choices[id] ?? "focus"])) as Record<string, MagicArenaAction>;
  const missingMove = match.players.some((id) => match.health[id]! > 0 && !match.choices[id]);
  const result = resolveRound(match.players, match.health, match.energy, actions, match.round, timedOut && missingMove);
  next.health = result.health; next.energy = result.energy; next.roundResults.push(result);
  next.phase = "revealed"; next.deadline = input.now; next.updatedAt = input.now; next.version += 1;
  const terminalKnockout = next.players.filter((id) => next.health[id]! > 0).length <= 1;
  if (terminalKnockout || match.round === MAGIC_ARENA_ROUNDS) return { ok: true, state: finalResult(next, terminalKnockout ? "knockout" : "points") };
  return { ok: true, state: next };
}
export function advanceMagicArenaRound(match: MagicArenaMatch, input: { now: number }): MagicArenaMutation {
  if (!valid(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - MAGIC_ARENA_ROUND_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "revealed" || match.result || match.round >= MAGIC_ARENA_ROUNDS) return { ok: false, code: "ROUND_CLOSED" };
  return { ok: true, state: { ...clone(match), round: match.round + 1, phase: "choosing", choices: {}, deadline: input.now + MAGIC_ARENA_ROUND_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function magicArenaSnapshot(match: MagicArenaMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }) {
  if (!valid(match)) throw new TypeError("Invalid Magic Arena state");
  const own = viewer.role === "player" && match.players.includes(viewer.playerId) ? viewer.playerId : null;
  const base = { targets: magicArenaTargets(match.players, match.health), matchId: match.matchId, players: [...match.players], round: match.round, roundCount: match.roundCount, phase: match.phase, health: { ...match.health }, energy: { ...match.energy }, deadline: match.deadline, version: match.version, submissionCount: Object.keys(match.choices).length, submitted: own !== null && Object.hasOwn(match.choices, own), roundResults: clone(match.roundResults), result: match.result ? clone(match.result) : undefined };
  if (match.phase !== "choosing") return base;
  if (own !== null && Object.hasOwn(match.choices, own)) return { ...base, ownAction: match.choices[own] };
  return base;
}
