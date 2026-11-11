export const IMPOSTER_PLAYERS_MIN = 3;
export const IMPOSTER_PLAYERS_MAX = 10;
export const IMPOSTER_CLUE_MAX_LENGTH = 80;
export const IMPOSTER_CLUE_DURATION_MS = 60_000;
export const IMPOSTER_VOTE_DURATION_MS = 45_000;

export type ImposterRole = 'civilian' | 'imposter';
export type ImposterPhase = 'cluing' | 'voting' | 'revealed';

export interface ImposterPrompt {
  id: string;
  category: string;
  word: string;
}

export interface ImposterPlayerRole {
  playerId: string;
  role: ImposterRole;
}

export interface ImposterMatch {
  matchId: string;
  players: string[];
  round: 1;
  phase: ImposterPhase;
  category: string;
  word: string;
  roles: ImposterPlayerRole[];
  clues: Record<string, string>;
  votes: Record<string, string>;
  deadline: number;
  updatedAt: number;
  version: number;
}

export interface ImposterResult {
  matchId: string;
  round: 1;
  category: string;
  word: string;
  imposterId: string;
  winner: 'civilians' | 'imposter';
  accusedPlayerIds: string[];
  voteCounts: Record<string, number>;
  clues: Array<{ playerId: string; clue: string }>;
  roles: ImposterPlayerRole[];
}

export interface ImposterSnapshot {
  matchId: string;
  round: 1;
  phase: ImposterPhase;
  players: string[];
  deadline: number;
  version: number;
  clueCount: number;
  voteCount: number;
  submitted: boolean;
  ownClue?: string;
  assignment?: { role: ImposterRole; word?: string; category: string };
  clues: Array<{ playerId: string; clue: string }>;
  result?: ImposterResult;
}

export type ImposterMutationResult =
  | { ok: true; state: ImposterMatch; idempotent?: boolean }
  | { ok: false; code: 'INVALID_STATE' | 'INVALID_INPUT' | 'MATCH_MISMATCH' | 'ROUND_CLOSED' | 'ALREADY_LOCKED' | 'TOO_EARLY' };

const PROMPT_DECK: readonly ImposterPrompt[] = [
  { id: 'kp-imp-kitchen-1', category: 'Kitchen', word: 'Cinnamon' },
  { id: 'kp-imp-kitchen-2', category: 'Kitchen', word: 'Colander' },
  { id: 'kp-imp-kitchen-3', category: 'Kitchen', word: 'Apricot' },
  { id: 'kp-imp-nature-1', category: 'Wild places', word: 'Tidepool' },
  { id: 'kp-imp-nature-2', category: 'Wild places', word: 'Moss' },
  { id: 'kp-imp-nature-3', category: 'Wild places', word: 'Canyon' },
  { id: 'kp-imp-making-1', category: 'Things we make', word: 'Mosaic' },
  { id: 'kp-imp-making-2', category: 'Things we make', word: 'Scarecrow' },
  { id: 'kp-imp-making-3', category: 'Things we make', word: 'Kite' },
  { id: 'kp-imp-travel-1', category: 'Getting around', word: 'Ferry' },
  { id: 'kp-imp-travel-2', category: 'Getting around', word: 'Roundabout' },
  { id: 'kp-imp-travel-3', category: 'Getting around', word: 'Saddle' },
  { id: 'kp-imp-sound-1', category: 'Sounds', word: 'Whistle' },
  { id: 'kp-imp-sound-2', category: 'Sounds', word: 'Echo' },
  { id: 'kp-imp-sound-3', category: 'Sounds', word: 'Metronome' },
  { id: 'kp-imp-places-1', category: 'Everyday places', word: 'Lighthouse' },
  { id: 'kp-imp-places-2', category: 'Everyday places', word: 'Greenhouse' },
  { id: 'kp-imp-places-3', category: 'Everyday places', word: 'Workshop' },
  { id: 'kp-imp-weather-1', category: 'Sky and weather', word: 'Hailstone' },
  { id: 'kp-imp-weather-2', category: 'Sky and weather', word: 'Fog' },
  { id: 'kp-imp-weather-3', category: 'Sky and weather', word: 'Aurora' },
  { id: 'kp-imp-games-1', category: 'Games and play', word: 'Jigsaw' },
  { id: 'kp-imp-games-2', category: 'Games and play', word: 'Marbles' },
  { id: 'kp-imp-games-3', category: 'Games and play', word: 'Yo-yo' },
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function validPlayerId(id: unknown): id is string {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 100 && !Object.hasOwn(Object.prototype, id);
}

function validClock(now: unknown, updatedAt: number): now is number {
  return typeof now === 'number' && Number.isSafeInteger(now) && now >= updatedAt;
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
    [output[index], output[swap]] = [output[swap]!, output[index]!];
  }
  return output;
}

function isValidMatch(state: ImposterMatch): boolean {
  const players = state?.players;
  const roleEntries = state?.roles;
  return Boolean(
    state && typeof state === 'object' && /^[\w-]{1,100}$/.test(state.matchId) &&
    Array.isArray(players) && players.length >= IMPOSTER_PLAYERS_MIN && players.length <= IMPOSTER_PLAYERS_MAX &&
    players.every(validPlayerId) && new Set(players).size === players.length &&
    state.round === 1 && ['cluing', 'voting', 'revealed'].includes(state.phase) &&
    typeof state.category === 'string' && state.category.length > 0 && typeof state.word === 'string' && state.word.length > 0 &&
    Array.isArray(roleEntries) && roleEntries.length === players.length && roleEntries.every((entry) => entry && players.includes(entry.playerId) && ['civilian', 'imposter'].includes(entry.role)) &&
    roleEntries.filter((entry) => entry.role === 'imposter').length === 1 && new Set(roleEntries.map((entry) => entry.playerId)).size === players.length &&
    isPlainRecord(state.clues) && Object.entries(state.clues).every(([playerId, clue]) => players.includes(playerId) && typeof clue === 'string' && clue.length > 0 && clue.length <= IMPOSTER_CLUE_MAX_LENGTH) &&
    isPlainRecord(state.votes) && Object.entries(state.votes).every(([playerId, targetId]) => players.includes(playerId) && players.includes(targetId) && playerId !== targetId) &&
    (state.phase !== 'cluing' || Object.keys(state.votes).length === 0) &&
    Number.isSafeInteger(state.deadline) && Number.isSafeInteger(state.updatedAt) && state.updatedAt >= 0 &&
    (state.phase === 'revealed' ? state.deadline === state.updatedAt : state.deadline >= state.updatedAt) &&
    Number.isSafeInteger(state.version) && state.version >= 0
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createImposterMatch(input: { matchId: string; players: string[]; now: number; seed: number }): ImposterMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,100}$/.test(input.matchId) ||
      !Array.isArray(input.players) || input.players.length < IMPOSTER_PLAYERS_MIN || input.players.length > IMPOSTER_PLAYERS_MAX ||
      !input.players.every(validPlayerId) || new Set(input.players).size !== input.players.length ||
      !Number.isSafeInteger(input.now) || input.now < 0 || !Number.isSafeInteger(input.seed)) {
    throw new TypeError('Invalid Imposter match setup');
  }
  const prompt = seededShuffle(PROMPT_DECK, input.seed)[0]!;
  const roleOrder = seededShuffle(input.players, input.seed ^ 0x51f15e);
  const imposterId = roleOrder[0]!;
  return {
    matchId: input.matchId,
    players: [...input.players],
    round: 1,
    phase: 'cluing',
    category: prompt.category,
    word: prompt.word,
    roles: input.players.map((playerId) => ({ playerId, role: playerId === imposterId ? 'imposter' : 'civilian' })),
    clues: {},
    votes: {},
    deadline: input.now + IMPOSTER_CLUE_DURATION_MS,
    updatedAt: input.now,
    version: 0,
  };
}

export function submitImposterClue(
  state: ImposterMatch,
  input: { matchId: string; round: number; playerId: string; clue: string; now: number },
): ImposterMutationResult {
  if (!isValidMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validPlayerId(input.playerId) ||
      typeof input.clue !== 'string' || input.clue.trim().length === 0 || input.clue.trim().length > IMPOSTER_CLUE_MAX_LENGTH ||
      !Number.isSafeInteger(input.round) || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== state.round || !state.players.includes(input.playerId)) return { ok: false, code: 'ROUND_CLOSED' };
  const clue = input.clue.trim();
  const existing = state.clues[input.playerId];
  if (existing !== undefined) return existing === clue ? { ok: true, state, idempotent: true } : { ok: false, code: 'ALREADY_LOCKED' };
  if (state.phase !== 'cluing' || input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(state);
  next.clues[input.playerId] = clue;
  next.updatedAt = input.now;
  next.version += 1;
  if (next.players.every((playerId) => next.clues[playerId] !== undefined)) {
    next.phase = 'voting';
    next.deadline = input.now + IMPOSTER_VOTE_DURATION_MS;
  }
  return { ok: true, state: next };
}

function revealImposter(state: ImposterMatch, now: number): ImposterMatch {
  const next = clone(state);
  next.phase = 'revealed';
  next.deadline = now;
  next.updatedAt = now;
  next.version += 1;
  return next;
}

export function submitImposterVote(
  state: ImposterMatch,
  input: { matchId: string; round: number; playerId: string; targetPlayerId: string; now: number },
): ImposterMutationResult {
  if (!isValidMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validPlayerId(input.playerId) ||
      !validPlayerId(input.targetPlayerId) || !Number.isSafeInteger(input.round) || !validClock(input.now, state.updatedAt)) {
    return { ok: false, code: 'INVALID_INPUT' };
  }
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== state.round || !state.players.includes(input.playerId) || !state.players.includes(input.targetPlayerId)) return { ok: false, code: 'ROUND_CLOSED' };
  if (input.playerId === input.targetPlayerId) return { ok: false, code: 'INVALID_INPUT' };
  const existing = state.votes[input.playerId];
  if (existing !== undefined) return existing === input.targetPlayerId ? { ok: true, state, idempotent: true } : { ok: false, code: 'ALREADY_LOCKED' };
  if (state.phase !== 'voting' || input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(state);
  next.votes[input.playerId] = input.targetPlayerId;
  next.updatedAt = input.now;
  next.version += 1;
  if (next.players.every((playerId) => next.votes[playerId] !== undefined)) return { ok: true, state: revealImposter(next, input.now) };
  return { ok: true, state: next };
}

export function advanceImposter(state: ImposterMatch, input: { now: number }): ImposterMutationResult {
  if (!isValidMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now < state.deadline) return { ok: false, code: 'TOO_EARLY' };
  const next = clone(state);
  if (state.phase === 'cluing') {
    next.phase = 'voting';
    next.deadline = input.now + IMPOSTER_VOTE_DURATION_MS;
    next.updatedAt = input.now;
    next.version += 1;
    return { ok: true, state: next };
  }
  return { ok: true, state: revealImposter(state, input.now) };
}

export function imposterSnapshot(
  state: ImposterMatch,
  viewer: { role: 'host' | 'player' | 'spectator'; playerId?: string },
): ImposterSnapshot {
  if (!isValidMatch(state) || !viewer || !['host', 'player', 'spectator'].includes(viewer.role)) throw new TypeError('Invalid Imposter snapshot request');
  if (viewer.role === 'player' && (!validPlayerId(viewer.playerId) || !state.players.includes(viewer.playerId))) throw new TypeError('Imposter snapshot player is not assigned');
  const playerId = viewer.role === 'player' && validPlayerId(viewer.playerId) && state.players.includes(viewer.playerId) ? viewer.playerId : undefined;
  const ownRole = playerId ? state.roles.find((role) => role.playerId === playerId)?.role : undefined;
  const cluesVisible = state.phase !== 'cluing';
  const ownClue = playerId ? state.clues[playerId] : undefined;
  return {
    matchId: state.matchId,
    round: state.round,
    phase: state.phase,
    players: [...state.players],
    deadline: state.deadline,
    version: state.version,
    clueCount: Object.keys(state.clues).length,
    voteCount: Object.keys(state.votes).length,
    submitted: state.phase === 'cluing' ? ownClue !== undefined : playerId ? state.votes[playerId] !== undefined : false,
    ...(ownClue === undefined ? {} : { ownClue }),
    ...(ownRole === undefined || state.phase === 'revealed' ? {} : {
      assignment: {
        role: ownRole,
        category: state.category,
        ...(ownRole === 'civilian' ? { word: state.word } : {}),
      },
    }),
    clues: cluesVisible ? Object.entries(state.clues).map(([cluePlayerId, clue]) => ({ playerId: cluePlayerId, clue })).sort((a, b) => a.playerId.localeCompare(b.playerId)) : [],
    ...(state.phase === 'revealed' ? { result: getImposterResult(state) } : {}),
  };
}

export function getImposterResult(state: ImposterMatch): ImposterResult {
  if (!isValidMatch(state) || state.phase !== 'revealed') throw new TypeError('Imposter result is not ready');
  const imposterId = state.roles.find((role) => role.role === 'imposter')!.playerId;
  const voteCounts = Object.fromEntries(state.players.map((playerId) => [playerId, 0]));
  for (const targetId of Object.values(state.votes)) voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
  const highestCount = Math.max(0, ...Object.values(voteCounts));
  const accusedPlayerIds = highestCount === 0 ? [] : Object.entries(voteCounts)
    .filter(([, votes]) => votes === highestCount)
    .map(([playerId]) => playerId)
    .sort();
  const winner = accusedPlayerIds.length === 1 && accusedPlayerIds[0] === imposterId ? 'civilians' : 'imposter';
  return {
    matchId: state.matchId,
    round: state.round,
    category: state.category,
    word: state.word,
    imposterId,
    winner,
    accusedPlayerIds,
    voteCounts,
    clues: Object.entries(state.clues).map(([playerId, clue]) => ({ playerId, clue })).sort((a, b) => a.playerId.localeCompare(b.playerId)),
    roles: clone(state.roles),
  };
}
