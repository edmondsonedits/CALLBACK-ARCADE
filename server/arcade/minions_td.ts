export const MINIONS_TD_PLAYERS = 10;
export const MINIONS_TD_ROUNDS = 6;
export const MINIONS_TD_BASE_HEALTH = 12;
export const MINIONS_TD_MAX_GOLD = 10;
export const MINIONS_TD_MAX_TOWER_LEVEL = 3;
export const MINIONS_TD_ROUND_MS = 30_000;
export const MINIONS_TD_RECOVERY_MS = 2_000;
export const MINIONS_TD_LANE_LENGTH = 5;

export type MinionsTdOrder = { type: "deploy"; unitId: string } | { type: "upgrade" } | { type: "brace" } | { type: "hold" };
export interface MinionsTdUnit { id: string; unitId: string; health: number; position: number; speed: number; damage: number }
export interface MinionsTdChoice { order: MinionsTdOrder; timedOut: boolean }
export interface MinionsTdRoundResult {
  round: number; choices: Record<string, MinionsTdChoice>; towerHits: Record<string, number>; baseDamage: Record<string, number>;
  health: Record<string, number>; gold: Record<string, number>; towerLevels: Record<string, number>; waves: Record<string, MinionsTdUnit[]>; timedOut: boolean;
}
export interface MinionsTdMatch {
  matchId: string; players: string[]; round: number; roundCount: 6; phase: "choosing" | "revealed" | "complete";
  health: Record<string, number>; gold: Record<string, number>; towerLevels: Record<string, number>; waves: Record<string, MinionsTdUnit[]>;
  towerHits: Record<string, number>; choices: Record<string, MinionsTdOrder>; deadline: number; updatedAt: number; version: number;
  roundResults: MinionsTdRoundResult[];
  result?: { matchId: string; winnerPlayerId: string | null; outcome: "knockout" | "points" | "draw"; health: Record<string, number>; gold: Record<string, number>; roundsPlayed: number };
}
export type MinionsTdMutation = { ok: true; state: MinionsTdMatch } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "ROUND_MISMATCH" | "ROUND_CLOSED" | "UNAUTHORIZED" | "ALREADY_LOCKED" | "INSUFFICIENT_GOLD" | "TOWER_MAXED" | "TOO_EARLY" };
export type MinionsTdSnapshotRole = { role: "host" | "spectator" } | { role: "player"; playerId: string };

export const MINIONS_TD_UNITS = [
  { id: "runner", name: "Swiftling", cost: 2, health: 3, speed: 2, damage: 1, description: "Fast and light: reaches the core in three waves." },
  { id: "brute", name: "Bulwark", cost: 3, health: 5, speed: 1, damage: 2, description: "A sturdy frontliner that can absorb tower fire." },
  { id: "siege", name: "Siege Beast", cost: 5, health: 7, speed: 1, damage: 3, description: "Slow, tough, and devastating at the enemy core." },
] as const;
const unitById = (id: string) => MINIONS_TD_UNITS.find((unit) => unit.id === id);
const clone = <T,>(value: T): T => structuredClone(value);
const sameNumbers = (a: Record<string, number>, b: Record<string, number>, players: string[]) => players.every((id) => a[id] === b[id]) && Object.keys(a).length === players.length;
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const sameState = (a: unknown, b: unknown) => canonical(a) === canonical(b);
const isOrder = (value: unknown): value is MinionsTdOrder => {
  if (!value || typeof value !== "object") return false;
  const order = value as MinionsTdOrder;
  if (order.type === "deploy") return Object.keys(value).length === 2 && typeof order.unitId === "string" && Boolean(unitById(order.unitId));
  return Object.keys(value).length === 1 && ["upgrade", "brace", "hold"].includes(order.type);
};
const orderCost = (order: MinionsTdOrder) => order.type === "deploy" ? unitById(order.unitId)!.cost : order.type === "upgrade" ? 3 : order.type === "brace" ? 2 : 0;
const cloneOrder = (order: MinionsTdOrder): MinionsTdOrder => order.type === "deploy" ? { type: "deploy", unitId: order.unitId } : { type: order.type };

export function createMinionsTdMatch(input: { matchId: string; players: string[]; now: number }): MinionsTdMatch {
  if (!input || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < 2 || input.players.length > MINIONS_TD_PLAYERS || new Set(input.players).size !== input.players.length || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - MINIONS_TD_ROUND_MS) throw new Error("INVALID_INPUT");
  return {
    matchId: input.matchId, players: [...input.players], round: 1, roundCount: MINIONS_TD_ROUNDS, phase: "choosing",
    health: Object.fromEntries(input.players.map((id) => [id, MINIONS_TD_BASE_HEALTH])),
    gold: Object.fromEntries(input.players.map((id) => [id, 4])),
    towerLevels: Object.fromEntries(input.players.map((id) => [id, 1])),
    waves: Object.fromEntries(input.players.map((id) => [id, []])),
    towerHits: Object.fromEntries(input.players.map((id) => [id, 0])), choices: {}, deadline: input.now + MINIONS_TD_ROUND_MS,
    updatedAt: input.now, version: 0, roundResults: [],
  };
}

export function submitMinionsTdOrder(match: MinionsTdMatch, input: { matchId: string; round: number; playerId: string; order: MinionsTdOrder; now: number }): MinionsTdMutation {
  if (!isValidMinionsTdMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input.matchId || input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.round !== match.round) return { ok: false, code: "ROUND_MISMATCH" };
  if (!match.players.includes(input.playerId) || match.health[input.playerId] === 0) return { ok: false, code: "UNAUTHORIZED" };
  if (!isOrder(input.order) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > match.deadline) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "ROUND_CLOSED" };
  if (Object.hasOwn(match.choices, input.playerId)) return { ok: false, code: "ALREADY_LOCKED" };
  if (input.order.type === "upgrade" && match.towerLevels[input.playerId] === MINIONS_TD_MAX_TOWER_LEVEL) return { ok: false, code: "TOWER_MAXED" };
  if (orderCost(input.order) > match.gold[input.playerId]!) return { ok: false, code: "INSUFFICIENT_GOLD" };
  const next = clone(match); next.choices[input.playerId] = cloneOrder(input.order); next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}

function resolveCombat(match: MinionsTdMatch, now: number): MinionsTdMatch {
  const choices = Object.fromEntries(match.players.map((id) => [id, { order: cloneOrder(match.choices[id] ?? { type: "hold" }), timedOut: match.health[id]! > 0 && !Object.hasOwn(match.choices, id) }])) as Record<string, MinionsTdChoice>;
  const health = { ...match.health }, gold = { ...match.gold }, towerLevels = { ...match.towerLevels };
  const waves = Object.fromEntries(match.players.map((id) => [id, clone(match.waves[id] ?? [])])) as Record<string, MinionsTdUnit[]>;
  const towerHits = Object.fromEntries(match.players.map((id) => [id, 0])) as Record<string, number>;
  const baseDamage = Object.fromEntries(match.players.map((id) => [id, 0])) as Record<string, number>;
  for (const id of match.players) {
    if (match.health[id] === 0) { waves[id] = []; continue; }
    const { order } = choices[id]!;
    gold[id] = gold[id]! - orderCost(order);
    if (order.type === "deploy") {
      const unit = unitById(order.unitId)!;
      waves[id]!.push({ id: `${match.round}-${id}-${unit.id}`, unitId: unit.id, health: unit.health, position: 0, speed: unit.speed, damage: unit.damage });
    } else if (order.type === "upgrade") towerLevels[id] = towerLevels[id]! + 1;
    else if (order.type === "hold") gold[id] = Math.min(MINIONS_TD_MAX_GOLD, gold[id]! + 1);
  }
  // Each side advances its attacking wave. Units that reach a base strike first;
  // the opposing tower then fires once at the closest surviving minion.
  const targets = minionsTdTargets(match.players, match.health);
  for (const attacker of match.players) {
    const defender = targets[attacker];
    if (!defender) continue;
    const survivors: MinionsTdUnit[] = [];
    for (const unit of waves[attacker]!) {
      const moved = { ...unit, position: Math.min(MINIONS_TD_LANE_LENGTH, unit.position + unit.speed) };
      if (moved.position >= MINIONS_TD_LANE_LENGTH) baseDamage[defender] = baseDamage[defender]! + moved.damage;
      else survivors.push(moved);
    }
    waves[attacker] = survivors;
    const target = survivors.slice().sort((a, b) => b.position - a.position || a.id.localeCompare(b.id))[0];
    if (target) {
      const damage = towerLevels[defender]!;
      target.health -= damage; towerHits[defender] = damage;
      waves[attacker] = survivors.filter((unit) => unit.health > 0);
    }
  }
  for (const defender of match.players) {
    const braced = choices[defender]!.order.type === "brace" ? 2 : 0;
    health[defender] = Math.max(0, health[defender]! - Math.max(0, baseDamage[defender]! - braced));
  }
  const result: MinionsTdRoundResult = { round: match.round, choices, towerHits, baseDamage, health: { ...health }, gold: { ...gold }, towerLevels: { ...towerLevels }, waves: clone(waves), timedOut: match.players.some((id) => choices[id]!.timedOut) };
  const state: MinionsTdMatch = { ...match, health, gold, towerLevels, waves, towerHits, choices: {}, roundResults: [...match.roundResults, result], phase: "revealed", updatedAt: now, version: match.version + 1 };
  const knockout = match.players.filter((id) => health[id]! > 0).length <= 1;
  if (knockout || match.round === MINIONS_TD_ROUNDS) return finish(state, now, knockout ? "knockout" : "points");
  return state;
}

export function resolveMinionsTdRound(match: MinionsTdMatch, input: { now: number }): MinionsTdMutation {
  if (!isValidMinionsTdMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "ROUND_CLOSED" };
  if (match.players.some((id) => match.health[id]! > 0 && !Object.hasOwn(match.choices, id)) && input.now < match.deadline + MINIONS_TD_RECOVERY_MS) return { ok: false, code: "TOO_EARLY" };
  return { ok: true, state: resolveCombat(match, input.now) };
}

export function advanceMinionsTdRound(match: MinionsTdMatch, input: { transition: "reveal" | "next"; now: number }): MinionsTdMutation {
  if (!isValidMinionsTdMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.transition === "reveal") return resolveMinionsTdRound(match, input);
  if (match.phase !== "revealed" || match.round >= MINIONS_TD_ROUNDS) return { ok: false, code: "ROUND_CLOSED" };
  return { ok: true, state: nextRound(match, input.now) };
}
function nextRound(match: MinionsTdMatch, now: number): MinionsTdMatch {
  const next = clone(match); next.round += 1; next.phase = "choosing"; next.choices = {}; next.towerHits = Object.fromEntries(match.players.map((id) => [id, 0]));
  for (const id of match.players) if (match.health[id]! > 0) next.gold[id] = Math.min(MINIONS_TD_MAX_GOLD, next.gold[id]! + 2);
  next.deadline = now + MINIONS_TD_ROUND_MS; next.updatedAt = now; next.version += 1;
  return next;
}

export function minionsTdTargets(players: readonly string[], health: Record<string, number>): Record<string, string | null> {
  const alive = players.filter((id) => health[id]! > 0);
  return Object.fromEntries(players.map((id) => [id, alive.includes(id) && alive.length > 1 ? alive[(alive.indexOf(id) + 1) % alive.length]! : null]));
}
function winnerFor(match: MinionsTdMatch): string | null {
  const remaining = (id: string) => match.gold[id]! + match.towerLevels[id]! + (match.waves[id] ?? []).reduce((sum, unit) => sum + unit.health, 0);
  const ordered = match.players.filter((id) => match.health[id]! > 0).sort((a, b) => match.health[b]! - match.health[a]! || remaining(b) - remaining(a));
  return ordered.length && (!ordered[1] || match.health[ordered[0]!] !== match.health[ordered[1]] || remaining(ordered[0]!) !== remaining(ordered[1])) ? ordered[0]! : null;
}
function finish(match: MinionsTdMatch, now: number, outcome: "knockout" | "points") {
  const winnerPlayerId = winnerFor(match);
  return { ...match, phase: "complete" as const, updatedAt: now, version: match.version + 1, result: { matchId: match.matchId, winnerPlayerId, outcome: winnerPlayerId ? outcome : "draw" as const, health: { ...match.health }, gold: { ...match.gold }, roundsPlayed: match.roundResults.length } };
}

export function minionsTdSnapshot(match: MinionsTdMatch, role: MinionsTdSnapshotRole) {
  const own = role.role === "player" && match.players.includes(role.playerId) ? role.playerId : null;
  return {
    targets: minionsTdTargets(match.players, match.health), matchId: match.matchId, players: [...match.players], round: match.round, roundCount: match.roundCount, phase: match.phase,
    health: { ...match.health }, gold: { ...match.gold }, towerLevels: { ...match.towerLevels }, waves: clone(match.waves), towerHits: { ...match.towerHits },
    units: MINIONS_TD_UNITS.map((unit) => ({ ...unit })), deadline: match.deadline, version: match.version,
    submissionCount: Object.keys(match.choices).length, submitted: own ? Object.hasOwn(match.choices, own) : false,
    ...(own && match.choices[own] ? { ownOrder: clone(match.choices[own]!) } : {}),
    roundResults: match.phase === "choosing" ? match.roundResults.map((result) => clone(result)) : match.roundResults.map((result) => clone(result)),
    ...(match.phase === "revealed" && match.roundResults.length ? { roundResult: clone(match.roundResults.at(-1)!) } : {}),
    ...(match.result ? { result: { ...match.result, health: { ...match.result.health }, gold: { ...match.result.gold } } } : {}),
  };
}

function numericRecord(record: Record<string, number>, players: string[], max: number, min = 0) {
  return record && typeof record === "object" && !Array.isArray(record) && Object.getPrototypeOf(record) === Object.prototype && Object.keys(record).length === players.length && players.every((id) => Number.isInteger(record[id]) && record[id]! >= min && record[id]! <= max);
}
function plainRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype); }
function validUnit(value: MinionsTdUnit) {
  const definition = unitById(value.unitId);
  return Boolean(definition && typeof value.id === "string" && value.id.length <= 256 && Number.isInteger(value.health) && value.health > 0 && value.health <= definition.health && Number.isInteger(value.position) && value.position >= 0 && value.position < MINIONS_TD_LANE_LENGTH && value.speed === definition.speed && value.damage === definition.damage);
}
export function isValidMinionsTdMatch(value: unknown): value is MinionsTdMatch {
  const match = value as MinionsTdMatch;
  if (!match || typeof match !== "object" || !/^[\w-]{1,120}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < 2 || match.players.length > MINIONS_TD_PLAYERS || match.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(match.players).size !== match.players.length || match.roundCount !== MINIONS_TD_ROUNDS || !Number.isInteger(match.round) || match.round < 1 || match.round > MINIONS_TD_ROUNDS || !["choosing", "revealed", "complete"].includes(match.phase) || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || !Number.isInteger(match.version) || match.version < 0 || !Array.isArray(match.roundResults) || match.roundResults.length > MINIONS_TD_ROUNDS) return false;
  if (!numericRecord(match.health, match.players, MINIONS_TD_BASE_HEALTH) || !numericRecord(match.gold, match.players, MINIONS_TD_MAX_GOLD) || !numericRecord(match.towerLevels, match.players, MINIONS_TD_MAX_TOWER_LEVEL, 1) || !numericRecord(match.towerHits, match.players, MINIONS_TD_MAX_TOWER_LEVEL) || !match.choices || !match.waves) return false;
  if (Object.keys(match.choices).some((id) => !match.players.includes(id) || match.health[id] === 0 || !isOrder(match.choices[id]) || orderCost(match.choices[id]!) > match.gold[id]! || (match.choices[id]!.type === "upgrade" && match.towerLevels[id] === MINIONS_TD_MAX_TOWER_LEVEL)) || Object.keys(match.waves).length !== match.players.length || match.players.some((id) => !Array.isArray(match.waves[id]) || match.waves[id]!.length > 30 || match.waves[id]!.some((unit) => !validUnit(unit)))) return false;
  if (match.phase !== "choosing" && Object.keys(match.choices).length) return false;
  if (match.roundResults.some((value, index) => {
    if (!plainRecord(value)) return true;
    const result = value as unknown as MinionsTdRoundResult;
    return result.round !== index + 1 || !plainRecord(result.choices) || Object.keys(result.choices).length !== match.players.length ||
      match.players.some((id) => !plainRecord(result.choices[id]) || !isOrder(result.choices[id]!.order) || typeof result.choices[id]!.timedOut !== "boolean") ||
      !numericRecord(result.towerHits, match.players, MINIONS_TD_MAX_TOWER_LEVEL) || !numericRecord(result.baseDamage, match.players, 90) ||
      !numericRecord(result.health, match.players, MINIONS_TD_BASE_HEALTH) || !numericRecord(result.gold, match.players, MINIONS_TD_MAX_GOLD) ||
      !numericRecord(result.towerLevels, match.players, MINIONS_TD_MAX_TOWER_LEVEL, 1) || !plainRecord(result.waves) || Object.keys(result.waves).length !== match.players.length ||
      match.players.some((id) => !Array.isArray(result.waves[id]) || result.waves[id]!.length > 30 || result.waves[id]!.some((unit) => !validUnit(unit))) ||
      typeof result.timedOut !== "boolean" || result.timedOut !== match.players.some((id) => result.choices[id]!.timedOut);
  })) return false;
  if ((match.phase === "choosing" && match.roundResults.length !== match.round - 1) || (match.phase !== "choosing" && match.roundResults.length !== match.round)) return false;
  if (match.phase === "revealed" || match.phase === "complete") {
    const recent = match.roundResults.at(-1)!;
    if (!sameNumbers(match.health, recent.health, match.players) || !sameNumbers(match.gold, recent.gold, match.players) || !sameNumbers(match.towerLevels, recent.towerLevels, match.players) || !sameNumbers(match.towerHits, recent.towerHits, match.players) || !sameState(match.waves, recent.waves)) return false;
  }
  if ((match.phase === "complete") !== Boolean(match.result)) return false;
  if (match.result) {
    if (!plainRecord(match.result) || match.result.matchId !== match.matchId || !["knockout", "points", "draw"].includes(match.result.outcome) ||
      !sameNumbers(match.result.health, match.health, match.players) || !sameNumbers(match.result.gold, match.gold, match.players) ||
      match.result.roundsPlayed !== match.roundResults.length || match.result.winnerPlayerId !== winnerFor(match)) return false;
    const expectedOutcome = match.result.winnerPlayerId === null ? "draw" : match.players.filter((id) => match.health[id]! > 0).length <= 1 ? "knockout" : "points";
    if (match.result.outcome !== expectedOutcome) return false;
  }
  // Re-run the small six-wave match from its original board. This prevents
  // persisted, well-shaped history from changing combat outcomes or winners.
  let replay = createMinionsTdMatch({ matchId: match.matchId, players: match.players, now: 0 });
  for (const saved of match.roundResults) {
    if (replay.phase !== "choosing" || replay.round !== saved.round) return false;
    for (const id of match.players) {
      const entry = saved.choices[id];
      if (!entry || (entry.timedOut && entry.order.type !== "hold") || (replay.health[id] === 0 && (entry.timedOut || entry.order.type !== "hold"))) return false;
      if (!entry.timedOut && replay.health[id]! > 0) replay.choices[id] = cloneOrder(entry.order);
    }
    const resolved = resolveCombat(replay, replay.updatedAt + 1);
    if (!sameState(resolved.roundResults.at(-1), saved)) return false;
    replay = resolved;
    if (saved !== match.roundResults.at(-1)) {
      if (replay.phase !== "revealed") return false;
      replay = nextRound(replay, replay.updatedAt + 1);
    }
  }
  if (match.phase === "choosing" && match.roundResults.length > 0) {
    if (replay.phase !== "revealed") return false;
    replay = nextRound(replay, replay.updatedAt + 1);
  }
  if (replay.round !== match.round || !sameNumbers(replay.health, match.health, match.players) || !sameNumbers(replay.gold, match.gold, match.players) || !sameNumbers(replay.towerLevels, match.towerLevels, match.players) || !sameNumbers(replay.towerHits, match.towerHits, match.players) || !sameState(replay.waves, match.waves)) return false;
  for (const id of Object.keys(match.choices)) if (orderCost(match.choices[id]!) > replay.gold[id]! || (match.choices[id]!.type === "upgrade" && replay.towerLevels[id] === MINIONS_TD_MAX_TOWER_LEVEL)) return false;
  if (match.phase !== replay.phase) return false;
  return true;
}
