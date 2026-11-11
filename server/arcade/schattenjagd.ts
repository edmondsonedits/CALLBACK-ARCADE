export const SCHATTENJAGD_MIN_PLAYERS = 2;
export const SCHATTENJAGD_MAX_PLAYERS = 10;
export const SCHATTENJAGD_CASES = 4;
export const SCHATTENJAGD_CASE_MS = 40_000;
export const SCHATTENJAGD_CORRECT_POINTS = 100;
export const SCHATTENJAGD_TEAM_BONUS = 50;

export type SchattenjagdField = "trace" | "route";
export interface SchattenjagdSuspect { id: string; name: string; trace: string; route: string }
export interface SchattenjagdClue { id: string; text: string; field: SchattenjagdField; value: string }
export interface SchattenjagdCase { id: string; title: string; briefing: string; suspects: SchattenjagdSuspect[]; clues: SchattenjagdClue[]; targetId: string }
export interface SchattenjagdVote { playerId: string; suspectId: string | null; timedOut: boolean; correct: boolean; points: number }
export interface SchattenjagdCaseResult { round: number; caseId: string; targetId: string; timedOut: boolean; correctCount: number; teamBonusApplied: boolean; votes: SchattenjagdVote[]; scores: Record<string, number> }
export interface SchattenjagdMatch {
  matchId: string; players: string[]; round: number; phase: "choosing" | "revealed" | "complete"; cases: SchattenjagdCase[];
  choices: Record<string, string>; scores: Record<string, number>; deadline: number; updatedAt: number; version: number;
  caseResults: SchattenjagdCaseResult[]; result?: { matchId: string; scores: Record<string, number>; winners: string[]; casesPlayed: 4; cases: SchattenjagdCaseResult[] };
}
export type SchattenjagdMutation = { ok: true; state: SchattenjagdMatch; idempotent?: boolean } | { ok: false; code: "INVALID_STATE" | "INVALID_INPUT" | "MATCH_MISMATCH" | "ROUND_MISMATCH" | "ROUND_CLOSED" | "UNAUTHORIZED" | "INVALID_SUSPECT" | "ALREADY_LOCKED" | "TOO_EARLY" };

// Original case files. Each private fact narrows the board; together the two
// facts identify exactly one suspect. These clues and names are first-party.
export const SCHATTENJAGD_CASE_LIBRARY: readonly SchattenjagdCase[] = [
  { id: "lantern-mile", title: "The Lantern Mile", briefing: "A figure crossed the old mile road just before the lamps went dark.", suspects: [{ id: "ash-cap", name: "Ash Cap", trace: "chalk", route: "uphill" }, { id: "moss-veil", name: "Moss Veil", trace: "fern", route: "downhill" }, { id: "hollow-kite", name: "Hollow Kite", trace: "fern", route: "uphill" }], clues: [{ id: "fern-trace", text: "A crushed fern marked the crossing.", field: "trace", value: "fern" }, { id: "uphill-route", text: "The figure moved uphill, against the stream.", field: "route", value: "uphill" }], targetId: "hollow-kite" },
  { id: "glass-orchard", title: "The Glass Orchard", briefing: "The orchard's bell chimes stopped while a shadow slipped between the panes.", suspects: [{ id: "rain-cinder", name: "Rain Cinder", trace: "rain", route: "east" }, { id: "smoke-flint", name: "Smoke Flint", trace: "smoke", route: "west" }, { id: "west-cinder", name: "West Cinder", trace: "rain", route: "west" }], clues: [{ id: "rain-trace", text: "The broken glass held a trace of rainwater.", field: "trace", value: "rain" }, { id: "west-route", text: "The shadow left toward the western gate.", field: "route", value: "west" }], targetId: "west-cinder" },
  { id: "bell-bridge", title: "The Bell Bridge", briefing: "Someone crossed the bridge without waking its hanging bells.", suspects: [{ id: "soot-tunnel", name: "Soot Tunnel", trace: "soot", route: "underbridge" }, { id: "reed-water", name: "Reed Water", trace: "reed", route: "shore" }, { id: "reed-tunnel", name: "Reed Tunnel", trace: "reed", route: "underbridge" }], clues: [{ id: "reed-trace", text: "A strand of river reed caught on the railing.", field: "trace", value: "reed" }, { id: "underbridge-route", text: "The crossing continued beneath the bridge.", field: "route", value: "underbridge" }], targetId: "reed-tunnel" },
  { id: "moonwater-steps", title: "The Moonwater Steps", briefing: "The tide covered the lowest steps before anyone could follow the final footprints.", suspects: [{ id: "frost-stair", name: "Frost Stair", trace: "frost", route: "stairway" }, { id: "ink-shore", name: "Ink Shore", trace: "ink", route: "shoreline" }, { id: "ink-stair", name: "Ink Stair", trace: "ink", route: "stairway" }], clues: [{ id: "ink-trace", text: "Dark ink pooled where the trail began.", field: "trace", value: "ink" }, { id: "stairway-route", text: "The last prints climbed the narrow steps.", field: "route", value: "stairway" }], targetId: "ink-stair" },
];

const clone = <T,>(value: T): T => structuredClone(value);
function sameScores(actual: Record<string, number>, expected: Record<string, number>, players: string[]): boolean { return Object.keys(actual).length === players.length && players.every((id) => actual[id] === expected[id]); }
function sameCaseResult(actual: SchattenjagdCaseResult, expected: SchattenjagdCaseResult, players: string[]): boolean {
  return actual.round === expected.round && actual.caseId === expected.caseId && actual.targetId === expected.targetId && actual.timedOut === expected.timedOut && actual.correctCount === expected.correctCount && actual.teamBonusApplied === expected.teamBonusApplied && sameScores(actual.scores, expected.scores, players) && actual.votes.length === expected.votes.length && actual.votes.every((vote, index) => { const other = expected.votes[index]; return Boolean(other) && vote.playerId === other!.playerId && vote.suspectId === other!.suspectId && vote.timedOut === other!.timedOut && vote.correct === other!.correct && vote.points === other!.points; });
}
function expectedCaseResult(match: SchattenjagdMatch, round: number, choices: Record<string, string>, previousScores: Record<string, number>, timedOut: boolean): SchattenjagdCaseResult {
  const scenario = match.cases[round - 1]!;
  const correctCount = match.players.filter((id) => choices[id] === scenario.targetId).length;
  const teamBonusApplied = correctCount >= Math.ceil(match.players.length / 2);
  const votes = match.players.map((playerId) => { const suspectId = choices[playerId] ?? null; const correct = suspectId === scenario.targetId; return { playerId, suspectId, timedOut: suspectId === null, correct, points: (correct ? SCHATTENJAGD_CORRECT_POINTS : 0) + (teamBonusApplied && suspectId !== null ? SCHATTENJAGD_TEAM_BONUS : 0) }; });
  const scores = { ...previousScores };
  for (const vote of votes) scores[vote.playerId]! += vote.points;
  return { round, caseId: scenario.id, targetId: scenario.targetId, timedOut, correctCount, teamBonusApplied, votes, scores };
}
function exactCaseFiles(cases: SchattenjagdCase[]): boolean {
  return cases.length === SCHATTENJAGD_CASE_LIBRARY.length && cases.every((scenario, index) => JSON.stringify(scenario) === JSON.stringify(SCHATTENJAGD_CASE_LIBRARY[index]));
}

/** Shared engine/D1 trust-boundary validator. */
export function isValidSchattenjagdMatch(value: unknown): value is SchattenjagdMatch {
  const match = value as SchattenjagdMatch;
  if (!match || typeof match !== "object" || !/^[\w-]{1,120}$/.test(match.matchId) || !Array.isArray(match.players) || match.players.length < SCHATTENJAGD_MIN_PLAYERS || match.players.length > SCHATTENJAGD_MAX_PLAYERS || new Set(match.players).size !== match.players.length || match.players.some((id) => typeof id !== "string" || !id.trim()) || !Number.isInteger(match.round) || match.round < 1 || match.round > SCHATTENJAGD_CASES || !["choosing", "revealed", "complete"].includes(match.phase) || !Array.isArray(match.cases) || !exactCaseFiles(match.cases) || !match.choices || typeof match.choices !== "object" || !match.scores || typeof match.scores !== "object" || !Array.isArray(match.caseResults) || !Number.isSafeInteger(match.deadline) || !Number.isSafeInteger(match.updatedAt) || match.deadline < match.updatedAt || !Number.isInteger(match.version) || match.version < 0) return false;
  if (Object.keys(match.choices).some((id) => !match.players.includes(id) || !match.cases[match.round - 1]!.suspects.some((suspect) => suspect.id === match.choices[id]))) return false;
  if (match.caseResults.length !== (match.phase === "choosing" ? match.round - 1 : match.round) || (match.phase === "choosing" && (match.deadline < match.updatedAt || match.result)) || (match.phase !== "choosing" && match.deadline !== match.updatedAt) || (match.phase === "complete") !== Boolean(match.result)) return false;
  let totals = Object.fromEntries(match.players.map((id) => [id, 0])) as Record<string, number>;
  for (const [index, stored] of match.caseResults.entries()) {
    if (!stored || !Array.isArray(stored.votes) || stored.votes.length !== match.players.length || stored.votes.some((vote, seat) => !vote || vote.playerId !== match.players[seat] || (vote.suspectId !== null && !match.cases[index]!.suspects.some((suspect) => suspect.id === vote.suspectId)) || (vote.timedOut && vote.suspectId !== null))) return false;
    const choices = Object.fromEntries(stored.votes.filter((vote) => vote.suspectId !== null).map((vote) => [vote.playerId, vote.suspectId!])) as Record<string, string>;
    const expected = expectedCaseResult(match, index + 1, choices, totals, stored.timedOut);
    if (!sameCaseResult(stored, expected, match.players) || stored.timedOut !== stored.votes.some((vote) => vote.timedOut)) return false;
    totals = expected.scores;
  }
  if (!sameScores(match.scores, totals, match.players)) return false;
  if (match.phase !== "choosing") {
    const last = match.caseResults[match.round - 1]!;
    if (last.votes.some((vote) => vote.timedOut ? Object.hasOwn(match.choices, vote.playerId) : !Object.hasOwn(match.choices, vote.playerId) || match.choices[vote.playerId] !== vote.suspectId)) return false;
  }
  if (!match.result) return true;
  const max = Math.max(...Object.values(match.scores));
  const winners = match.players.filter((id) => match.scores[id] === max);
  return match.result.matchId === match.matchId && match.result.casesPlayed === SCHATTENJAGD_CASES && sameScores(match.result.scores, match.scores, match.players) && winners.length === match.result.winners.length && winners.every((id, index) => id === match.result!.winners[index]) && match.result.cases.length === SCHATTENJAGD_CASES && match.result.cases.every((item, index) => sameCaseResult(item, match.caseResults[index]!, match.players));
}

export function createSchattenjagdMatch(input: { matchId: string; players: string[]; now: number }): SchattenjagdMatch {
  if (!input || !/^[\w-]{1,120}$/.test(input.matchId) || !Array.isArray(input.players) || input.players.length < SCHATTENJAGD_MIN_PLAYERS || input.players.length > SCHATTENJAGD_MAX_PLAYERS || input.players.some((id) => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - SCHATTENJAGD_CASE_MS) throw new TypeError("Schattenjagd requires 2–10 players and a safe clock");
  const match: SchattenjagdMatch = { matchId: input.matchId, players: [...input.players], round: 1, phase: "choosing", cases: clone([...SCHATTENJAGD_CASE_LIBRARY]), choices: {}, scores: Object.fromEntries(input.players.map((id) => [id, 0])), deadline: input.now + SCHATTENJAGD_CASE_MS, updatedAt: input.now, version: 0, caseResults: [] };
  if (!isValidSchattenjagdMatch(match)) throw new TypeError("Could not create a valid Schattenjagd match");
  return match;
}
export function chooseSchattenjagdSuspect(match: SchattenjagdMatch, input: { matchId: string; round: number; playerId: string; suspectId: string; now: number }): SchattenjagdMutation {
  if (!isValidSchattenjagdMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || typeof input.matchId !== "string" || typeof input.playerId !== "string" || typeof input.suspectId !== "string" || !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (input.matchId !== match.matchId) return { ok: false, code: "MATCH_MISMATCH" };
  if (input.round !== match.round) return { ok: false, code: "ROUND_MISMATCH" };
  if (!match.players.includes(input.playerId)) return { ok: false, code: "UNAUTHORIZED" };
  if (match.phase !== "choosing" || input.now >= match.deadline) return { ok: false, code: "ROUND_CLOSED" };
  if (Object.hasOwn(match.choices, input.playerId)) return match.choices[input.playerId] === input.suspectId ? { ok: true, state: match, idempotent: true } : { ok: false, code: "ALREADY_LOCKED" };
  if (!match.cases[match.round - 1]!.suspects.some((suspect) => suspect.id === input.suspectId)) return { ok: false, code: "INVALID_SUSPECT" };
  const next = clone(match); next.choices[input.playerId] = input.suspectId; next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: next };
}
export function revealSchattenjagdCase(match: SchattenjagdMatch, input: { now: number }): SchattenjagdMutation {
  if (!isValidSchattenjagdMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "choosing") return { ok: false, code: "ROUND_CLOSED" };
  const timedOut = match.players.some((playerId) => !Object.hasOwn(match.choices, playerId));
  if (timedOut && input.now < match.deadline) return { ok: false, code: "TOO_EARLY" };
  const previousScores = match.caseResults.at(-1)?.scores ?? match.scores;
  const result = expectedCaseResult(match, match.round, match.choices, previousScores, timedOut);
  const next = clone(match); next.scores = { ...result.scores }; next.caseResults.push(result); next.phase = "revealed"; next.deadline = input.now; next.updatedAt = input.now; next.version += 1;
  if (match.round === SCHATTENJAGD_CASES) {
    const max = Math.max(...Object.values(next.scores));
    next.phase = "complete";
    next.result = { matchId: next.matchId, scores: { ...next.scores }, winners: next.players.filter((id) => next.scores[id] === max), casesPlayed: SCHATTENJAGD_CASES, cases: clone(next.caseResults) };
  }
  return { ok: true, state: next };
}
export function nextSchattenjagdCase(match: SchattenjagdMatch, input: { now: number }): SchattenjagdMutation {
  if (!isValidSchattenjagdMatch(match)) return { ok: false, code: "INVALID_STATE" };
  if (!input || !Number.isSafeInteger(input.now) || input.now < match.updatedAt || input.now > Number.MAX_SAFE_INTEGER - SCHATTENJAGD_CASE_MS) return { ok: false, code: "INVALID_INPUT" };
  if (match.phase !== "revealed" || match.round >= SCHATTENJAGD_CASES) return { ok: false, code: "ROUND_CLOSED" };
  return { ok: true, state: { ...clone(match), round: match.round + 1, choices: {}, phase: "choosing", deadline: input.now + SCHATTENJAGD_CASE_MS, updatedAt: input.now, version: match.version + 1 } };
}
export function schattenjagdSnapshot(match: SchattenjagdMatch, viewer: { role: "host" | "spectator" } | { role: "player"; playerId: string }): import("../../lib/contracts").SnapshotSchattenjagd {
  if (!isValidSchattenjagdMatch(match)) throw new TypeError("Invalid Schattenjagd state");
  const scenario = match.cases[match.round - 1]!;
  const revealed = match.phase !== "choosing";
  const base = { matchId: match.matchId, players: [...match.players], round: match.round, roundCount: SCHATTENJAGD_CASES as 4, phase: match.phase, caseId: scenario.id, title: scenario.title, briefing: scenario.briefing, suspects: clone(scenario.suspects), deadline: match.deadline, version: match.version, submissionCount: Object.keys(match.choices).length, submitted: viewer.role === "player" && Object.hasOwn(match.choices, viewer.playerId), scores: { ...match.scores }, caseResults: match.phase === "complete" ? clone(match.caseResults) : [], caseResult: revealed ? clone(match.caseResults.at(-1)) : undefined, result: match.result ? clone(match.result) : undefined };
  if (revealed) return { ...base, clues: clone(scenario.clues), targetId: scenario.targetId };
  if (viewer.role === "player" && match.players.includes(viewer.playerId)) {
    const seat = match.players.indexOf(viewer.playerId);
    return { ...base, ownClue: clone(scenario.clues[seat % scenario.clues.length]!), ownSuspectId: match.choices[viewer.playerId] };
  }
  return base;
}
