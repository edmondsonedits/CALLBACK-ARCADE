export const DRAW_GUESS_PLAYERS_MIN = 3;
export const DRAW_GUESS_PLAYERS_MAX = 10;
export const DRAW_GUESS_MAX_LENGTH = 100;
export const DRAW_GUESS_MAX_STROKES = 80;
export const DRAW_GUESS_MAX_POINTS = 3_000;
export const DRAW_GUESS_MAX_POINTS_PER_STROKE = 300;
export const DRAW_GUESS_MAX_PAYLOAD_BYTES = 128_000;
export const DRAW_GUESS_DRAW_DURATION_MS = 90_000;
export const DRAW_GUESS_GUESS_DURATION_MS = 60_000;
export const DRAW_GUESS_MAX_ATTEMPTS = 5;

export type DrawGuessPhase = 'drawing' | 'guessing' | 'revealed';
export type DrawGuessOutcome = 'guessed' | 'timeout' | 'host_reveal';
export interface DrawGuessPoint { x: number; y: number }
export interface DrawGuessStroke { color: string; width: number; points: DrawGuessPoint[] }
export interface DrawGuessEntry { playerId: string; attempt: number; text: string; correct: boolean; at: number }
export interface DrawGuessMatch {
  matchId: string; players: string[]; round: 1; phase: DrawGuessPhase; artistId: string; prompt: string;
  drawing?: DrawGuessStroke[]; deadline: number; updatedAt: number; version: number; guesses: DrawGuessEntry[];
  scores: Record<string, number>; outcome?: DrawGuessOutcome; winnerId?: string | null;
}
export interface DrawGuessResult {
  matchId: string; round: 1; outcome: DrawGuessOutcome; artistId: string; prompt: string;
  drawing?: DrawGuessStroke[]; winnerId: string | null; scores: Record<string, number>; guesses: DrawGuessEntry[];
}
export interface DrawGuessSnapshot {
  matchId: string; round: 1; phase: DrawGuessPhase; players: string[]; artistId: string;
  deadline: number; version: number; submitted: boolean; attempt: number; guessCount: number;
  ownGuesses?: string[]; assignment?: { role: 'artist' | 'guesser'; prompt?: string };
  drawing?: DrawGuessStroke[]; result?: DrawGuessResult;
}
export type DrawGuessMutationResult =
  | { ok: true; state: DrawGuessMatch; idempotent?: boolean }
  | { ok: false; code: 'INVALID_STATE' | 'INVALID_INPUT' | 'MATCH_MISMATCH' | 'ROUND_CLOSED' | 'UNAUTHORIZED' | 'TOO_EARLY' | 'ALREADY_LOCKED' };

// Original King Prompter prompts; no upstream prompt content is used.
const PROMPTS = [
  'A dragon ordering a pizza', 'A bicycle built for a tiny mouse', 'A lighthouse in a snow globe', 'A robot walking a dog',
  'A penguin running a coffee shop', 'A castle floating in the clouds', 'A cat piloting a submarine', 'A very confused astronaut',
  'A treehouse with a secret slide', 'A whale jumping over a sailboat', 'A wizard late for the bus', 'A sandwich as tall as a tower',
  'A tiny house on the back of a turtle', 'A moon made of cheese', 'A dinosaur at the dentist', 'A hot air balloon shaped like a fish',
  'A squirrel driving a fire truck', 'A pirate treasure map on a pancake', 'A snowman at the beach', 'A giant snail delivering mail',
  'A spaceship landing in a garden', 'A dancing banana wearing boots', 'A monster hiding under a very small bed', 'A fox building a tree fort',
  'A roller coaster through a library', 'A kangaroo carrying groceries', 'A volcano erupting confetti', 'A tiny knight facing a giant duck',
  'A camel at a water park', 'A family of ducks crossing a busy street', 'A birthday cake with too many candles', 'A giraffe trying to fit in a car',
  'A magician pulling a bicycle from a hat', 'A sleepy bear in a hammock', 'A train travelling through a sandwich', 'A frog conducting an orchestra',
  'A gardener planting stars', 'A haunted house with friendly ghosts', 'A penguin surfing a giant wave', 'A raccoon washing dishes',
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
function clone<T>(value: T): T { return structuredClone(value); }
function validDrawing(value: unknown): value is DrawGuessStroke[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > DRAW_GUESS_MAX_STROKES) return false;
  let pointCount = 0;
  const valid = value.every((stroke) => plain(stroke) && typeof stroke.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(stroke.color) &&
    typeof stroke.width === 'number' && Number.isSafeInteger(stroke.width) && stroke.width >= 1 && stroke.width <= 20 && Array.isArray(stroke.points) &&
    stroke.points.length >= 1 && stroke.points.length <= DRAW_GUESS_MAX_POINTS_PER_STROKE && stroke.points.every((point) => {
      pointCount += 1;
      return plain(point) && typeof point.x === 'number' && Number.isSafeInteger(point.x) && point.x >= 0 && point.x <= 1000 &&
        typeof point.y === 'number' && Number.isSafeInteger(point.y) && point.y >= 0 && point.y <= 1000;
    }));
  if (!valid || pointCount > DRAW_GUESS_MAX_POINTS) return false;
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength <= DRAW_GUESS_MAX_PAYLOAD_BYTES; } catch { return false; }
}
function validMatch(state: DrawGuessMatch): boolean {
  const players = state?.players;
  if (!(state && typeof state === 'object' && /^[\w-]{1,100}$/.test(state.matchId) && Array.isArray(players) &&
    players.length >= DRAW_GUESS_PLAYERS_MIN && players.length <= DRAW_GUESS_PLAYERS_MAX && players.every(validId) && new Set(players).size === players.length &&
    state.round === 1 && ['drawing', 'guessing', 'revealed'].includes(state.phase) && players.includes(state.artistId) &&
    typeof state.prompt === 'string' && PROMPTS.includes(state.prompt) && Array.isArray(state.guesses) &&
    state.guesses.every((entry) => entry && players.includes(entry.playerId) && entry.playerId !== state.artistId && Number.isSafeInteger(entry.attempt) && entry.attempt >= 1 && entry.attempt <= DRAW_GUESS_MAX_ATTEMPTS &&
      typeof entry.text === 'string' && entry.text.length > 0 && entry.text.length <= DRAW_GUESS_MAX_LENGTH && typeof entry.correct === 'boolean' && Number.isSafeInteger(entry.at) && entry.at >= 0 && entry.at <= state.updatedAt) &&
    players.filter((id) => id !== state.artistId).every((id) => state.guesses.filter((entry) => entry.playerId === id).length <= DRAW_GUESS_MAX_ATTEMPTS) &&
    plain(state.scores) && players.every((id) => Number.isSafeInteger(state.scores[id]) && state.scores[id]! >= 0) &&
    Number.isSafeInteger(state.deadline) && Number.isSafeInteger(state.updatedAt) && state.updatedAt >= 0 && Number.isSafeInteger(state.version) && state.version >= 0)) return false;
  if (state.phase === 'drawing') return state.drawing === undefined && state.guesses.length === 0 && state.outcome === undefined && state.winnerId === undefined &&
    players.every((id) => state.scores[id] === 0) && state.deadline >= state.updatedAt;
  if (state.phase === 'guessing') return !validDrawing(state.drawing) ? false : state.outcome === undefined && state.winnerId === undefined && state.deadline >= state.updatedAt &&
    !state.guesses.some((entry) => entry.correct) && players.every((id) => state.scores[id] === 0);
  if (state.drawing !== undefined && !validDrawing(state.drawing)) return false;
  return state.deadline === state.updatedAt && ['guessed', 'timeout', 'host_reveal'].includes(state.outcome ?? '') &&
    (state.outcome === 'guessed' ? Boolean(state.drawing) && players.includes(state.winnerId ?? '') && state.guesses.at(-1)?.correct === true && state.guesses.at(-1)?.playerId === state.winnerId &&
      players.every((id) => state.scores[id] === (id === state.winnerId ? 1000 : id === state.artistId ? 500 : 0)) :
      state.winnerId === null && state.guesses.every((entry) => !entry.correct) && players.every((id) => state.scores[id] === 0));
}
function finish(state: DrawGuessMatch, outcome: DrawGuessOutcome, winnerId: string | null, now: number): DrawGuessMatch {
  const next = clone(state); next.phase = 'revealed'; next.outcome = outcome; next.winnerId = winnerId;
  if (outcome === 'guessed' && winnerId) { next.scores[winnerId] = 1000; next.scores[next.artistId] = 500; }
  next.deadline = now; next.updatedAt = now; next.version += 1; return next;
}

export function createDrawGuessMatch(input: { matchId: string; players: string[]; now: number; seed: number }): DrawGuessMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,100}$/.test(input.matchId) || !Array.isArray(input.players) ||
    input.players.length < DRAW_GUESS_PLAYERS_MIN || input.players.length > DRAW_GUESS_PLAYERS_MAX || !input.players.every(validId) || new Set(input.players).size !== input.players.length ||
    !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - DRAW_GUESS_DRAW_DURATION_MS || !Number.isSafeInteger(input.seed)) throw new TypeError('Invalid Draw & Guess match setup');
  const artistId = shuffle(input.players, input.seed ^ 0x76a139)[0]!;
  const prompt = shuffle(PROMPTS, input.seed)[0]!;
  return { matchId: input.matchId, players: [...input.players], round: 1, phase: 'drawing', artistId, prompt,
    deadline: input.now + DRAW_GUESS_DRAW_DURATION_MS, updatedAt: input.now, version: 0, guesses: [], scores: Object.fromEntries(input.players.map((id) => [id, 0])) };
}

export function submitDrawGuessDrawing(state: DrawGuessMatch, input: { matchId: string; round: number; playerId: string; drawing: DrawGuessStroke[]; now: number }): DrawGuessMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validId(input.playerId) || !Number.isSafeInteger(input.round) || !validClock(input.now, state.updatedAt) || !validDrawing(input.drawing)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== 1 || !state.players.includes(input.playerId)) return { ok: false, code: 'ROUND_CLOSED' };
  if (input.playerId !== state.artistId) return { ok: false, code: 'UNAUTHORIZED' };
  if (state.drawing) return JSON.stringify(state.drawing) === JSON.stringify(input.drawing) ? { ok: true, state, idempotent: true } : { ok: false, code: 'ROUND_CLOSED' };
  if (state.phase !== 'drawing' || input.now >= state.deadline || input.now > Number.MAX_SAFE_INTEGER - DRAW_GUESS_GUESS_DURATION_MS) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(state); next.drawing = clone(input.drawing); next.phase = 'guessing'; next.deadline = input.now + DRAW_GUESS_GUESS_DURATION_MS;
  next.updatedAt = input.now; next.version += 1; return { ok: true, state: next };
}

export function submitDrawGuess(state: DrawGuessMatch, input: { matchId: string; round: number; attempt: number; playerId: string; guess: string; now: number }): DrawGuessMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validId(input.playerId) || typeof input.guess !== 'string' ||
    input.guess.trim().length === 0 || input.guess.trim().length > DRAW_GUESS_MAX_LENGTH || normalize(input.guess).length === 0 ||
    !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.attempt) || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== 1 || !state.players.includes(input.playerId)) return { ok: false, code: 'ROUND_CLOSED' };
  if (input.playerId === state.artistId) return { ok: false, code: 'UNAUTHORIZED' };
  const own = state.guesses.filter((entry) => entry.playerId === input.playerId);
  const prior = own[input.attempt - 1];
  const text = input.guess.trim();
  if (prior) return prior.text === text ? { ok: true, state, idempotent: true } : { ok: false, code: 'ALREADY_LOCKED' };
  if (state.phase !== 'guessing' || input.now >= state.deadline || input.attempt !== own.length + 1 || input.attempt > DRAW_GUESS_MAX_ATTEMPTS) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(state); const correct = normalize(text) === normalize(state.prompt);
  next.guesses.push({ playerId: input.playerId, attempt: input.attempt, text, correct, at: input.now });
  next.updatedAt = input.now; next.version += 1;
  return { ok: true, state: correct ? finish(next, 'guessed', input.playerId, input.now) : next };
}

export function advanceDrawGuess(state: DrawGuessMatch, input: { now: number }): DrawGuessMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now < state.deadline) return { ok: false, code: 'TOO_EARLY' };
  if (state.phase === 'drawing') return { ok: true, state: finish(state, 'timeout', null, input.now) };
  return { ok: true, state: finish(state, 'timeout', null, input.now) };
}

export function revealDrawGuess(state: DrawGuessMatch, input: { now: number }): DrawGuessMutationResult {
  if (!validMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  return { ok: true, state: finish(state, 'host_reveal', null, input.now) };
}

export function drawGuessSnapshot(state: DrawGuessMatch, viewer: { role: 'host' } | { role: 'spectator' } | { role: 'player'; playerId: string }): DrawGuessSnapshot {
  if (!validMatch(state) || !viewer || !['host', 'spectator', 'player'].includes(viewer.role)) throw new TypeError('Invalid Draw & Guess snapshot request');
  if (viewer.role === 'player' && (!validId(viewer.playerId) || !state.players.includes(viewer.playerId))) throw new TypeError('Draw & Guess snapshot player is not assigned');
  const playerId = viewer.role === 'player' ? viewer.playerId : undefined;
  const own = playerId ? state.guesses.filter((entry) => entry.playerId === playerId) : undefined;
  const snapshot: DrawGuessSnapshot = { matchId: state.matchId, round: 1, phase: state.phase, players: [...state.players], artistId: state.artistId,
    deadline: state.deadline, version: state.version, submitted: Boolean(own?.length), attempt: (own?.length ?? 0) + 1, guessCount: state.guesses.length };
  if (own) snapshot.ownGuesses = own.map((entry) => entry.text);
  if (playerId && state.phase !== 'revealed') snapshot.assignment = playerId === state.artistId ? { role: 'artist', prompt: state.prompt } : { role: 'guesser' };
  if (state.phase !== 'drawing' && state.drawing) snapshot.drawing = clone(state.drawing);
  if (state.phase === 'revealed') snapshot.result = getDrawGuessResult(state);
  return snapshot;
}

export function getDrawGuessResult(state: DrawGuessMatch): DrawGuessResult {
  if (!validMatch(state) || state.phase !== 'revealed' || !state.outcome) throw new TypeError('Draw & Guess result is not ready');
  return { matchId: state.matchId, round: 1, outcome: state.outcome, artistId: state.artistId, prompt: state.prompt,
    ...(state.drawing ? { drawing: clone(state.drawing) } : {}), winnerId: state.winnerId ?? null, scores: { ...state.scores }, guesses: clone(state.guesses) };
}
