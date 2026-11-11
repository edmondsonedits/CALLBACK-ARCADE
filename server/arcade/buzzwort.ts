export const BUZZWORT_PLAYERS_MIN = 3;
export const BUZZWORT_PLAYERS_MAX = 10;
export const BUZZWORT_TEXT_MAX_LENGTH = 120;
export const BUZZWORT_ROUND_DURATION_MS = 75_000;

export type BuzzwortTeam = 'ember' | 'cobalt';
export type BuzzwortRole = 'clue_giver' | 'guesser' | 'teammate' | 'watcher';
export type BuzzwortPhase = 'clue' | 'guess' | 'revealed';
export type BuzzwortOutcome = 'guessed' | 'taboo' | 'timeout';

export interface BuzzwortCard {
  id: string;
  word: string;
  tabooWords: string[];
}

export interface BuzzwortClue {
  playerId: string;
  attempt: number;
  text: string;
}

export interface BuzzwortGuess {
  playerId: string;
  attempt: number;
  text: string;
  correct: boolean;
}

export interface BuzzwortMatch {
  matchId: string;
  players: string[];
  round: 1;
  phase: BuzzwortPhase;
  attempt: number;
  teams: Record<string, BuzzwortTeam>;
  roles: Record<string, BuzzwortRole>;
  activeTeam: BuzzwortTeam;
  watcherTeam: BuzzwortTeam;
  clueGiverId: string;
  guesserId: string;
  card: BuzzwortCard;
  currentClue?: string;
  clues: BuzzwortClue[];
  guesses: BuzzwortGuess[];
  scores: Record<BuzzwortTeam, number>;
  outcome?: BuzzwortOutcome;
  winnerTeam?: BuzzwortTeam;
  deadline: number;
  updatedAt: number;
  version: number;
}

export interface BuzzwortResult {
  matchId: string;
  round: 1;
  outcome: BuzzwortOutcome;
  winnerTeam: BuzzwortTeam;
  activeTeam: BuzzwortTeam;
  watcherTeam: BuzzwortTeam;
  card: BuzzwortCard;
  scores: Record<BuzzwortTeam, number>;
  teams: Record<string, BuzzwortTeam>;
  roles: Record<string, BuzzwortRole>;
  clues: BuzzwortClue[];
  guesses: BuzzwortGuess[];
}

export interface BuzzwortSnapshot {
  matchId: string;
  round: 1;
  phase: BuzzwortPhase;
  attempt: number;
  players: string[];
  activeTeam: BuzzwortTeam;
  watcherTeam: BuzzwortTeam;
  clueGiverId: string;
  guesserId: string;
  deadline: number;
  version: number;
  clueCount: number;
  submitted: boolean;
  currentClue?: string;
  clues: BuzzwortClue[];
  assignment?: { role: BuzzwortRole; team: BuzzwortTeam; card?: { word: string; tabooWords: string[] } };
  result?: BuzzwortResult;
}

export type BuzzwortMutationResult =
  | { ok: true; state: BuzzwortMatch; idempotent?: boolean }
  | { ok: false; code: 'INVALID_STATE' | 'INVALID_INPUT' | 'MATCH_MISMATCH' | 'ROUND_CLOSED' | 'UNAUTHORIZED' | 'TOO_EARLY' };

const CARD_DECK: readonly BuzzwortCard[] = [
  { id: 'kp-buzz-orbit', word: 'Orbit', tabooWords: ['planet', 'space', 'circle', 'satellite'] },
  { id: 'kp-buzz-pancake', word: 'Pancake', tabooWords: ['breakfast', 'syrup', 'flat', 'griddle'] },
  { id: 'kp-buzz-lighthouse', word: 'Lighthouse', tabooWords: ['ocean', 'beam', 'ship', 'tower'] },
  { id: 'kp-buzz-bicycle', word: 'Bicycle', tabooWords: ['wheels', 'pedal', 'helmet', 'ride'] },
  { id: 'kp-buzz-greenhouse', word: 'Greenhouse', tabooWords: ['plants', 'glass', 'garden', 'grow'] },
  { id: 'kp-buzz-thunder', word: 'Thunder', tabooWords: ['storm', 'lightning', 'loud', 'cloud'] },
  { id: 'kp-buzz-puppet', word: 'Puppet', tabooWords: ['strings', 'doll', 'show', 'hand'] },
  { id: 'kp-buzz-compass', word: 'Compass', tabooWords: ['north', 'direction', 'needle', 'map'] },
  { id: 'kp-buzz-waterfall', word: 'Waterfall', tabooWords: ['river', 'cliff', 'water', 'cascade'] },
  { id: 'kp-buzz-telescope', word: 'Telescope', tabooWords: ['stars', 'lens', 'moon', 'look'] },
  { id: 'kp-buzz-sculpture', word: 'Sculpture', tabooWords: ['statue', 'artist', 'stone', 'museum'] },
  { id: 'kp-buzz-thermos', word: 'Thermos', tabooWords: ['drink', 'hot', 'bottle', 'coffee'] },
  { id: 'kp-buzz-parachute', word: 'Parachute', tabooWords: ['plane', 'jump', 'fall', 'canopy'] },
  { id: 'kp-buzz-carnival', word: 'Carnival', tabooWords: ['rides', 'fair', 'cotton candy', 'tickets'] },
  { id: 'kp-buzz-avalanche', word: 'Avalanche', tabooWords: ['snow', 'mountain', 'slide', 'ski'] },
  { id: 'kp-buzz-orchestra', word: 'Orchestra', tabooWords: ['music', 'instruments', 'conductor', 'symphony'] },
  { id: 'kp-buzz-magnet', word: 'Magnet', tabooWords: ['metal', 'attract', 'north', 'fridge'] },
  { id: 'kp-buzz-mushroom', word: 'Mushroom', tabooWords: ['fungus', 'cap', 'forest', 'pizza'] },
  { id: 'kp-buzz-suitcase', word: 'Suitcase', tabooWords: ['travel', 'clothes', 'pack', 'airport'] },
  { id: 'kp-buzz-hourglass', word: 'Hourglass', tabooWords: ['sand', 'time', 'glass', 'minute'] },
  { id: 'kp-buzz-zipper', word: 'Zipper', tabooWords: ['jacket', 'teeth', 'close', 'clothing'] },
  { id: 'kp-buzz-dandelion', word: 'Dandelion', tabooWords: ['flower', 'yellow', 'weed', 'seeds'] },
  { id: 'kp-buzz-campfire', word: 'Campfire', tabooWords: ['tent', 'wood', 'flames', 'marshmallow'] },
  { id: 'kp-buzz-merry-go-round', word: 'Carousel', tabooWords: ['horse', 'music', 'spin', 'fairground'] },
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && !Object.hasOwn(Object.prototype, value);
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

function tokenise(text: string): string[] {
  return text.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function containsTerm(text: string, term: string): boolean {
  const tokens = tokenise(text);
  const termTokens = tokenise(term);
  if (termTokens.length === 0 || termTokens.length > tokens.length) return false;
  for (let start = 0; start <= tokens.length - termTokens.length; start += 1) {
    if (termTokens.every((token, offset) => tokens[start + offset] === token)) return true;
  }
  return false;
}

function sameAnswer(guess: string, answer: string): boolean {
  return tokenise(guess).join(' ') === tokenise(answer).join(' ');
}

function isValidMatch(state: BuzzwortMatch): boolean {
  const players = state?.players;
  return Boolean(
    state && typeof state === 'object' && /^[\w-]{1,100}$/.test(state.matchId) &&
    Array.isArray(players) && players.length >= BUZZWORT_PLAYERS_MIN && players.length <= BUZZWORT_PLAYERS_MAX &&
    players.every(validId) && new Set(players).size === players.length && state.round === 1 &&
    ['clue', 'guess', 'revealed'].includes(state.phase) && Number.isSafeInteger(state.attempt) && state.attempt >= 1 &&
    isPlainRecord(state.teams) && isPlainRecord(state.roles) && players.every((playerId) => ['ember', 'cobalt'].includes(state.teams[playerId]) && ['clue_giver', 'guesser', 'teammate', 'watcher'].includes(state.roles[playerId])) &&
    state.activeTeam !== state.watcherTeam && ['ember', 'cobalt'].includes(state.activeTeam) && ['ember', 'cobalt'].includes(state.watcherTeam) &&
    players.includes(state.clueGiverId) && players.includes(state.guesserId) && state.clueGiverId !== state.guesserId &&
    state.teams[state.clueGiverId] === state.activeTeam && state.teams[state.guesserId] === state.activeTeam &&
    state.roles[state.clueGiverId] === 'clue_giver' && state.roles[state.guesserId] === 'guesser' &&
    state.card && typeof state.card.id === 'string' && typeof state.card.word === 'string' && state.card.word.length > 0 &&
    Array.isArray(state.card.tabooWords) && state.card.tabooWords.length >= 3 && state.card.tabooWords.every((term) => typeof term === 'string' && term.length > 0) &&
    (state.currentClue === undefined || (typeof state.currentClue === 'string' && state.currentClue.length > 0 && state.currentClue.length <= BUZZWORT_TEXT_MAX_LENGTH)) &&
    Array.isArray(state.clues) && state.clues.every((entry) => players.includes(entry.playerId) && entry.playerId === state.clueGiverId && Number.isSafeInteger(entry.attempt) && entry.attempt >= 1 && typeof entry.text === 'string' && entry.text.length > 0) &&
    Array.isArray(state.guesses) && state.guesses.every((entry) => players.includes(entry.playerId) && entry.playerId === state.guesserId && Number.isSafeInteger(entry.attempt) && entry.attempt >= 1 && typeof entry.text === 'string' && typeof entry.correct === 'boolean') &&
    isPlainRecord(state.scores) && ['ember', 'cobalt'].every((team) => Number.isSafeInteger(state.scores[team as BuzzwortTeam]) && state.scores[team as BuzzwortTeam] >= 0) &&
    (state.phase !== 'revealed' || (
      typeof state.outcome === 'string' && ['guessed', 'taboo', 'timeout'].includes(state.outcome) &&
      ((state.outcome === 'guessed' && state.winnerTeam === state.activeTeam) || (state.outcome !== 'guessed' && state.winnerTeam === state.watcherTeam))
    )) &&
    Number.isSafeInteger(state.deadline) && Number.isSafeInteger(state.updatedAt) && state.updatedAt >= 0 &&
    (state.phase === 'revealed' ? state.deadline === state.updatedAt : state.deadline >= state.updatedAt) &&
    Number.isSafeInteger(state.version) && state.version >= 0
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function finish(state: BuzzwortMatch, outcome: BuzzwortOutcome, winnerTeam: BuzzwortTeam, now: number, incrementVersion = true): BuzzwortMatch {
  const next = clone(state);
  next.phase = 'revealed';
  next.outcome = outcome;
  next.winnerTeam = winnerTeam;
  next.scores[winnerTeam] += 1;
  next.deadline = now;
  next.updatedAt = now;
  if (incrementVersion) next.version += 1;
  return next;
}

export function createBuzzwortMatch(input: { matchId: string; players: string[]; now: number; seed: number }): BuzzwortMatch {
  if (!input || typeof input.matchId !== 'string' || !/^[\w-]{1,100}$/.test(input.matchId) ||
      !Array.isArray(input.players) || input.players.length < BUZZWORT_PLAYERS_MIN || input.players.length > BUZZWORT_PLAYERS_MAX ||
      !input.players.every(validId) || new Set(input.players).size !== input.players.length ||
      !Number.isSafeInteger(input.now) || input.now < 0 || input.now > Number.MAX_SAFE_INTEGER - BUZZWORT_ROUND_DURATION_MS || !Number.isSafeInteger(input.seed)) {
    throw new TypeError('Invalid Buzzwort match setup');
  }
  const orderedPlayers = seededShuffle(input.players, input.seed ^ 0x12ad8);
  const teams = Object.fromEntries(orderedPlayers.map((playerId, index) => [playerId, index % 2 === 0 ? 'ember' : 'cobalt'])) as Record<string, BuzzwortTeam>;
  const emberCount = Object.values(teams).filter((team) => team === 'ember').length;
  const cobaltCount = orderedPlayers.length - emberCount;
  const activeTeam: BuzzwortTeam = emberCount > cobaltCount ? 'ember' : cobaltCount > emberCount ? 'cobalt' : (input.seed & 1) === 0 ? 'ember' : 'cobalt';
  const watcherTeam: BuzzwortTeam = activeTeam === 'ember' ? 'cobalt' : 'ember';
  const activePlayers = orderedPlayers.filter((playerId) => teams[playerId] === activeTeam);
  const clueGiverId = activePlayers[0]!;
  const guesserId = activePlayers[1]!;
  const roles = Object.fromEntries(orderedPlayers.map((playerId) => [
    playerId,
    teams[playerId] === watcherTeam ? 'watcher' : playerId === clueGiverId ? 'clue_giver' : playerId === guesserId ? 'guesser' : 'teammate',
  ])) as Record<string, BuzzwortRole>;
  const card = clone(seededShuffle(CARD_DECK, input.seed ^ 0x9e3779b9)[0]!);
  return {
    matchId: input.matchId,
    players: [...input.players],
    round: 1,
    phase: 'clue',
    attempt: 1,
    teams,
    roles,
    activeTeam,
    watcherTeam,
    clueGiverId,
    guesserId,
    card,
    clues: [],
    guesses: [],
    scores: { ember: 0, cobalt: 0 },
    deadline: input.now + BUZZWORT_ROUND_DURATION_MS,
    updatedAt: input.now,
    version: 0,
  };
}

function validActionHeader(state: BuzzwortMatch, input: { matchId: string; round: number; attempt: number; now: number; playerId: string }): BuzzwortMutationResult | undefined {
  if (!input || typeof input !== 'object' || typeof input.matchId !== 'string' || !validId(input.playerId) ||
      !Number.isSafeInteger(input.round) || !Number.isSafeInteger(input.attempt) || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (input.matchId !== state.matchId) return { ok: false, code: 'MATCH_MISMATCH' };
  if (input.round !== state.round) return { ok: false, code: 'ROUND_CLOSED' };
  if (!state.players.includes(input.playerId)) return { ok: false, code: 'UNAUTHORIZED' };
  return undefined;
}

export function submitBuzzwortClue(
  state: BuzzwortMatch,
  input: { matchId: string; round: number; attempt: number; playerId: string; text: string; now: number },
): BuzzwortMutationResult {
  if (!isValidMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input.text !== 'string' || input.text.trim().length === 0 || input.text.trim().length > BUZZWORT_TEXT_MAX_LENGTH || tokenise(input.text).length === 0) return { ok: false, code: 'INVALID_INPUT' };
  const headerError = validActionHeader(state, input);
  if (headerError) return headerError;
  const text = input.text.trim();
  const prior = state.clues.find((entry) => entry.attempt === input.attempt && entry.playerId === input.playerId);
  if (prior) return prior.text === text ? { ok: true, state, idempotent: true } : { ok: false, code: 'ROUND_CLOSED' };
  if (input.attempt !== state.attempt || state.phase !== 'clue') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.playerId !== state.clueGiverId) return { ok: false, code: 'UNAUTHORIZED' };
  if (input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  const next = clone(state);
  next.clues.push({ playerId: input.playerId, attempt: input.attempt, text });
  next.currentClue = text;
  next.phase = 'guess';
  next.updatedAt = input.now;
  next.version += 1;
  const violatesTaboo = [next.card.word, ...next.card.tabooWords].some((term) => containsTerm(text, term));
  if (violatesTaboo) return { ok: true, state: finish(next, 'taboo', next.watcherTeam, input.now, false) };
  return { ok: true, state: next };
}

export function submitBuzzwortGuess(
  state: BuzzwortMatch,
  input: { matchId: string; round: number; attempt: number; playerId: string; guess: string; now: number },
): BuzzwortMutationResult {
  if (!isValidMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || typeof input.guess !== 'string' || input.guess.trim().length === 0 || input.guess.trim().length > BUZZWORT_TEXT_MAX_LENGTH) return { ok: false, code: 'INVALID_INPUT' };
  const headerError = validActionHeader(state, input);
  if (headerError) return headerError;
  const guess = input.guess.trim();
  const prior = state.guesses.find((entry) => entry.attempt === input.attempt && entry.playerId === input.playerId);
  if (prior) return prior.text === guess ? { ok: true, state, idempotent: true } : { ok: false, code: 'ROUND_CLOSED' };
  if (input.attempt !== state.attempt || state.phase !== 'guess') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.playerId !== state.guesserId) return { ok: false, code: 'UNAUTHORIZED' };
  if (input.now >= state.deadline) return { ok: false, code: 'ROUND_CLOSED' };
  const correct = sameAnswer(guess, state.card.word);
  const next = clone(state);
  next.guesses.push({ playerId: input.playerId, attempt: input.attempt, text: guess, correct });
  next.updatedAt = input.now;
  next.version += 1;
  if (correct) return { ok: true, state: finish(next, 'guessed', next.activeTeam, input.now, false) };
  next.phase = 'clue';
  next.currentClue = undefined;
  next.attempt += 1;
  return { ok: true, state: next };
}

export function advanceBuzzwort(state: BuzzwortMatch, input: { now: number }): BuzzwortMutationResult {
  if (!isValidMatch(state)) return { ok: false, code: 'INVALID_STATE' };
  if (!input || !validClock(input.now, state.updatedAt)) return { ok: false, code: 'INVALID_INPUT' };
  if (state.phase === 'revealed') return { ok: false, code: 'ROUND_CLOSED' };
  if (input.now < state.deadline) return { ok: false, code: 'TOO_EARLY' };
  return { ok: true, state: finish(state, 'timeout', state.watcherTeam, input.now) };
}

export function buzzwortSnapshot(
  state: BuzzwortMatch,
  viewer: { role: 'host' } | { role: 'spectator' } | { role: 'player'; playerId: string },
): BuzzwortSnapshot {
  if (!isValidMatch(state) || !viewer || !['host', 'spectator', 'player'].includes(viewer.role)) throw new TypeError('Invalid Buzzwort snapshot request');
  if (viewer.role === 'player' && (!validId(viewer.playerId) || !state.players.includes(viewer.playerId))) throw new TypeError('Buzzwort snapshot player is not assigned');
  const playerId = viewer.role === 'player' ? viewer.playerId : undefined;
  const playerRole = playerId ? state.roles[playerId] : undefined;
  const ownClue = state.phase === 'guess' && playerRole === 'clue_giver' && state.clues.some((entry) => entry.attempt === state.attempt);
  const ownGuess = playerRole === 'guesser' && state.guesses.some((entry) => entry.attempt === state.attempt);
  const visibleClues = state.clues.filter((entry) => entry.attempt < state.attempt || state.phase !== 'clue');
  return {
    matchId: state.matchId,
    round: state.round,
    phase: state.phase,
    attempt: state.attempt,
    players: [...state.players],
    activeTeam: state.activeTeam,
    watcherTeam: state.watcherTeam,
    clueGiverId: state.clueGiverId,
    guesserId: state.guesserId,
    deadline: state.deadline,
    version: state.version,
    clueCount: state.clues.length,
    submitted: ownClue || ownGuess,
    ...(state.phase === 'guess' && state.currentClue !== undefined ? { currentClue: state.currentClue } : {}),
    clues: visibleClues.map((entry) => ({ ...entry })),
    ...(playerId && playerRole && state.phase !== 'revealed' ? {
      assignment: {
        role: playerRole,
        team: state.teams[playerId]! ,
        ...(playerRole === 'clue_giver' ? { card: { word: state.card.word, tabooWords: [...state.card.tabooWords] } } : {}),
      },
    } : {}),
    ...(state.phase === 'revealed' ? { result: getBuzzwortResult(state) } : {}),
  };
}

export function getBuzzwortResult(state: BuzzwortMatch): BuzzwortResult {
  if (!isValidMatch(state) || state.phase !== 'revealed' || !state.outcome || !state.winnerTeam) throw new TypeError('Buzzwort result is not ready');
  return {
    matchId: state.matchId,
    round: state.round,
    outcome: state.outcome,
    winnerTeam: state.winnerTeam,
    activeTeam: state.activeTeam,
    watcherTeam: state.watcherTeam,
    card: clone(state.card),
    scores: { ...state.scores },
    teams: { ...state.teams },
    roles: { ...state.roles },
    clues: clone(state.clues),
    guesses: clone(state.guesses),
  };
}
