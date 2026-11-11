export const FLATTERFLUFF_PLAYERS_MIN = 2;
export const FLATTERFLUFF_PLAYERS_MAX = 10;
export const FLATTERFLUFF_ROUNDS = 5;
export const FLATTERFLUFF_AIM_DURATION_MS = 12_000;
export const FLATTERFLUFF_TARGETS_PER_ROUND = 5;

export interface FlatterfluffTarget { id: string; x: number; y: number; radius: number; points: number }
export interface FlatterfluffShot { playerId: string; x: number; y: number; hitTargetId: string | null; points: number; timedOut: boolean }
export interface FlatterfluffRoundResult { round: number; outcome: 'revealed' | 'timeout'; targets: FlatterfluffTarget[]; shots: FlatterfluffShot[]; scores: Record<string, number> }
export interface FlatterfluffMatch {
  matchId: string; players: string[]; seed: number; round: number; phase: 'aiming' | 'revealed' | 'complete';
  targets: FlatterfluffTarget[]; shots: Record<string, { x: number; y: number }>;
  deadline: number; updatedAt: number; version: number; scores: Record<string, number>; results: FlatterfluffRoundResult[];
}
export interface FlatterfluffResult extends FlatterfluffRoundResult { winners: string[]; roundResults: FlatterfluffRoundResult[] }
export interface FlatterfluffSnapshot {
  matchId: string; round: number; roundTotal: 5; phase: FlatterfluffMatch['phase']; players: string[];
  targets: FlatterfluffTarget[]; deadline: number; version: number; submitted: boolean; submittedCount: number;
  ownShot?: { x: number; y: number }; result?: FlatterfluffResult;
}
export type FlatterfluffMutation =
  | { ok: true; state: FlatterfluffMatch; idempotent?: boolean }
  | { ok: false; code: 'INVALID_STATE' | 'INVALID_INPUT' | 'MATCH_MISMATCH' | 'ROUND_MISMATCH' | 'ROUND_CLOSED' | 'UNAUTHORIZED' | 'ALREADY_LOCKED' | 'TOO_EARLY' };

const clone = <T,>(value: T): T => structuredClone(value);
const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const validId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && !Object.hasOwn(Object.prototype, value);
const validClock = (now: unknown, updatedAt: number): now is number => Number.isSafeInteger(now) && typeof now === 'number' && now >= updatedAt;

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}
function wave(seed: number, round: number): FlatterfluffTarget[] {
  const next = random((seed ^ Math.imul(round, 0x9e3779b1)) >>> 0);
  return Array.from({ length: FLATTERFLUFF_TARGETS_PER_ROUND }, (_, index) => {
    const radius = 0.075 + Math.floor(next() * 4) * 0.015;
    return { id: `r${round}-target-${index + 1}`, x: Math.round((radius + next() * (1 - 2 * radius)) * 1000) / 1000,
      y: Math.round((radius + next() * (1 - 2 * radius)) * 1000) / 1000, radius, points: 100 + Math.floor(next() * 5) * 50 };
  });
}
function scoreShot(targets: readonly FlatterfluffTarget[], x: number, y: number): { hitTargetId: string | null; points: number } {
  const hits = targets.flatMap((target) => {
    const distance = Math.hypot(x - target.x, y - target.y);
    return distance <= target.radius ? [{ target, points: target.points + Math.round((1 - distance / target.radius) * 100) }] : [];
  }).sort((a, b) => b.points - a.points || a.target.id.localeCompare(b.target.id));
  return hits[0] ? { hitTargetId: hits[0].target.id, points: hits[0].points } : { hitTargetId: null, points: 0 };
}
function sameTargets(candidate: unknown, expected: FlatterfluffTarget[]): candidate is FlatterfluffTarget[] {
  return Array.isArray(candidate) && candidate.length === expected.length && candidate.every((target, index) => isPlain(target) &&
    target.id === expected[index]!.id && target.x === expected[index]!.x && target.y === expected[index]!.y &&
    target.radius === expected[index]!.radius && target.points === expected[index]!.points);
}
function validResult(candidate: unknown, round: number, players: string[], seed: number): candidate is FlatterfluffRoundResult {
  if (!isPlain(candidate) || candidate.round !== round || !['revealed', 'timeout'].includes(String(candidate.outcome)) || !sameTargets(candidate.targets, wave(seed, round)) ||
    !Array.isArray(candidate.shots) || candidate.shots.length !== players.length || !isPlain(candidate.scores)) return false;
  const seen = new Set<string>();
  const shots = candidate.shots as unknown as FlatterfluffShot[];
  if (Object.keys(candidate.scores).length !== players.length || !players.every((id) => Object.hasOwn(candidate.scores as object, id)) ||
    !shots.every((shot) => isPlain(shot) && players.includes(shot.playerId) && !seen.has(shot.playerId) && seen.add(shot.playerId) &&
    typeof shot.x === 'number' && Number.isFinite(shot.x) && shot.x >= 0 && shot.x <= 1 &&
    typeof shot.y === 'number' && Number.isFinite(shot.y) && shot.y >= 0 && shot.y <= 1 && typeof shot.timedOut === 'boolean' &&
    (shot.timedOut ? shot.x === 0 && shot.y === 0 && shot.hitTargetId === null && shot.points === 0 : (() => {
      const score = scoreShot(candidate.targets as FlatterfluffTarget[], shot.x, shot.y);
      return shot.hitTargetId === score.hitTargetId && shot.points === score.points;
    })()))) return false;
  const shotsTimedOut = shots.some((shot) => shot.timedOut);
  if ((candidate.outcome === 'timeout') !== shotsTimedOut) return false;
  const scores = candidate.scores as Record<string, unknown>;
  return players.every((id) => Number.isSafeInteger(scores[id]) && (scores[id] as number) >= 0);
}
function validMatch(match: FlatterfluffMatch): boolean {
  if (!match || !/^[\w-]{1,120}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < FLATTERFLUFF_PLAYERS_MIN ||
    match.players.length > FLATTERFLUFF_PLAYERS_MAX || !match.players.every(validId) || new Set(match.players).size !== match.players.length ||
    !Number.isSafeInteger(match.seed) || !Number.isSafeInteger(match.round) || match.round < 1 || match.round > FLATTERFLUFF_ROUNDS ||
    !['aiming', 'revealed', 'complete'].includes(match.phase) || !sameTargets(match.targets, wave(match.seed, match.round)) || !isPlain(match.shots) ||
    !isPlain(match.scores) || Object.keys(match.scores).length !== match.players.length || !match.players.every((id) => Object.hasOwn(match.scores, id) && Number.isSafeInteger(match.scores[id]) && match.scores[id]! >= 0) ||
    !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || match.updatedAt < 0 ||
    !Number.isSafeInteger(match.version) || match.version < 0 || !Array.isArray(match.results) ||
    match.results.length !== match.round - (match.phase === 'aiming' ? 1 : 0) ||
    Object.keys(match.shots).some((id) => !match.players.includes(id)) ||
    Object.values(match.shots).some((shot) => !isPlain(shot) || !Number.isFinite(shot.x) || shot.x < 0 || shot.x > 1 || !Number.isFinite(shot.y) || shot.y < 0 || shot.y > 1)) return false;
  if (!match.results.every((result, index) => {
    if (!validResult(result, index + 1, match.players, match.seed)) return false;
    const cumulative = Object.fromEntries(match.players.map((id) => [id,
      match.results.slice(0, index + 1).reduce((sum, roundResult) => sum + (roundResult.shots.find((shot) => shot.playerId === id)?.points ?? 0), 0)]));
    return match.players.every((id) => result.scores[id] === cumulative[id]);
  })) return false;
  const expectedScores = Object.fromEntries(match.players.map((id) => [id, match.results.reduce((sum, result) => sum + (result.shots.find((shot) => shot.playerId === id)?.points ?? 0), 0)]));
  if (match.players.some((id) => match.scores[id] !== expectedScores[id])) return false;
  if (match.phase === 'aiming') return match.deadline >= match.updatedAt && match.results.length === match.round - 1;
  if (match.deadline !== match.updatedAt || match.results.length !== match.round ||
    (match.phase === 'complete') !== (match.round === FLATTERFLUFF_ROUNDS)) return false;
  const current = match.results[match.round - 1]!;
  if (current.outcome === 'revealed' && Object.keys(match.shots).length !== match.players.length) return false;
  return match.players.every((id) => {
    const shot = match.shots[id]; const outcome = current.shots.find((entry) => entry.playerId === id)!;
    return shot ? !outcome.timedOut && outcome.x === shot.x && outcome.y === shot.y : outcome.timedOut;
  });
}
export function isValidFlatterfluffMatch(value: unknown): value is FlatterfluffMatch {
  return Boolean(value && typeof value === 'object' && validMatch(value as FlatterfluffMatch));
}
function makeResult(match: FlatterfluffMatch, outcome: 'revealed' | 'timeout', now: number): FlatterfluffMatch {
  const shots = match.players.map((playerId) => {
    const shot = match.shots[playerId];
    const aim = shot ?? { x: 0, y: 0 };
    const score = shot ? scoreShot(match.targets, shot.x, shot.y) : { hitTargetId: null, points: 0 };
    return { playerId, ...aim, ...score, timedOut: !shot };
  });
  const next = clone(match);
  for (const shot of shots) next.scores[shot.playerId] = (next.scores[shot.playerId] ?? 0) + shot.points;
  next.results.push({ round: match.round, outcome, targets: clone(match.targets), shots, scores: { ...next.scores } });
  next.phase = match.round === FLATTERFLUFF_ROUNDS ? 'complete' : 'revealed';
  next.deadline = now; next.updatedAt = now; next.version += 1;
  return next;
}

export function createFlatterfluffMatch(input: { matchId: string; players: string[]; now: number; seed: number }): FlatterfluffMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) ||
    input.players.length < FLATTERFLUFF_PLAYERS_MIN || input.players.length > FLATTERFLUFF_PLAYERS_MAX || !input.players.every(validId) ||
    new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 ||
    input.now > Number.MAX_SAFE_INTEGER - FLATTERFLUFF_AIM_DURATION_MS || !Number.isSafeInteger(input.seed)) throw new TypeError('Invalid Flatterfluff match setup');
  return { matchId: input.matchId, players: [...input.players], seed: input.seed, round: 1, phase: 'aiming', targets: wave(input.seed, 1), shots: {},
    deadline: input.now + FLATTERFLUFF_AIM_DURATION_MS, updatedAt: input.now, version: 0,
    scores: Object.fromEntries(input.players.map((id) => [id, 0])), results: [] };
}

export function fireFlatterfluffShot(match: FlatterfluffMatch, input: { matchId: string; round: number; playerId: string; x: number; y: number; now: number }): FlatterfluffMutation {
  if (!validMatch(match)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validId(input.playerId) ||
    !Number.isSafeInteger(input.round) || !validClock(input.now, match.updatedAt) || !Number.isFinite(input.x) || !Number.isFinite(input.y) ||
    input.x < 0 || input.x > 1 || input.y < 0 || input.y > 1) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== match.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== match.round) return { ok: false, code: 'ROUND_MISMATCH' };
  if (!match.players.includes(input.playerId)) return { ok: false, code: 'UNAUTHORIZED' };
  const prior = match.shots[input.playerId];
  const x = Math.round(input.x * 1000) / 1000; const y = Math.round(input.y * 1000) / 1000;
  if (prior) return prior.x === x && prior.y === y ? { ok: true, state: match, idempotent: true } : { ok: false, code: 'ALREADY_LOCKED' };
  if (match.phase !== 'aiming' || input.now >= match.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(match); next.shots[input.playerId] = { x, y }; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}

export function revealFlatterfluffRound(match: FlatterfluffMatch, input: { now: number }): FlatterfluffMutation {
  if (!validMatch(match)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, match.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (match.phase !== 'aiming') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now >= match.deadline && Object.keys(match.shots).length < match.players.length) return { ok: false, code: 'TOO_EARLY' };
  return { ok: true, state: makeResult(match, Object.keys(match.shots).length < match.players.length ? 'timeout' : 'revealed', input.now) };
}

export function advanceFlatterfluffRound(match: FlatterfluffMatch, input: { now: number }): FlatterfluffMutation {
  if (!validMatch(match)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, match.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (match.phase !== 'aiming') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now < match.deadline) return { ok: false, code: 'TOO_EARLY' };
  return { ok: true, state: makeResult(match, Object.keys(match.shots).length < match.players.length ? 'timeout' : 'revealed', input.now) };
}

export function nextFlatterfluffRound(match: FlatterfluffMatch, input: { now: number }): FlatterfluffMutation {
  if (!validMatch(match)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, match.updatedAt) || input.now > Number.MAX_SAFE_INTEGER - FLATTERFLUFF_AIM_DURATION_MS) return { ok: false, code: 'INVALID_INPUT' };
  if (match.phase !== 'revealed' || match.round >= FLATTERFLUFF_ROUNDS) return { ok: false, code: 'ROUND_CLOSED' };
  const round = match.round + 1;
  return { ok: true, state: { ...clone(match), round, phase: 'aiming', targets: wave(match.seed, round), shots: {}, deadline: input.now + FLATTERFLUFF_AIM_DURATION_MS, updatedAt: input.now, version: match.version + 1 } };
}

export function flatterfluffSnapshot(match: FlatterfluffMatch, viewer: { role: 'host' | 'spectator' } | { role: 'player'; playerId: string }): FlatterfluffSnapshot {
  if (!validMatch(match) || !viewer || !['host', 'spectator', 'player'].includes(viewer.role)) throw new TypeError('Invalid Flatterfluff snapshot request');
  if (viewer.role === 'player' && (!validId(viewer.playerId) || !match.players.includes(viewer.playerId))) throw new TypeError('Flatterfluff player is not assigned');
  const playerId = viewer.role === 'player' ? viewer.playerId : undefined;
  const ownShot = playerId ? match.shots[playerId] : undefined;
  return { matchId: match.matchId, round: match.round, roundTotal: FLATTERFLUFF_ROUNDS, phase: match.phase, players: [...match.players],
    targets: clone(match.targets), deadline: match.deadline, version: match.version, submitted: Boolean(ownShot), submittedCount: Object.keys(match.shots).length,
    ...(ownShot ? { ownShot: { ...ownShot } } : {}), ...(match.phase !== 'aiming' ? { result: getFlatterfluffResult(match) } : {}) };
}

export function getFlatterfluffResult(match: FlatterfluffMatch): FlatterfluffResult {
  if (!validMatch(match) || match.phase === 'aiming' || match.results.length !== match.round) throw new TypeError('Flatterfluff result is not ready');
  const current = match.results[match.round - 1]!;
  const best = Math.max(...Object.values(match.scores));
  return { ...clone(current), winners: match.phase === 'complete' ? match.players.filter((id) => match.scores[id] === best) : [], roundResults: clone(match.results) };
}
