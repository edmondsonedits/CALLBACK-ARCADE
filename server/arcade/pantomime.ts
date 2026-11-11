export const PANTOMIME_PLAYERS_MIN = 3;
export const PANTOMIME_PLAYERS_MAX = 10;
export const PANTOMIME_GUESSES_MAX = 5;
export const PANTOMIME_GUESS_MAX_LENGTH = 100;
export const PANTOMIME_ROUND_DURATION_MS = 75_000;

export type PantomimePhase = 'acting' | 'revealed';
export type PantomimeOutcome = 'guessed' | 'timeout' | 'host_reveal';
export interface PantomimeGuess { playerId: string; text: string; correct: boolean; at: number }
export interface PantomimeMatch {
  matchId: string; players: string[]; round: 1; phase: PantomimePhase; performerId: string; prompt: string;
  deadline: number; updatedAt: number; version: number; attempt: number; guesses: PantomimeGuess[]; performanceCue?: string;
  scores: Record<string, number>; outcome?: PantomimeOutcome; winnerId?: string | null;
}
export interface PantomimeResult {
  matchId: string; round: 1; outcome: PantomimeOutcome; prompt: string; performerId: string;
  winnerId: string | null; scores: Record<string, number>; guesses: PantomimeGuess[];
}
export interface PantomimeSnapshot {
  matchId: string; round: 1; phase: PantomimePhase; players: string[]; performerId: string;
  deadline: number; version: number; attempt: number; guessCount: number; submitted: boolean;
  ownGuesses?: string[]; performanceCue?: string; assignment?: { role: 'performer' | 'guesser'; prompt?: string }; result?: PantomimeResult;
}
export type PantomimeMutationResult =
  | { ok: true; state: PantomimeMatch; idempotent?: boolean }
  | { ok: false; code: 'INVALID_STATE' | 'INVALID_INPUT' | 'MATCH_MISMATCH' | 'ROUND_CLOSED' | 'ALREADY_LOCKED' | 'TOO_EARLY' };

// Original King Prompter prompts; no upstream word list or game assets are included.
const PROMPTS = [
  'Walking a tightrope', 'Brushing a very stubborn horse', 'Building a sandcastle', 'Getting caught in a rainstorm',
  'Trying to open a jar', 'Riding a roller coaster', 'Making a snow angel', 'Catching a butterfly',
  'A penguin learning to fly', 'A chef flipping pancakes', 'A robot doing ballet', 'A cat knocking over a glass',
  'A lifeguard spotting a shark', 'A detective finding a clue', 'A gardener planting a giant tree', 'A pirate steering a ship',
  'A musician tuning a violin', 'A magician sawing a box in half', 'A photographer taking a selfie', 'A sleepy student in class',
  'A waiter carrying too many plates', 'A firefighter climbing a ladder', 'A camper pitching a tent', 'A dog chasing its tail',
  'A baby taking its first steps', 'A baker kneading dough', 'A golfer missing an easy putt', 'A referee calling a foul',
  'A snowman melting in the sun', 'A spy sneaking past a guard', 'A ghost trying to scare someone', 'A statue coming to life',
  'A squirrel hiding an acorn', 'A person stepping on a squeaky floorboard', 'A tightrope walker in a windstorm', 'A knight fighting a dragon',
  'A pilot flying through turbulence', 'A person trying to swat a mosquito', 'A fisherman reeling in a huge catch', 'A dancer with two left feet',
  'A tourist reading a map upside down', 'A scientist mixing a bubbling potion', 'A kangaroo boxing', 'A person carrying a wobbly tower of books',
  'A vacuum cleaner eating a sock', 'A chef tasting something too spicy', 'A squirrel water-skiing', 'A person stuck in an invisible box',
  'A mime walking against the wind', 'A sheep getting a haircut', 'A person searching for lost glasses', 'A crocodile brushing its teeth',
  'A penguin slipping on ice', 'A delivery driver dodging puddles', 'A baby bird learning to hop', 'A king trying on a tiny crown',
];

function plain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && !Object.hasOwn(Object.prototype, value);
}
function validClock(now: unknown, updatedAt: number): now is number {
  return typeof now === 'number' && Number.isSafeInteger(now) && now >= updatedAt;
}
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items]; let value = seed >>> 0;
  for (let i = result.length - 1; i > 0; i -= 1) {
    value = (value + 0x6d2b79f5) >>> 0; let random = value;
    random = Math.imul(random ^ (random >>> 15), random | 1); random ^= random + Math.imul(random ^ (random >>> 7), random | 61);
    const swap = Math.floor((((random ^ (random >>> 14)) >>> 0) / 4_294_967_296) * (i + 1));
    [result[i], result[swap]] = [result[swap]!, result[i]!];
  }
  return result;
}
function normalize(text: string): string {
  return text.normalize('NFKD').toLocaleLowerCase('und').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ');
}
function validMatch(state: PantomimeMatch): boolean {
  const players = state?.players;
  return Boolean(state && typeof state === 'object' && /^[\w-]{1,100}$/.test(state.matchId) &&
    Array.isArray(players) && players.length >= PANTOMIME_PLAYERS_MIN && players.length <= PANTOMIME_PLAYERS_MAX &&
    players.every(validId) && new Set(players).size === players.length && state.round === 1 &&
    ['acting', 'revealed'].includes(state.phase) && players.includes(state.performerId) &&
    typeof state.prompt === 'string' && PROMPTS.includes(state.prompt) && (state.performanceCue === undefined || (typeof state.performanceCue === 'string' && state.performanceCue.trim().length > 0 && state.performanceCue.length <= 120)) && Number.isSafeInteger(state.attempt) && state.attempt >= 1 && state.attempt <= PANTOMIME_GUESSES_MAX &&
    Array.isArray(state.guesses) && state.guesses.every((guess) => guess && players.includes(guess.playerId) && guess.playerId !== state.performerId &&
      typeof guess.text === 'string' && guess.text.length > 0 && guess.text.length <= PANTOMIME_GUESS_MAX_LENGTH && typeof guess.correct === 'boolean' && Number.isSafeInteger(guess.at) && guess.at >= 0 && guess.at <= state.updatedAt) &&
    players.filter((playerId) => playerId !== state.performerId).every((playerId) => state.guesses.filter((guess) => guess.playerId === playerId).length <= PANTOMIME_GUESSES_MAX) &&
    state.attempt === Math.max(1, ...players.filter((playerId) => playerId !== state.performerId).map((playerId) => state.guesses.filter((guess) => guess.playerId === playerId).length)) &&
    plain(state.scores) && players.every((playerId) => Number.isSafeInteger(state.scores[playerId]) && state.scores[playerId]! >= 0) &&
    (state.phase === 'acting' ? state.guesses.every((guess) => !guess.correct) && players.every((playerId) => state.scores[playerId] === 0) :
      state.outcome === 'guessed' ? state.guesses.filter((guess) => guess.correct).length === 1 && state.guesses.at(-1)?.correct === true &&
        state.guesses.at(-1)?.playerId === state.winnerId && players.every((playerId) => state.scores[playerId] === (playerId === state.winnerId ? 1000 : playerId === state.performerId ? 500 : 0)) :
        state.guesses.every((guess) => !guess.correct) && players.every((playerId) => state.scores[playerId] === 0)) &&
    Number.isSafeInteger(state.deadline) && Number.isSafeInteger(state.updatedAt) && state.updatedAt >= 0 &&
    (state.phase === 'revealed' ? state.deadline === state.updatedAt && ['guessed', 'timeout', 'host_reveal'].includes(state.outcome ?? '') &&
      (state.outcome === 'guessed' ? players.includes(state.winnerId ?? '') : state.winnerId === null) : state.deadline >= state.updatedAt && state.outcome === undefined && state.winnerId === undefined) &&
    Number.isSafeInteger(state.version) && state.version >= 0);
}
function clone<T>(value: T): T { return structuredClone(value); }
function finish(state: PantomimeMatch, outcome: PantomimeOutcome, winnerId: string | null, now: number): PantomimeMatch {
  const next = clone(state); next.phase = 'revealed'; next.outcome = outcome; next.winnerId = winnerId;
  if (outcome === 'guessed' && winnerId) { next.scores[winnerId] = (next.scores[winnerId] ?? 0) + 1000; next.scores[next.performerId] = (next.scores[next.performerId] ?? 0) + 500; }
  next.updatedAt = now; next.deadline = now; next.version += 1; return next;
}

export function createPantomimeMatch(input: { matchId: string; players: string[]; now: number; seed: number }): PantomimeMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,100}$/.test(input.matchId) ||
      !Array.isArray(input.players) || input.players.length < PANTOMIME_PLAYERS_MIN || input.players.length > PANTOMIME_PLAYERS_MAX ||
      !input.players.every(validId) || new Set(input.players).size !== input.players.length || !Number.isSafeInteger(input.now) || input.now < 0 ||
      input.now > Number.MAX_SAFE_INTEGER - PANTOMIME_ROUND_DURATION_MS || !Number.isSafeInteger(input.seed)) throw new TypeError('Invalid Pantomime match setup');
  const performerId = shuffle(input.players, input.seed ^ 0x51f15e)[0]!;
  const prompt = shuffle(PROMPTS, input.seed)[0]!;
  return { matchId: input.matchId, players: [...input.players], round: 1, phase: 'acting', performerId, prompt,
    deadline: input.now + PANTOMIME_ROUND_DURATION_MS, updatedAt: input.now, version: 0, attempt: 1, guesses: [],
    scores: Object.fromEntries(input.players.map((id) => [id, 0])) };
}

export function submitPantomimeGuess(state: PantomimeMatch, input: { matchId: string; round: number; attempt: number; playerId: string; guess: string; now: number }): PantomimeMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validId(input.playerId) ||
      typeof input.guess !== 'string' || input.guess.trim().length === 0 || input.guess.trim().length > PANTOMIME_GUESS_MAX_LENGTH ||
      !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.attempt) || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== 1 || !state.players.includes(input.playerId)) return { ok: false, code: 'ROUND_CLOSED' };
  const text = input.guess.trim();
  const ownGuesses = state.guesses.filter((entry) => entry.playerId === input.playerId);
  const prior = ownGuesses[input.attempt - 1];
  if (prior) return prior.text === text ? { ok: true, state, idempotent: true } : { ok: false, code: 'ALREADY_LOCKED' };
  if (state.phase !== 'acting' || input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  if (input.playerId === state.performerId) return { ok: false, code: 'ROUND_CLOSED' };
  const expected = ownGuesses.length + 1;
  if (input.attempt !== expected || input.attempt > PANTOMIME_GUESSES_MAX) return { ok: false, code: 'ROUND_CLOSED' };
  const correct = normalize(text) === normalize(state.prompt);
  const next = clone(state); next.guesses.push({ playerId: input.playerId, text, correct, at: input.now });
  next.attempt = Math.max(next.attempt, input.attempt); next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: correct ? finish(next, 'guessed', input.playerId, input.now) : next };
}

export function advancePantomime(state: PantomimeMatch, input: { now: number }): PantomimeMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now < state.deadline) return { ok: false, code: 'TOO_EARLY' };
  return { ok: true, state: finish(state, 'timeout', null, input.now) };
}

export function revealPantomime(state: PantomimeMatch, input: { now: number }): PantomimeMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  return { ok: true, state: finish(state, 'host_reveal', null, input.now) };
}

export function pantomimeSnapshot(state: PantomimeMatch, viewer: { role: 'host' } | { role: 'spectator' } | { role: 'player'; playerId: string }): PantomimeSnapshot {
  if (!validMatch(state) || !viewer || !['host', 'spectator', 'player'].includes(viewer.role)) throw new TypeError('Invalid Pantomime snapshot request');
  if (viewer.role === 'player' && (!validId(viewer.playerId) || !state.players.includes(viewer.playerId))) throw new TypeError('Pantomime snapshot player is not assigned');
  const playerId = viewer.role === 'player' ? viewer.playerId : undefined;
  const ownGuesses = playerId ? state.guesses.filter((entry) => entry.playerId === playerId).map((entry) => entry.text) : undefined;
  return { matchId: state.matchId, round: 1, phase: state.phase, players: [...state.players], performerId: state.performerId,
    deadline: state.deadline, version: state.version, attempt: playerId ? (ownGuesses?.length ?? 0) + 1 : state.attempt, guessCount: state.guesses.length,
    submitted: Boolean(ownGuesses?.length), ...(ownGuesses ? { ownGuesses } : {}),
    ...(state.performanceCue ? { performanceCue: state.performanceCue } : {}),
    ...(playerId && state.phase === 'acting' ? { assignment: playerId === state.performerId ? { role: 'performer', prompt: state.prompt } : { role: 'guesser' } } : {}),
    ...(state.phase === 'revealed' ? { result: getPantomimeResult(state) } : {}) };
}

export function getPantomimeResult(state: PantomimeMatch): PantomimeResult {
  if (!validMatch(state) || state.phase !== 'revealed' || !state.outcome) throw new TypeError('Pantomime result is not ready');
  return { matchId: state.matchId, round: 1, outcome: state.outcome, prompt: state.prompt, performerId: state.performerId,
    winnerId: state.winnerId ?? null, scores: { ...state.scores }, guesses: clone(state.guesses) };
}
