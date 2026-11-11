export type SchaetzoramaPrompt = {
  id: string;
  question: string;
  unit: string;
  min: number;
  max: number;
  answer: number;
  sourceUrl?: string;
};

export type SchaetzoramaEstimate = { playerId: string; estimate: number };
export type SchaetzoramaRound = {
  number: number;
  submissions: Record<string, number>;
  winners: string[];
  pointsAwarded: Record<string, number>;
};
export type SchaetzoramaMatch = {
  matchId: string;
  players: string[];
  prompts: SchaetzoramaPrompt[];
  rounds: SchaetzoramaRound[];
  roundCount: 5;
  round: number;
  phase: 'estimating' | 'revealing' | 'completed';
  deadline: number;
  updatedAt: number;
  version: number;
  scores: Record<string, number>;
};

export type SchaetzoramaSnapshot = {
  matchId: string;
  round: number;
  roundCount: number;
  phase: SchaetzoramaMatch['phase'];
  question: string;
  unit: string;
  min: number;
  max: number;
  deadline: number;
  version: number;
  submitted: boolean;
  estimate?: number;
  answer?: number;
  estimates: SchaetzoramaEstimate[];
  winners: string[];
  scores: Record<string, number>;
};

const ROUND_DURATION_MS = 45_000;
const GAME_PLAYERS_MIN = 2;
const GAME_PLAYERS_MAX = 10;

// King Prompter-owned, all-ages prompts. Conversion answers are exact math;
// astronomical targets are explicitly approximate and cite NASA's fact sheet.
export const SCHAETZORAMA_PROMPT_DECK: readonly SchaetzoramaPrompt[] = [
  { id: 'kp-est-01', question: 'How many seconds are in exactly one hour?', unit: 'seconds', min: 1_000, max: 10_000, answer: 3_600 },
  { id: 'kp-est-02', question: 'How many metres are in exactly one kilometre?', unit: 'metres', min: 100, max: 2_000, answer: 1_000 },
  { id: 'kp-est-03', question: 'How many grams are in exactly one kilogram?', unit: 'grams', min: 500, max: 2_000, answer: 1_000 },
  { id: 'kp-est-04', question: 'How many millilitres are in 2.75 litres?', unit: 'millilitres', min: 1_000, max: 5_000, answer: 2_750 },
  { id: 'kp-est-05', question: 'How many minutes are in exactly one week of seven days?', unit: 'minutes', min: 1_000, max: 20_000, answer: 10_080 },
  { id: 'kp-est-06', question: 'How many seconds are in 36 hours?', unit: 'seconds', min: 10_000, max: 1_000_000, answer: 129_600 },
  { id: 'kp-est-07', question: 'How many millimetres are in 4.2 metres?', unit: 'millimetres', min: 500, max: 10_000, answer: 4_200 },
  { id: 'kp-est-08', question: 'How many square centimetres are in one square metre?', unit: 'square centimetres', min: 1_000, max: 20_000, answer: 10_000 },
  { id: 'kp-est-09', question: 'How many minutes are in 48 hours?', unit: 'minutes', min: 500, max: 10_000, answer: 2_880 },
  { id: 'kp-est-10', question: 'How many seconds are in 2.5 days of 24 hours each?', unit: 'seconds', min: 10_000, max: 1_000_000, answer: 216_000 },
  { id: 'kp-est-11', question: 'How many metres are in exactly 42.195 kilometres?', unit: 'metres', min: 10_000, max: 100_000, answer: 42_195 },
  { id: 'kp-est-12', question: 'What is the exact speed of light in a vacuum, in metres per second?', unit: 'metres per second', min: 299_000_000, max: 300_000_000, answer: 299_792_458, sourceUrl: 'https://physics.nist.gov/cuu/Constants/Value/c.html' },
  { id: 'kp-est-13', question: 'According to NASA, what is the Moon\'s average distance from Earth, in kilometres?', unit: 'kilometres', min: 100_000, max: 700_000, answer: 384_400, sourceUrl: 'https://science.nasa.gov/moon/facts/' },
  { id: 'kp-est-14', question: 'According to NASA, what is the Moon\'s approximate mean radius to the nearest 10 kilometres?', unit: 'kilometres', min: 1_000, max: 2_500, answer: 1_740, sourceUrl: 'https://science.nasa.gov/moon/facts/' },
  { id: 'kp-est-15', question: 'Using twice NASA\'s approximate mean radius, what is the Moon\'s approximate diameter to the nearest 10 kilometres?', unit: 'kilometres', min: 1_000, max: 5_000, answer: 3_480, sourceUrl: 'https://science.nasa.gov/moon/facts/' },
];

type FailureCode = 'INVALID_STATE' | 'INVALID_INPUT' | 'STALE_VERSION' | 'ROUND_CLOSED' | 'ALREADY_LOCKED' | 'TOO_EARLY';
type MutationResult = { ok: true; state: SchaetzoramaMatch; idempotent?: boolean } | { ok: false; code: FailureCode };

function validPlayerId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 100 && !Object.hasOwn(Object.prototype, id);
}

function validClock(now: unknown, updatedAt: number): now is number {
  return typeof now === 'number' && Number.isSafeInteger(now) && now >= updatedAt;
}

function isValidMatch(state: SchaetzoramaMatch): boolean {
  return Boolean(
    state && typeof state === 'object' &&
    typeof state.matchId === 'string' && state.matchId.length > 0 &&
    Array.isArray(state.players) && state.players.length >= GAME_PLAYERS_MIN && state.players.length <= GAME_PLAYERS_MAX &&
    new Set(state.players).size === state.players.length && state.players.every(validPlayerId) &&
    Array.isArray(state.prompts) && state.prompts.length === state.roundCount && state.roundCount === 5 &&
    state.prompts.every((prompt) => prompt && typeof prompt.id === 'string' && typeof prompt.question === 'string' &&
      typeof prompt.unit === 'string' && Number.isSafeInteger(prompt.min) && Number.isSafeInteger(prompt.max) &&
      Number.isSafeInteger(prompt.answer) && prompt.min <= prompt.answer && prompt.answer <= prompt.max) &&
    Array.isArray(state.rounds) && state.rounds.length === state.roundCount &&
    state.rounds.every((round, index) => round && round.number === index + 1 && round.submissions &&
      typeof round.submissions === 'object' && Array.isArray(round.winners) && round.pointsAwarded &&
      typeof round.pointsAwarded === 'object') &&
    state.scores && typeof state.scores === 'object' && state.players.every((playerId) => Number.isSafeInteger(state.scores[playerId]) && state.scores[playerId] >= 0) &&
    state.round >= 1 && state.round <= state.roundCount && Number.isSafeInteger(state.version) && state.version >= 0 &&
    Number.isSafeInteger(state.updatedAt) && Number.isSafeInteger(state.deadline) &&
    (state.phase !== 'estimating' || state.deadline >= state.updatedAt) && ['estimating', 'revealing', 'completed'].includes(state.phase)
  );
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const output = [...items];
  let value = seed >>> 0;
  for (let index = output.length - 1; index > 0; index -= 1) {
    value = (value + 0x6d2b79f5) >>> 0;
    let random = value;
    random = Math.imul(random ^ (random >>> 15), random | 1);
    random ^= random + Math.imul(random ^ (random >>> 7), random | 61);
    const fraction = ((random ^ (random >>> 14)) >>> 0) / 4_294_967_296;
    const swap = Math.floor(fraction * (index + 1));
    [output[index], output[swap]] = [output[swap], output[index]];
  }
  return output;
}

export function createSchaetzoramaMatch(input: {
  matchId: string;
  players: string[];
  now: number;
  seed: number;
}): SchaetzoramaMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,100}$/.test(input.matchId) ||
      !Array.isArray(input.players) || input.players.length < GAME_PLAYERS_MIN || input.players.length > GAME_PLAYERS_MAX ||
      !input.players.every(validPlayerId) || new Set(input.players).size !== input.players.length ||
      !Number.isSafeInteger(input.now) || input.now < 0 || !Number.isSafeInteger(input.seed)) {
    throw new TypeError('Invalid Schaetzorama match setup');
  }
  const prompts = seededShuffle(SCHAETZORAMA_PROMPT_DECK, input.seed).slice(0, 5).map((prompt) => ({ ...prompt }));
  const rounds = prompts.map((_, index) => ({ number: index + 1, submissions: {}, winners: [], pointsAwarded: {} }));
  return {
    matchId: input.matchId,
    players: [...input.players],
    prompts,
    rounds,
    roundCount: 5,
    round: 1,
    phase: 'estimating',
    deadline: input.now + ROUND_DURATION_MS,
    updatedAt: input.now,
    version: 0,
    scores: Object.fromEntries(input.players.map((id) => [id, 0])),
  };
}

export function submitSchaetzoramaEstimate(
  state: SchaetzoramaMatch,
  input: { playerId: string; round: number; version: number; estimate: number; now: number },
): MutationResult {
  if (!isValidMatch(state) || !input || !validPlayerId(input.playerId) || !validClock(input.now, state.updatedAt) ||
      !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.version) || !Number.isSafeInteger(input.estimate)) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  if (!state.players.includes(input.playerId)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.round !== state.round) return { ok: false, code: 'ROUND_CLOSED' };
  const current = state.rounds[state.round - 1];
  const existing = current.submissions[input.playerId];
  if (existing !== undefined) {
    return existing === input.estimate
      ? { ok: true, state, idempotent: true }
      : { ok: false, code: 'ALREADY_LOCKED' };
  }
  if (state.phase !== 'estimating' || input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  if (input.version !== state.version) return { ok: false, code: 'STALE_VERSION' };
  const prompt = state.prompts[state.round - 1];
  if (input.estimate < prompt.min || input.estimate > prompt.max) return { ok: false, code: 'INVALID_INPUT' };
  const next = structuredClone(state);
  next.rounds[next.round - 1].submissions[input.playerId] = input.estimate;
  next.updatedAt = input.now;
  next.version += 1;
  return { ok: true, state: next };
}

function revealRound(state: SchaetzoramaMatch, now: number): SchaetzoramaMatch {
  const next = structuredClone(state);
  const round = next.rounds[next.round - 1];
  const answer = next.prompts[next.round - 1].answer;
  const distances = Object.entries(round.submissions).map(([playerId, estimate]) => ({ playerId, distance: Math.abs(estimate - answer) }));
  const closest = distances.length ? Math.min(...distances.map(({ distance }) => distance)) : undefined;
  round.winners = closest === undefined ? [] : distances.filter(({ distance }) => distance === closest).map(({ playerId }) => playerId).sort();
  round.pointsAwarded = Object.fromEntries(round.winners.map((playerId) => [playerId, 1]));
  for (const winner of round.winners) next.scores[winner] += 1;
  next.phase = 'revealing';
  next.updatedAt = now;
  next.version += 1;
  return next;
}

export function advanceSchaetzorama(state: SchaetzoramaMatch, input: { now: number }): MutationResult {
  if (!isValidMatch(state) || !input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'completed') return { ok: false, code: 'ROUND_CLOSED' };
  if (state.phase === 'estimating') {
    const round = state.rounds[state.round - 1];
    const allSubmitted = state.players.every((playerId) => round.submissions[playerId] !== undefined);
    if (!allSubmitted && input.now < state.deadline) return { ok: false, code: 'TOO_EARLY' };
    return { ok: true, state: revealRound(state, input.now) };
  }
  const next = structuredClone(state);
  if (state.round >= state.roundCount) {
    next.phase = 'completed';
    next.updatedAt = input.now;
    next.version += 1;
    return { ok: true, state: next };
  }
  next.round += 1;
  next.phase = 'estimating';
  next.updatedAt = input.now;
  next.deadline = input.now + ROUND_DURATION_MS;
  next.version += 1;
  return { ok: true, state: next };
}

export function schaetzoramaSnapshot(
  state: SchaetzoramaMatch,
  viewer: { role: 'host' | 'player' | 'spectator'; playerId?: string },
): SchaetzoramaSnapshot {
  if (!isValidMatch(state) || !viewer || !['host', 'player', 'spectator'].includes(viewer.role)) {
    throw new TypeError('Invalid Schaetzorama snapshot request');
  }
  const round = state.rounds[state.round - 1];
  const ownEstimate = viewer.role === 'player' && validPlayerId(viewer.playerId) ? round.submissions[viewer.playerId] : undefined;
  const revealed = state.phase !== 'estimating';
  const prompt = state.prompts[state.round - 1];
  return {
    matchId: state.matchId,
    round: state.round,
    roundCount: state.roundCount,
    phase: state.phase,
    question: prompt.question,
    unit: prompt.unit,
    min: prompt.min,
    max: prompt.max,
    deadline: state.deadline,
    version: state.version,
    submitted: ownEstimate !== undefined,
    ...(ownEstimate === undefined ? {} : { estimate: ownEstimate }),
    ...(revealed ? { answer: prompt.answer } : {}),
    estimates: revealed ? Object.entries(round.submissions).map(([playerId, estimate]) => ({ playerId, estimate })).sort((a, b) => a.playerId.localeCompare(b.playerId)) : [],
    winners: revealed ? [...round.winners] : [],
    scores: { ...state.scores },
  };
}

export function getSchaetzoramaResult(state: SchaetzoramaMatch): { matchId: string; scores: Record<string, number>; winners: string[]; rounds: SchaetzoramaRound[] } {
  if (!isValidMatch(state) || state.phase !== 'completed') throw new TypeError('Schaetzorama result is not ready');
  const high = Math.max(...Object.values(state.scores));
  return {
    matchId: state.matchId,
    scores: { ...state.scores },
    winners: Object.entries(state.scores).filter(([, score]) => score === high).map(([playerId]) => playerId).sort(),
    rounds: structuredClone(state.rounds),
  };
}
